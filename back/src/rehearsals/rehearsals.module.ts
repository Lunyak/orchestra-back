import { Module } from '@nestjs/common';
import { RehearsalsController } from './rehearsals.controller';
import { RehearsalsService } from './rehearsals.service';

@Module({
  controllers: [RehearsalsController],
  providers: [RehearsalsService],
  exports: [RehearsalsService],
})
export class RehearsalsModule {}
