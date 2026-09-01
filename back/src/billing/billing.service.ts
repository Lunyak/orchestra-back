import {
  BadRequestException,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { MailService } from '../mail/mail.service';
import { PrismaService } from '../prisma/prisma.service';
import { YooKassaClient } from './yookassa.client';

const PLAN_TITLES: Record<string, string> = {
  free: 'Бесплатный',
  standard: 'Стандарт',
  premium: 'Премиум',
};

const PAID_PLANS = new Set(['standard', 'premium']);

function originFromWebDomain(raw: string): string {
  const value = String(raw ?? '').trim();
  if (!value) return '';
  if (/^https?:\/\//i.test(value)) return value.replace(/\/+$/, '');
  const isLocal =
    value === 'localhost' ||
    value.startsWith('localhost:') ||
    value.startsWith('127.0.0.1') ||
    value.startsWith('192.168.') ||
    value.startsWith('10.');
  return `${isLocal ? 'http' : 'https'}://${value}`.replace(/\/+$/, '');
}

function readPriceRub(features: unknown): number | null {
  if (!features || typeof features !== 'object') return null;
  const raw = (features as { priceRub?: unknown }).priceRub;
  if (typeof raw !== 'number' || !Number.isFinite(raw) || raw < 0) return null;
  return Math.round(raw);
}

@Injectable()
export class BillingService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly mail: MailService,
    private readonly yookassa: YooKassaClient,
    private readonly config: ConfigService,
  ) {}

  async listPlans() {
    const plans = await this.prisma.subscriptionPlan.findMany();
    const presented = plans.map((plan) => this.presentPlan(plan));
    presented.sort((left, right) => {
      const leftPrice = left.priceRub ?? -1;
      const rightPrice = right.priceRub ?? -1;
      return leftPrice - rightPrice;
    });
    return presented;
  }

  async getMyBilling(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: { subscription: true },
    });
    if (!user) throw new NotFoundException('User not found');
    const projectsUsed = await this.prisma.project.count({
      where: { ownerId: userId, deletedAt: null },
    });
    return {
      email: user.email,
      projectsUsed,
      checkoutEnabled: this.yookassa.isConfigured(),
      plan: user.subscription ? this.presentPlan(user.subscription) : null,
    };
  }

  async createCheckout(userId: string, body: { planName?: string }) {
    const planName = String(body.planName ?? '').trim().toLowerCase();
    if (!PAID_PLANS.has(planName)) {
      throw new BadRequestException('planName must be standard or premium');
    }
    if (!this.yookassa.isConfigured()) {
      throw new ServiceUnavailableException('YooKassa is not configured');
    }

    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { email: true },
    });
    if (!user) throw new NotFoundException('User not found');

    const plan = await this.prisma.subscriptionPlan.findUnique({
      where: { name: planName },
    });
    if (!plan) throw new NotFoundException('Plan not found');

    const amountRub = this.priceForPlan(planName, plan.features);
    if (!amountRub) {
      throw new BadRequestException('Plan has no price');
    }

    const returnUrl = `${this.appOrigin()}/billing?paid=1`;
    const payment = await this.yookassa.createRedirectPayment({
      amountRub,
      description: `Orchestra — ${PLAN_TITLES[planName] ?? planName}`,
      returnUrl,
      metadata: { userId, planName, email: user.email },
    });

    const confirmationUrl = payment.confirmation?.confirmation_url ?? '';
    if (!confirmationUrl) {
      throw new ServiceUnavailableException('YooKassa did not return a payment URL');
    }

    await this.prisma.billingPayment.create({
      data: {
        id: payment.id,
        userId,
        planName,
        amountRub,
        status: payment.status || 'pending',
        confirmationUrl,
      },
    });

    return { confirmationUrl, paymentId: payment.id };
  }

  async handleYooKassaNotification(body: {
    event?: string;
    object?: { id?: string };
  }) {
    const paymentId = String(body.object?.id ?? '').trim();
    if (!paymentId) throw new BadRequestException('payment id is required');

    const payment = await this.yookassa.getPayment(paymentId);
    const status = String(payment.status ?? '').toLowerCase();
    const metadata = payment.metadata ?? {};
    const userId = String(metadata.userId ?? '').trim();
    const planName = String(metadata.planName ?? '').trim().toLowerCase();

    const existing = await this.prisma.billingPayment.findUnique({
      where: { id: payment.id },
    });
    if (existing) {
      await this.prisma.billingPayment.update({
        where: { id: payment.id },
        data: { status },
      });
    } else if (userId) {
      await this.prisma.billingPayment.create({
        data: {
          id: payment.id,
          userId,
          planName: planName || 'unknown',
          amountRub: Math.round(Number(payment.amount?.value ?? 0)),
          status,
        },
      });
    }

    if (status !== 'succeeded' || !userId || !PAID_PLANS.has(planName)) {
      return { ok: true, applied: false };
    }

    const plan = await this.prisma.subscriptionPlan.findUnique({
      where: { name: planName },
    });
    if (!plan) return { ok: true, applied: false };

    await this.prisma.user.update({
      where: { id: userId },
      data: { subscriptionId: plan.id },
    });

    return { ok: true, applied: true };
  }

  async requestUpgrade(
    userId: string,
    body: { planName?: string; message?: string },
  ) {
    const planName = String(body.planName ?? '').trim().toLowerCase();
    if (!PAID_PLANS.has(planName)) {
      throw new BadRequestException('planName must be standard or premium');
    }
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { email: true },
    });
    if (!user) throw new NotFoundException('User not found');
    const queued = await this.mail.sendUpgradeRequest({
      fromEmail: user.email,
      planName,
      message: String(body.message ?? '').trim() || undefined,
    });
    return {
      ok: true,
      queued,
      message: queued
        ? 'Запрос отправлен. Мы свяжемся с вами и откроем тариф вручную.'
        : 'Запрос принят. Напишите на sergey@lunyak.ru, если ответ задержится.',
    };
  }

  private appOrigin() {
    const fromDomain = originFromWebDomain(
      String(this.config.get('WEB_DOMAIN') ?? ''),
    );
    if (fromDomain) return fromDomain;
    return 'http://localhost:5173';
  }

  private priceForPlan(planName: string, features: unknown) {
    const envKey =
      planName === 'premium'
        ? 'BILLING_PREMIUM_PRICE_RUB'
        : 'BILLING_STANDARD_PRICE_RUB';
    const fromEnv = Number(this.config.get(envKey));
    if (Number.isFinite(fromEnv) && fromEnv > 0) return Math.round(fromEnv);
    return readPriceRub(features) ?? (planName === 'premium' ? 2990 : 990);
  }

  private presentPlan(plan: {
    id: string;
    name: string;
    maxProjects: number | null;
    maxCollaboratorsPerProject: number | null;
    features: unknown;
  }) {
    const priceRub =
      plan.name === 'free' ? 0 : this.priceForPlan(plan.name, plan.features);
    return {
      id: plan.id,
      name: plan.name,
      title: PLAN_TITLES[plan.name] ?? plan.name,
      maxProjects: plan.maxProjects,
      maxCollaboratorsPerProject: plan.maxCollaboratorsPerProject,
      priceRub,
    };
  }
}
