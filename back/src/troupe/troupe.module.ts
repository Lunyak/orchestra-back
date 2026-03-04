import { Module } from '@nestjs/common';
import { TroupeController } from './troupe.controller';
import { TroupeService } from './troupe.service';

@Module({
  controllers: [TroupeController],
  providers: [TroupeService],
})
export class TroupeModule {}
