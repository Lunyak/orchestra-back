import { Injectable, OnModuleInit } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../prisma/prisma.service';

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
      update: { maxProjects: 3, maxCollaboratorsPerProject: 0 },
      create: {
        name: 'free',
        maxProjects: 3,
        maxCollaboratorsPerProject: 0,
        features: { collaboration: false, advancedLight: true },
      },
    });
    await this.prisma.subscriptionPlan.upsert({
      where: { name: 'standard' },
      update: { maxProjects: 10, maxCollaboratorsPerProject: 5 },
      create: {
        name: 'standard',
        maxProjects: 10,
        maxCollaboratorsPerProject: 5,
        features: { collaboration: true, advancedLight: true },
      },
    });
  }

  findByEmail(email: string) {
    return this.prisma.user.findUnique({ where: { email } });
  }

  findById(id: string) {
    return this.prisma.user.findUnique({ where: { id } });
  }

  async createUser(email: string, password: string) {
    const passwordHash = await bcrypt.hash(password, 10);

    const freePlan = await this.prisma.subscriptionPlan.findUniqueOrThrow({
      where: { name: 'free' },
    });

    return this.prisma.user.create({
      data: {
        email,
        passwordHash,
        subscription: { connect: { id: freePlan.id } },
      },
    });
  }
}

