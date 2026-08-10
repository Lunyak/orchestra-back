import { Injectable } from '@nestjs/common';
import { Prisma, ProjectTaskStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { ProjectAccessService } from '../project-access/project-access.service';

const DEFAULT_HORIZON_DAYS = 30;
const DEFAULT_REHEARSALS_LIMIT = 6;
const DEFAULT_TASKS_LIMIT = 8;
const DEFAULT_ACTIONS_LIMIT = 10;

export interface DashboardOptions {
  horizonDays?: number;
  rehearsalsLimit?: number;
  tasksLimit?: number;
  actionsLimit?: number;
}

type DirectorSessionPayload = {
  id?: string;
  title?: string;
  startsAt?: string;
  publishedAt?: string | null;
  participants?: Array<{ email?: string; status?: string }>;
};

type ChatUnreadRow = {
  id: string;
  kind: string;
  troupeId: string | null;
  title: string;
  unreadCount: bigint | number;
};

function normalizeEmail(value: string): string {
  return value.trim().toLowerCase();
}

function clamp(
  value: number | undefined,
  fallback: number,
  max: number,
): number {
  if (!Number.isFinite(value)) return fallback;
  return Math.min(max, Math.max(1, Math.floor(value!)));
}

function asDirectorSessionPayload(
  value: Prisma.JsonValue,
): DirectorSessionPayload | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  return value as DirectorSessionPayload;
}

function isUnknownDirectorInvitation(
  payload: DirectorSessionPayload,
  email: string,
): boolean {
  if (!payload.publishedAt || !Array.isArray(payload.participants))
    return false;
  return payload.participants.some(
    (participant) =>
      normalizeEmail(String(participant.email ?? '')) === email &&
      String(participant.status ?? 'unknown') === 'unknown',
  );
}

