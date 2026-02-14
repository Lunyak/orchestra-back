import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AdminModule } from './admin/admin.module';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AuthModule } from './auth/auth.module';
import { FilesModule } from './files/files.module';
import { NotificationsModule } from './notifications/notifications.module';
import { PrismaModule } from './prisma/prisma.module';
import { ProjectsModule } from './projects/projects.module';
import { SyncModule } from './sync/sync.module';
import { UsersModule } from './users/users.module';
import { BotModule } from './bot/bot.module';
import { ProfileModule } from './profile/profile.module';
import { RehearsalsModule } from './rehearsals/rehearsals.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    PrismaModule,
    UsersModule,
    AuthModule,
    ProjectsModule,
    SyncModule,
    ProfileModule,
    RehearsalsModule,
    NotificationsModule,
    FilesModule,
    AdminModule,
    BotModule
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}

