import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { FilesModule } from '../files/files.module';
import { PremiseAgreementDocumentsService } from './premise-agreement-documents.service';
import { PremisesController } from './premises.controller';
import { PremisesService } from './premises.service';

@Module({
  imports: [ConfigModule, FilesModule],
  controllers: [PremisesController],
  providers: [PremisesService, PremiseAgreementDocumentsService],
})
export class PremisesModule {}
