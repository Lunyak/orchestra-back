import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PrismaModule } from '../prisma/prisma.module';
import { RolesModule } from '../roles/roles.module';
import { DirectorSessionsController } from './director-sessions.controller';
import { DirectorSessionsService } from './director-sessions.service';

@Module({
  imports: [PrismaModule, ConfigModule, RolesModule],
  controllers: [DirectorSessionsController],
  providers: [DirectorSessionsService],
  exports: [DirectorSessionsService],
})
export class DirectorSessionsModule {}
