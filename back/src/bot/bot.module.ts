import { Module } from '@nestjs/common';
import { BotController } from './bot.controller';
import { BotGuard } from './bot.guard';
import { BotService } from './bot.service';
import { RehearsalsModule } from '../rehearsals/rehearsals.module';

@Module({
  imports: [RehearsalsModule],
  controllers: [BotController],
  providers: [BotService, BotGuard],
})
export class BotModule {}

