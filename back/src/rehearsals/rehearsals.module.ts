import { Module } from '@nestjs/common';
import { RolesModule } from '../roles/roles.module';
import { RehearsalsController } from './rehearsals.controller';
import { RehearsalsService } from './rehearsals.service';

@Module({
  imports: [RolesModule],
  controllers: [RehearsalsController],
  providers: [RehearsalsService],
  exports: [RehearsalsService],
})
export class RehearsalsModule {}