@Injectable()
export class DashboardService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly projectAccess: ProjectAccessService,
  ) {}

  async getDashboard(
    userId: string,
    userEmail: string,
    options: DashboardOptions = {},
  ) {
    const email = normalizeEmail(userEmail);
    const horizonDays = clamp(options.horizonDays, DEFAULT_HORIZON_DAYS, 90);
    const rehearsalsLimit = clamp(
      options.rehearsalsLimit,
      DEFAULT_REHEARSALS_LIMIT,
      20,
    );
    const tasksLimit = clamp(options.tasksLimit, DEFAULT_TASKS_LIMIT, 30);
    const actionsLimit = clamp(options.actionsLimit, DEFAULT_ACTIONS_LIMIT, 30);
    const now = new Date();
    const horizon = new Date(now.getTime() + horizonDays * 24 * 60 * 60 * 1000);
    const projectWhere = this.projectAccess.readWhere(userId);
    const upcomingWhere: Prisma.RehearsalWhereInput = {
      project: { is: projectWhere },
      publishedAt: { not: null },
      startsAt: { gte: now, lte: horizon },
    };
    const tasksWhere: Prisma.ProjectTaskWhereInput = {
      project: { is: projectWhere },
      assigneeEmail: email,
      status: { not: ProjectTaskStatus.done },
    };
    const studioInviteWhere: Prisma.StudioInviteWhereInput = {
      email,
      acceptedAt: null,
      declinedAt: null,
      revokedAt: null,
      OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
    };
    const projectInviteWhere: Prisma.ProjectInviteWhereInput = {
      email,
      acceptedAt: null,
      declinedAt: null,
      revokedAt: null,
      OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
    };
    const troupeInviteWhere: Prisma.TroupeInviteWhereInput = {
      email,
      acceptedAt: null,
      declinedAt: null,
      revokedAt: null,
      OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
    };
    const studioAssignmentWhere: Prisma.StudioAssignmentWhereInput = {
      targets: { some: { email } },
      submissions: { none: { email } },
    };
    const rehearsalActionWhere: Prisma.RehearsalWhereInput = {
      ...upcomingWhere,
      participants: { some: { email, status: 'unknown' } },
    };

    const [
      projects,
      rehearsals,
      rehearsalsCount,
      tasks,
      tasksCount,
      studioInvites,
      studioInvitesCount,
      projectInvites,
      projectInvitesCount,
      troupeInvites,
      troupeInvitesCount,
      studioAssignments,
      studioAssignmentsCount,
      rehearsalActions,
      rehearsalActionsCount,
      directorRows,
      chatRows,
    ] = await Promise.all([
      this.prisma.project.findMany({
        where: projectWhere,
        select: {
          id: true,
          slug: true,
          name: true,
          description: true,
          workspace: { select: { id: true, name: true, type: true } },
        },
        orderBy: { name: 'asc' },
      }),
      this.prisma.rehearsal.findMany({
        where: upcomingWhere,
        select: {
          id: true,
          title: true,
          startsAt: true,
          durationMin: true,
          place: true,
          project: { select: { id: true, slug: true, name: true } },
        },
        orderBy: [{ startsAt: 'asc' }, { id: 'asc' }],
        take: rehearsalsLimit,
      }),
      this.prisma.rehearsal.count({ where: upcomingWhere }),
      this.prisma.projectTask.findMany({
        where: tasksWhere,
        select: {
          id: true,
          title: true,
          status: true,
          category: true,
          dueAt: true,
          project: { select: { id: true, slug: true, name: true } },
        },
        orderBy: [
          { dueAt: { sort: 'asc', nulls: 'last' } },
          { createdAt: 'asc' },
        ],
        take: tasksLimit,
      }),
      this.prisma.projectTask.count({ where: tasksWhere }),
      this.prisma.studioInvite.findMany({
        where: studioInviteWhere,
        select: {
          id: true,
          role: true,
          expiresAt: true,
          createdAt: true,
          studio: { select: { id: true, title: true } },
          createdBy: { select: { email: true } },
        },
        orderBy: { createdAt: 'desc' },
        take: actionsLimit,
      }),
      this.prisma.studioInvite.count({ where: studioInviteWhere }),
      this.prisma.projectInvite.findMany({
        where: projectInviteWhere,
        select: {
          id: true,
          role: true,
          expiresAt: true,
          createdAt: true,
          project: { select: { id: true, slug: true, name: true } },
          createdBy: { select: { email: true } },
        },
        orderBy: { createdAt: 'desc' },
        take: actionsLimit,
      }),
      this.prisma.projectInvite.count({ where: projectInviteWhere }),
      this.prisma.troupeInvite.findMany({
        where: troupeInviteWhere,
        select: {
          id: true,
          kind: true,
          expiresAt: true,
          createdAt: true,
          troupe: { select: { id: true, title: true } },
          createdBy: { select: { email: true } },
        },
        orderBy: { createdAt: 'desc' },
        take: actionsLimit,
      }),
      this.prisma.troupeInvite.count({ where: troupeInviteWhere }),
      this.prisma.studioAssignment.findMany({
        where: studioAssignmentWhere,
        select: {
          id: true,
          title: true,
          dueAt: true,
          createdAt: true,
          studio: { select: { id: true, title: true } },
        },
        orderBy: [
          { dueAt: { sort: 'asc', nulls: 'last' } },
          { createdAt: 'asc' },
        ],
        take: actionsLimit,
      }),
      this.prisma.studioAssignment.count({ where: studioAssignmentWhere }),
      this.prisma.rehearsal.findMany({
        where: rehearsalActionWhere,
        select: {
          id: true,
          title: true,
          startsAt: true,
          project: { select: { id: true, slug: true, name: true } },
        },
        orderBy: [{ startsAt: 'asc' }, { id: 'asc' }],
        take: actionsLimit,
      }),
      this.prisma.rehearsal.count({ where: rehearsalActionWhere }),
      this.prisma.directorSession.findMany({
        where: { startsAt: { gte: now, lte: horizon } },
        select: { id: true, title: true, startsAt: true, payload: true },
        orderBy: [{ startsAt: 'asc' }, { id: 'asc' }],
        take: 2500,
      }),
      this.getChatUnread(userId, email),
    ]);

    const directorInvitations = directorRows
      .map((row) => ({ row, payload: asDirectorSessionPayload(row.payload) }))
      .filter(
        (
          item,
        ): item is {
          row: (typeof directorRows)[number];
          payload: DirectorSessionPayload;
        } =>
          item.payload !== null &&
          isUnknownDirectorInvitation(item.payload, email),
      )
      .map(({ row, payload }) => ({
        id: row.id,
        title: payload.title || row.title,
        startsAt: payload.startsAt || row.startsAt.toISOString(),
      }));

    const actions = [
      ...studioInvites.map((invite) => ({
        kind: 'studio_invite' as const,
        id: invite.id,
        title: `Приглашение в студию «${invite.studio.title}»`,
        description: `Роль: ${invite.role}`,
        invitedByEmail: invite.createdBy.email,
        studioId: invite.studio.id,
        studioTitle: invite.studio.title,
        role: invite.role,
        dueAt: invite.expiresAt,
      })),
      ...projectInvites.map((invite) => ({
        kind: 'project_invite' as const,
        id: invite.id,
        title: `Приглашение в проект «${invite.project.name}»`,
        description: `Роль: ${invite.role}`,
        invitedByEmail: invite.createdBy.email,
        project: invite.project,
        role: invite.role,
        dueAt: invite.expiresAt,
      })),
      ...troupeInvites.map((invite) => ({
        kind: 'troupe_invite' as const,
        id: invite.id,
        title: `Приглашение в труппу «${invite.troupe.title}»`,
        description:
          invite.kind === 'guest' ? 'Участник: гость' : 'Участник: в составе',
        invitedByEmail: invite.createdBy.email,
        troupe: invite.troupe,
        memberKind: invite.kind,
        dueAt: invite.expiresAt,
      })),
      ...directorInvitations.map((session) => ({
        kind: 'director_session_invitation' as const,
        id: session.id,
        title: session.title,
        dueAt: session.startsAt,
      })),
      ...rehearsalActions.map((rehearsal) => ({
        kind: 'rehearsal_response' as const,
        id: rehearsal.id,
        title: rehearsal.title,
        project: rehearsal.project,
        dueAt: rehearsal.startsAt,
      })),
      ...studioAssignments.map((assignment) => ({
        kind: 'studio_assignment' as const,
        id: assignment.id,
        title: assignment.title,
        studioId: assignment.studio.id,
        studioTitle: assignment.studio.title,
        dueAt: assignment.dueAt,
      })),
    ]
      .sort((left, right) => {
        const leftTime = left.dueAt ? new Date(left.dueAt).getTime() : Infinity;
        const rightTime = right.dueAt
          ? new Date(right.dueAt).getTime()
          : Infinity;
        return leftTime - rightTime;
      })
      .slice(0, actionsLimit);

    const chat = chatRows.map((row) => ({
      id: row.id,
      kind: row.kind,
      troupeId: row.troupeId,
      title: row.title,
      unreadCount: Number(row.unreadCount),
    }));
    const unreadChatCount = chat.reduce(
      (total, conversation) => total + conversation.unreadCount,
      0,
    );
    const actionsCount =
      studioInvitesCount +
      projectInvitesCount +
      troupeInvitesCount +
      studioAssignmentsCount +
      rehearsalActionsCount +
      directorInvitations.length;

    return {
      generatedAt: now,
      horizonDays,
      summary: {
        projects: projects.length,
        upcomingRehearsals: rehearsalsCount,
        openTasks: tasksCount,
        actions: actionsCount,
        unreadChat: unreadChatCount,
      },
      projects,
      rehearsals,
      tasks,
      actions,
      chat: {
        totalUnread: unreadChatCount,
        conversations: chat,
      },
    };
  }

  private getChatUnread(userId: string, email: string) {
    return this.prisma.$queryRaw<ChatUnreadRow[]>(Prisma.sql`
      SELECT
        conversation."id",
        conversation."kind"::text AS "kind",
        conversation."troupeId",
        COALESCE(conversation."title", troupe."title", 'Труппа') AS "title",
        COUNT(message."id")::int AS "unreadCount"
      FROM "ChatConversation" conversation
      INNER JOIN "Troupe" troupe ON troupe."id" = conversation."troupeId"
      LEFT JOIN "ChatConversationReadState" read_state
        ON read_state."conversationId" = conversation."id"
        AND read_state."userId" = ${userId}
      LEFT JOIN "ChatMessage" message
        ON message."conversationId" = conversation."id"
        AND message."authorUserId" <> ${userId}
        AND read_state."id" IS NOT NULL
        AND message."createdAt" > read_state."lastReadAt"
      WHERE conversation."kind" = 'TROUPE'
        AND (
          troupe."ownerUserId" = ${userId}
          OR EXISTS (
            SELECT 1
            FROM "TroupeMember" member
            WHERE member."troupeId" = troupe."id"
              AND (member."userId" = ${userId} OR member."email" = ${email})
          )
        )
      GROUP BY conversation."id", troupe."title"
      ORDER BY COUNT(message."id") DESC, conversation."id" ASC
    `);
  }
}
