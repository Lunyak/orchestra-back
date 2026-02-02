import { Injectable } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  findByEmail(email: string) {
    return this.prisma.user.findUnique({ where: { email } });
  }

  findById(id: string) {
    return this.prisma.user.findUnique({ where: { id } });
  }

  async createUser(email: string, password: string) {
    const passwordHash = await bcrypt.hash(password, 10);

    // Найти или создать бесплатный тариф
    const freePlan = await this.prisma.subscriptionPlan.upsert({
      where: { name: 'free' },
      update: {},
      create: {
        name: 'free',
        maxProjects: 3,
        maxCollaboratorsPerProject: 0,
        features: {
          collaboration: false,
          advancedLight: true,
        },
      },
    });

    return this.prisma.user.create({
      data: {
        email,
        passwordHash,
        subscription: {
          connect: { id: freePlan.id },
        },
      },
    });
  }
}

