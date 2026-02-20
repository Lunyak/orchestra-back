import { Module } from '@nestjs/common';
import { BotController } from './bot.controller';
import { BotGuard } from './bot.guard';
import { BotService } from './bot.service';
import { RehearsalsModule } from '../rehearsals/rehearsals.module';
import { DirectorSessionsModule } from '../director-sessions/director-sessions.module';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [PrismaModule, RehearsalsModule, DirectorSessionsModule],
  controllers: [BotController],
  providers: [BotService, BotGuard],
})
export class BotModule {}
