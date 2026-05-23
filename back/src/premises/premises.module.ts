import { Module } from '@nestjs/common';
import { PremisesController } from './premises.controller';
import { PremisesService } from './premises.service';

@Module({
  controllers: [PremisesController],
  providers: [PremisesService],
})
export class PremisesModule {}
