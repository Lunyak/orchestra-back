import { Injectable, OnModuleInit } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../prisma/prisma.service';

function normalizeEmail(email: string): string {
  return String(email ?? '')
    .trim()
    .toLowerCase();
}

@Injectable()
export class UsersService implements OnModuleInit {
  constructor(private readonly prisma: PrismaService) {}

  async onModuleInit() {
    await this.ensureSubscriptionPlans();
  }

  /** Создаёт или обновляет тарифы при старте приложения (лимиты принудительно синхронизируются) */
  private async ensureSubscriptionPlans() {
    await this.prisma.subscriptionPlan.upsert({
      where: { name: 'free' },
      update: {
        maxProjects: 3,
        maxCollaboratorsPerProject: 0,
        features: { collaboration: false, advancedLight: true, priceRub: 0 },
      },
      create: {
        name: 'free',
        maxProjects: 3,
        maxCollaboratorsPerProject: 0,
        features: { collaboration: false, advancedLight: true, priceRub: 0 },
      },
    });
    await this.prisma.subscriptionPlan.upsert({
      where: { name: 'standard' },
      update: {
        maxProjects: 10,
        maxCollaboratorsPerProject: 5,
        features: { collaboration: true, advancedLight: true, priceRub: 990 },
      },
      create: {
        name: 'standard',
        maxProjects: 10,
        maxCollaboratorsPerProject: 5,
        features: { collaboration: true, advancedLight: true, priceRub: 990 },
      },
    });
    await this.prisma.subscriptionPlan.upsert({
      where: { name: 'premium' },
      update: {
        maxProjects: null,
        maxCollaboratorsPerProject: null,
        features: {
          collaboration: true,
          advancedLight: true,
          premium: true,
          priceRub: 2990,
        },
      },
      create: {
        name: 'premium',
        maxProjects: null,
        maxCollaboratorsPerProject: null,
        features: {
          collaboration: true,
          advancedLight: true,
          premium: true,
          priceRub: 2990,
        },
      },
    });
  }

  async findByEmail(email: string) {
    const norm = normalizeEmail(email);
    if (!norm) return null;
    // Postgres: уникальность по email у нас кейс-чувствительная, поэтому ищем case-insensitive.
    return this.prisma.user.findFirst({
      where: { email: { equals: norm, mode: 'insensitive' } },
    });
  }

  findById(id: string) {
    return this.prisma.user.findUnique({ where: { id } });
  }

  async createUser(email: string, password: string) {
    const norm = normalizeEmail(email);
    if (!norm) throw new Error('Email is required');
    const passwordHash = await bcrypt.hash(password, 10);

    const freePlan = await this.prisma.subscriptionPlan.findUniqueOrThrow({
      where: { name: 'free' },
    });

    return this.prisma.user.create({
      data: {
        email: norm,
        passwordHash,
        subscription: { connect: { id: freePlan.id } },
      },
    });
  }

  async updatePassword(userId: string, newPassword: string) {
    const passwordHash = await bcrypt.hash(newPassword, 10);
    return this.prisma.user.update({
      where: { id: userId },
      data: { passwordHash },
    });
  }
}
