import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AdminModule } from './admin/admin.module';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AuthModule } from './auth/auth.module';
import { BotModule } from './bot/bot.module';
import { FilesModule } from './files/files.module';
import { NotificationsModule } from './notifications/notifications.module';
import { PrismaModule } from './prisma/prisma.module';
import { ProfileModule } from './profile/profile.module';
import { ProjectsModule } from './projects/projects.module';
import { RehearsalsModule } from './rehearsals/rehearsals.module';
import { ActorNotesModule } from './actor-notes/actor-notes.module';
import { DirectorSessionsModule } from './director-sessions/director-sessions.module';
import { SyncModule } from './sync/sync.module';
import { UsersModule } from './users/users.module';
import { TtsModule } from './tts/tts.module';
import { TelegramBotsModule } from './telegram-bots/telegram-bots.module';
import { MessengerBotsModule } from './messenger-bots/messenger-bots.module';
import { TroupeModule } from './troupe/troupe.module';
import { RolesModule } from './roles/roles.module';
import { SiteAnalyticsModule } from './site-analytics/site-analytics.module';
import { ChatModule } from './chat/chat.module';
import { PremisesModule } from './premises/premises.module';
import { ProjectTasksModule } from './project-tasks/project-tasks.module';
import { AccountingModule } from './accounting/accounting.module';
import { StudioModule } from './studio/studio.module';
import { WorkspacesModule } from './workspaces/workspaces.module';
import { ProjectAccessModule } from './project-access/project-access.module';
import { DashboardModule } from './dashboard/dashboard.module';
import { BillingModule } from './billing/billing.module';

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
    ActorNotesModule,
    DirectorSessionsModule,
    NotificationsModule,
    FilesModule,
    AdminModule,
    BotModule,
    TtsModule,
    TelegramBotsModule,
    MessengerBotsModule,
    TroupeModule,
    RolesModule,
    SiteAnalyticsModule,
    ChatModule,
    PremisesModule,
    ProjectTasksModule,
    AccountingModule,
    StudioModule,
    WorkspacesModule,
    ProjectAccessModule,
    DashboardModule,
    BillingModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
