import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { StudioMemberRole } from '@prisma/client';
import crypto from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { AddMemberDto } from './dto/add-member.dto';
import { CreateAssignmentDto } from './dto/create-assignment.dto';
import { CreateInviteDto } from './dto/create-invite.dto';
import { CreateLessonDto } from './dto/create-lesson.dto';
import { CreateMarkerDto } from './dto/create-marker.dto';
import { CreateModuleDto } from './dto/create-module.dto';
import { CreateStudioDto } from './dto/create-studio.dto';
import { CreateVideoDto } from './dto/create-video.dto';
import { GradeSubmissionDto } from './dto/grade-submission.dto';
import { ReviewLessonProgressDto } from './dto/review-lesson-progress.dto';
import { SubmitAssignmentDto } from './dto/submit-assignment.dto';
import { SubmitLessonDto } from './dto/submit-lesson.dto';
import { UpdateAssignmentDto } from './dto/update-assignment.dto';
import { UpdateLessonDto } from './dto/update-lesson.dto';
import { UpdateMarkerDto } from './dto/update-marker.dto';
import { UpdateMemberDto } from './dto/update-member.dto';
import { UpdateModuleDto } from './dto/update-module.dto';
import { UpdateStudioDto } from './dto/update-studio.dto';
import { UpdateVideoDto } from './dto/update-video.dto';

function normalizeEmail(v: unknown): string {
  const email = String(v ?? '')
    .trim()
    .toLowerCase();
  if (!email) throw new BadRequestException('email is required');
  return email;
}

function sha256Base64Url(input: string): string {
  return crypto.createHash('sha256').update(input).digest('base64url');
}

function parseOptionalDate(raw: unknown): Date | null {
  if (raw == null || raw === '') return null;
  const d = new Date(String(raw));
  if (Number.isNaN(d.getTime())) {
    throw new BadRequestException('Invalid date');
  }
  return d;
}

type StudioAccess = {
  studio: {
    id: string;
    ownerUserId: string;
    title: string;
    description: string | null;
    imageUrl: string | null;
    createdAt: Date;
    updatedAt: Date;
  };
  myRole: StudioMemberRole;
  canManage: boolean;
  myEmail: string;
};

@Injectable()
export class StudioService {
  constructor(private readonly prisma: PrismaService) {}

  private formatRecipientName(
    email: string,
    profileByEmail: Map<
      string,
      {
        displayName: string | null;
        firstName: string | null;
        lastName: string | null;
        avatarUrl?: string | null;
      }
    >,
  ): string {
    const profile = profileByEmail.get(email);
    const display = String(profile?.displayName ?? '').trim();
    if (display) return display;
    const first = String(profile?.firstName ?? '').trim();
    const last = String(profile?.lastName ?? '').trim();
    const full = `${first} ${last}`.trim();
    if (full) return full;
    return email;
  }

  private async buildProfileMap(emails: string[]) {
    const uniqueEmails = [
      ...new Set(
        emails.map((email) => email.trim().toLowerCase()).filter(Boolean),
      ),
    ];
    if (uniqueEmails.length === 0) {
      return new Map<
        string,
        {
          displayName: string | null;
          firstName: string | null;
          lastName: string | null;
          avatarUrl: string | null;
        }
      >();
    }
    const profiles = await this.prisma.userProfile.findMany({
      where: { email: { in: uniqueEmails } },
      select: {
        email: true,
        displayName: true,
        firstName: true,
        lastName: true,
        avatarUrl: true,
      },
    });
    return new Map(
      profiles.map((profile) => [
        profile.email.trim().toLowerCase(),
        {
          displayName: profile.displayName,
          firstName: profile.firstName,
          lastName: profile.lastName,
          avatarUrl: profile.avatarUrl,
        },
      ]),
    );
  }

  private canManageRole(role: StudioMemberRole): boolean {
    return role === 'owner' || role === 'teacher';
  }

  private async resolveUserIdByEmail(email: string): Promise<string | null> {
    const user = await this.prisma.user.findUnique({
      where: { email },
      select: { id: true },
    });
    return user?.id ?? null;
  }

  private async resolveStudioAccess(
    userId: string,
    userEmail: string,
    studioId: string,
  ): Promise<StudioAccess> {
    const myEmail = normalizeEmail(userEmail);
    const studio = await this.prisma.studio.findUnique({
      where: { id: studioId },
      select: {
        id: true,
        ownerUserId: true,
        title: true,
        description: true,
        imageUrl: true,
        createdAt: true,
        updatedAt: true,
      },
    });
    if (!studio) throw new NotFoundException('Studio not found');

    if (studio.ownerUserId === userId) {
      return {
        studio,
        myRole: 'owner',
        canManage: true,
        myEmail,
      };
    }

    const member = await this.prisma.studioMember.findFirst({
      where: {
        studioId,
        OR: [{ userId }, { email: myEmail }],
      },
      select: { role: true },
    });
    if (!member) throw new ForbiddenException('Not a studio member');

    return {
      studio,
      myRole: member.role,
      canManage: this.canManageRole(member.role),
      myEmail,
    };
  }

  private assertCanManage(access: StudioAccess) {
    if (!access.canManage) {
      throw new ForbiddenException('Недостаточно прав для управления студией');
    }
  }

  private assertOwner(access: StudioAccess, userId: string) {
    if (access.studio.ownerUserId !== userId) {
      throw new ForbiddenException('Только владелец может выполнить это действие');
    }
  }

  private serializeMember(
    row: {
      id: string;
      email: string;
      userId: string | null;
      role: StudioMemberRole;
      createdAt: Date;
      updatedAt: Date;
    },
    profileByEmail: Map<
      string,
      {
        displayName: string | null;
        firstName: string | null;
        lastName: string | null;
        avatarUrl?: string | null;
      }
    >,
  ) {
    const email = row.email.trim().toLowerCase();
    const profile = profileByEmail.get(email);
    return {
      id: row.id,
      email,
      userId: row.userId,
      role: row.role,
      displayName: this.formatRecipientName(email, profileByEmail),
      avatarUrl: profile?.avatarUrl?.trim() || null,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    };
  }

  private serializeLesson(row: {
    id: string;
    moduleId: string;
    title: string;
    body: string | null;
    taskType?: 'complete' | 'video';
    taskPrompt?: string | null;
    sortOrder: number;
    createdAt: Date;
    updatedAt: Date;
  }) {
    return {
      id: row.id,
      moduleId: row.moduleId,
      title: row.title,
      body: row.body,
      taskType: row.taskType ?? 'complete',
      taskPrompt: row.taskPrompt ?? null,
      sortOrder: row.sortOrder,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    };
  }

  private serializeLessonProgress(row: {
    id: string;
    lessonId: string;
    email: string;
    status: 'pending' | 'submitted' | 'completed' | 'rejected';
    videoUrl: string | null;
    note: string | null;
    submittedAt: Date | null;
    completedAt: Date | null;
    reviewedAt: Date | null;
    reviewedByUserId: string | null;
    reviewComment: string | null;
    createdAt: Date;
    updatedAt: Date;
  }) {
    return {
      id: row.id,
      lessonId: row.lessonId,
      email: row.email.trim().toLowerCase(),
      status: row.status,
      videoUrl: row.videoUrl,
      note: row.note,
      submittedAt: row.submittedAt,
      completedAt: row.completedAt,
      reviewedAt: row.reviewedAt,
      reviewedByUserId: row.reviewedByUserId,
      reviewComment: row.reviewComment,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    };
  }

  private serializeModule(
    row: {
      id: string;
      studioId: string;
      title: string;
      description: string | null;
      imageUrl: string | null;
      sortOrder: number;
      createdAt: Date;
      updatedAt: Date;
      lessons: Array<{
        id: string;
        moduleId: string;
        title: string;
        body: string | null;
        taskType?: 'complete' | 'video';
        taskPrompt?: string | null;
        sortOrder: number;
        createdAt: Date;
        updatedAt: Date;
      }>;
    },
  ) {
    return {
      id: row.id,
      studioId: row.studioId,
      title: row.title,
      description: row.description,
      imageUrl: row.imageUrl,
      sortOrder: row.sortOrder,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
      lessons: row.lessons.map((lesson) => this.serializeLesson(lesson)),
    };
  }

  private serializeAssignmentSummary(
    row: {
      id: string;
      title: string;
      description: string | null;
      lessonId: string | null;
      dueAt: Date | null;
      createdAt: Date;
      updatedAt: Date;
      targets: Array<{ email: string }>;
      submissions: Array<{ email: string; grade: number | null }>;
    },
    myEmail: string,
    canManage: boolean,
  ) {
    const targetEmails = row.targets.map((t) => t.email.trim().toLowerCase());
    const mySubmission =
      row.submissions.find((s) => s.email === myEmail) ?? null;
    return {
      id: row.id,
      title: row.title,
      description: row.description,
      lessonId: row.lessonId,
      dueAt: row.dueAt,
      targetCount: targetEmails.length,
      submissionCount: row.submissions.length,
      mySubmission: mySubmission
        ? { email: mySubmission.email, grade: mySubmission.grade }
        : null,
      isTargeted: targetEmails.includes(myEmail),
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    };
  }

  private serializeSubmission(row: {
    id: string;
    assignmentId: string;
    email: string;
    body: string | null;
    videoUrl: string | null;
    submittedAt: Date;
    updatedAt: Date;
    grade: number | null;
    gradeComment: string | null;
    gradedAt: Date | null;
    gradedByUserId: string | null;
  }) {
    return {
      id: row.id,
      assignmentId: row.assignmentId,
      email: row.email,
      body: row.body,
      videoUrl: row.videoUrl,
      submittedAt: row.submittedAt,
      updatedAt: row.updatedAt,
      grade: row.grade,
      gradeComment: row.gradeComment,
      gradedAt: row.gradedAt,
      gradedByUserId: row.gradedByUserId,
    };
  }

  private serializeVideoSummary(row: {
    id: string;
    title: string;
    url: string;
    description: string | null;
    uploadedByEmail: string;
    assignmentId: string | null;
    createdAt: Date;
    updatedAt: Date;
    _count?: { markers: number };
  }) {
    return {
      id: row.id,
      title: row.title,
      url: row.url,
      description: row.description,
      uploadedByEmail: row.uploadedByEmail,
      assignmentId: row.assignmentId,
      markerCount: row._count?.markers ?? 0,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    };
  }

  private serializeMarker(row: {
    id: string;
    videoId: string;
    timeSec: number;
    body: string;
    authorEmail: string;
    createdAt: Date;
    updatedAt: Date;
  }) {
    return {
      id: row.id,
      videoId: row.videoId,
      timeSec: row.timeSec,
      body: row.body,
      authorEmail: row.authorEmail,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    };
  }

  private isInviteActive(invite: {
    revokedAt: Date | null;
    acceptedAt: Date | null;
    expiresAt: Date | null;
  }): boolean {
    if (invite.revokedAt) return false;
    if (invite.acceptedAt) return false;
    if (invite.expiresAt && invite.expiresAt.getTime() <= Date.now()) {
      return false;
    }
    return true;
  }

  private async findInviteByToken(rawToken: string) {
    const raw = String(rawToken ?? '').trim();
    if (!raw) throw new BadRequestException('Invalid token');
    const tokenHash = sha256Base64Url(raw);
    const invite = await this.prisma.studioInvite.findUnique({
      where: { tokenHash },
      include: {
        studio: { select: { id: true, title: true } },
      },
    });
    if (!invite) throw new NotFoundException('Invite not found');
    return { invite, rawToken: raw };
  }

  async listStudios(userId: string, userEmail: string) {
    const email = normalizeEmail(userEmail);
    const rows = await this.prisma.studio.findMany({
      where: {
        OR: [
          { ownerUserId: userId },
          { members: { some: { OR: [{ userId }, { email }] } } },
        ],
      },
      orderBy: { updatedAt: 'desc' },
      select: {
        id: true,
        title: true,
        description: true,
        imageUrl: true,
        ownerUserId: true,
        createdAt: true,
        updatedAt: true,
        members: {
          where: { OR: [{ userId }, { email }] },
          select: { role: true },
          take: 1,
        },
      },
    });

    return {
      studios: rows.map((row) => {
        const myRole: StudioMemberRole =
          row.ownerUserId === userId
            ? 'owner'
            : (row.members[0]?.role ?? 'student');
        return {
          id: row.id,
          title: row.title,
          description: row.description,
          imageUrl: row.imageUrl,
          ownerUserId: row.ownerUserId,
          myRole,
          canManage: this.canManageRole(myRole),
          createdAt: row.createdAt,
          updatedAt: row.updatedAt,
        };
      }),
    };
  }

  async createStudio(userId: string, userEmail: string, body: CreateStudioDto) {
    const title = String(body.title ?? '').trim();
    if (!title) throw new BadRequestException('title is required');
    const email = normalizeEmail(userEmail);

    const studioId = await this.prisma.$transaction(async (tx) => {
      const studio = await tx.studio.create({
        data: {
          ownerUserId: userId,
          title,
          description: body.description?.trim() || null,
        },
      });
      await tx.studioMember.create({
        data: {
          studioId: studio.id,
          email,
          userId,
          role: 'owner',
        },
      });
      return studio.id;
    });

    return this.getStudio(userId, userEmail, studioId);
  }

  async getStudio(userId: string, userEmail: string, studioId: string) {
    const access = await this.resolveStudioAccess(userId, userEmail, studioId);

    const memberRows = await this.prisma.studioMember.findMany({
      where: { studioId },
      orderBy: [{ role: 'asc' }, { email: 'asc' }],
    });
    const profileByEmail = await this.buildProfileMap(
      memberRows.map((m) => m.email),
    );
    const members = memberRows.map((m) =>
      this.serializeMember(m, profileByEmail),
    );

    const modules = await this.prisma.studioProgramModule.findMany({
      where: { studioId },
      orderBy: { sortOrder: 'asc' },
      include: { lessons: { orderBy: { sortOrder: 'asc' } } },
    });

    const assignmentWhere = access.canManage
      ? { studioId }
      : {
          studioId,
          targets: { some: { email: access.myEmail } },
        };

    const assignments = await this.prisma.studioAssignment.findMany({
      where: assignmentWhere,
      orderBy: { createdAt: 'desc' },
      include: {
        targets: { select: { email: true } },
        submissions: { select: { email: true, grade: true } },
      },
    });

    const videos = await this.prisma.studioVideo.findMany({
      where: { studioId },
      orderBy: { createdAt: 'desc' },
      include: { _count: { select: { markers: true } } },
    });

    return {
      id: access.studio.id,
      title: access.studio.title,
      description: access.studio.description,
      imageUrl: access.studio.imageUrl,
      ownerUserId: access.studio.ownerUserId,
      createdAt: access.studio.createdAt,
      updatedAt: access.studio.updatedAt,
      myRole: access.myRole,
      canManage: access.canManage,
      members,
      modules: modules.map((m) => this.serializeModule(m)),
      assignments: assignments.map((a) =>
        this.serializeAssignmentSummary(a, access.myEmail, access.canManage),
      ),
      videos: videos.map((v) => this.serializeVideoSummary(v)),
    };
  }

  async updateStudio(
    userId: string,
    userEmail: string,
    studioId: string,
    body: UpdateStudioDto,
  ) {
    const access = await this.resolveStudioAccess(userId, userEmail, studioId);
    this.assertOwner(access, userId);

    const data: {
      title?: string;
      description?: string | null;
      imageUrl?: string | null;
    } = {};
    if (body.title !== undefined) {
      const title = String(body.title).trim();
      if (!title) throw new BadRequestException('title is required');
      data.title = title;
    }
    if (body.description !== undefined) {
      data.description = body.description?.trim() || null;
    }
    if (body.imageUrl !== undefined) {
      const imageUrl = body.imageUrl?.trim() || null;
      data.imageUrl = imageUrl;
    }

    await this.prisma.studio.update({ where: { id: studioId }, data });
    return this.getStudio(userId, userEmail, studioId);
  }

  async deleteStudio(userId: string, userEmail: string, studioId: string) {
    const access = await this.resolveStudioAccess(userId, userEmail, studioId);
    this.assertOwner(access, userId);
    await this.prisma.studio.delete({ where: { id: studioId } });
    return { ok: true };
  }

  async addMember(
    userId: string,
    userEmail: string,
    studioId: string,
    body: AddMemberDto,
  ) {
    const access = await this.resolveStudioAccess(userId, userEmail, studioId);
    this.assertCanManage(access);

    const email = normalizeEmail(body.email);
    const existing = await this.prisma.studioMember.findUnique({
      where: { studioId_email: { studioId, email } },
      select: { id: true, role: true },
    });
    if (existing) {
      if (existing.role === 'owner') {
        throw new BadRequestException('Owner already exists');
      }
      throw new BadRequestException('Member already exists');
    }

    const resolvedUserId = await this.resolveUserIdByEmail(email);
    const member = await this.prisma.studioMember.create({
      data: {
        studioId,
        email,
        userId: resolvedUserId,
        role: body.role,
      },
    });

    const profileByEmail = await this.buildProfileMap([email]);
    return this.serializeMember(member, profileByEmail);
  }

  async updateMember(
    userId: string,
    userEmail: string,
    studioId: string,
    memberId: string,
    body: UpdateMemberDto,
  ) {
    const access = await this.resolveStudioAccess(userId, userEmail, studioId);
    this.assertCanManage(access);

    const member = await this.prisma.studioMember.findFirst({
      where: { id: memberId, studioId },
    });
    if (!member) throw new NotFoundException('Member not found');
    if (member.role === 'owner') {
      throw new BadRequestException('Cannot change owner role');
    }

    const updated = await this.prisma.studioMember.update({
      where: { id: memberId },
      data: { role: body.role },
    });
    const profileByEmail = await this.buildProfileMap([updated.email]);
    return this.serializeMember(updated, profileByEmail);
  }

  async removeMember(
    userId: string,
    userEmail: string,
    studioId: string,
    memberId: string,
  ) {
    const access = await this.resolveStudioAccess(userId, userEmail, studioId);
    this.assertCanManage(access);

    const member = await this.prisma.studioMember.findFirst({
      where: { id: memberId, studioId },
    });
    if (!member) throw new NotFoundException('Member not found');
    if (member.role === 'owner') {
      throw new BadRequestException('Cannot remove owner');
    }

    await this.prisma.studioMember.delete({ where: { id: memberId } });
    return { ok: true };
  }

  async createInvite(
    userId: string,
    userEmail: string,
    studioId: string,
    body: CreateInviteDto,
  ) {
    const access = await this.resolveStudioAccess(userId, userEmail, studioId);
    this.assertCanManage(access);

    const rawToken = crypto.randomBytes(32).toString('base64url');
    const tokenHash = sha256Base64Url(rawToken);
    const email = body.email ? normalizeEmail(body.email) : null;
    let expiresAt: Date | null = null;
    if (body.expiresInDays != null) {
      expiresAt = new Date(
        Date.now() + Math.max(1, body.expiresInDays) * 24 * 60 * 60 * 1000,
      );
    }

    const invite = await this.prisma.studioInvite.create({
      data: {
        studioId,
        tokenHash,
        role: body.role,
        email,
        createdByUserId: userId,
        expiresAt,
      },
    });

    return {
      id: invite.id,
      token: rawToken,
      invitePath: `/studio/invite/${rawToken}`,
      role: invite.role,
      email: invite.email,
      expiresAt: invite.expiresAt,
    };
  }

  async listInvites(userId: string, userEmail: string, studioId: string) {
    const access = await this.resolveStudioAccess(userId, userEmail, studioId);
    this.assertCanManage(access);

    const now = new Date();
    const rows = await this.prisma.studioInvite.findMany({
      where: {
        studioId,
        revokedAt: null,
        acceptedAt: null,
        OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
      },
      orderBy: { createdAt: 'desc' },
    });

    return {
      invites: rows.map((row) => ({
        id: row.id,
        role: row.role,
        email: row.email,
        expiresAt: row.expiresAt,
        createdAt: row.createdAt,
      })),
    };
  }

  async revokeInvite(
    userId: string,
    userEmail: string,
    studioId: string,
    inviteId: string,
  ) {
    const access = await this.resolveStudioAccess(userId, userEmail, studioId);
    this.assertCanManage(access);

    const invite = await this.prisma.studioInvite.findFirst({
      where: { id: inviteId, studioId },
    });
    if (!invite) throw new NotFoundException('Invite not found');

    await this.prisma.studioInvite.update({
      where: { id: inviteId },
      data: { revokedAt: new Date() },
    });
    return { ok: true };
  }

  async previewInvite(userId: string, userEmail: string, token: string) {
    const { invite } = await this.findInviteByToken(token);
    const myEmail = normalizeEmail(userEmail);
    const inviteEmail = invite.email?.trim().toLowerCase() ?? null;
    const emailMatches =
      inviteEmail == null ? true : inviteEmail === myEmail;

    return {
      studioId: invite.studio.id,
      studioTitle: invite.studio.title,
      role: invite.role,
      email: invite.email,
      emailMatches,
      isActive: this.isInviteActive(invite),
      expiresAt: invite.expiresAt,
    };
  }

  async acceptInvite(userId: string, userEmail: string, token: string) {
    const { invite } = await this.findInviteByToken(token);
    const myEmail = normalizeEmail(userEmail);

    if (invite.revokedAt) {
      throw new BadRequestException('Invite revoked');
    }
    if (invite.acceptedAt) {
      throw new BadRequestException('Invite already accepted');
    }
    if (invite.expiresAt && invite.expiresAt.getTime() <= Date.now()) {
      throw new BadRequestException('Invite expired');
    }
    if (invite.email && invite.email.trim().toLowerCase() !== myEmail) {
      throw new ForbiddenException('Invite email does not match');
    }

    const now = new Date();
    await this.prisma.$transaction(async (tx) => {
      await tx.studioInvite.update({
        where: { id: invite.id },
        data: { acceptedAt: now },
      });

      const existing = await tx.studioMember.findUnique({
        where: {
          studioId_email: { studioId: invite.studioId, email: myEmail },
        },
      });

      if (existing) {
        if (existing.role !== 'owner') {
          await tx.studioMember.update({
            where: { id: existing.id },
            data: { role: invite.role, userId },
          });
        } else {
          await tx.studioMember.update({
            where: { id: existing.id },
            data: { userId },
          });
        }
      } else {
        await tx.studioMember.create({
          data: {
            studioId: invite.studioId,
            email: myEmail,
            userId,
            role: invite.role,
          },
        });
      }
    });

    return this.getStudio(userId, userEmail, invite.studioId);
  }

  async createModule(
    userId: string,
    userEmail: string,
    studioId: string,
    body: CreateModuleDto,
  ) {
    const access = await this.resolveStudioAccess(userId, userEmail, studioId);
    this.assertCanManage(access);

    const title = String(body.title ?? '').trim();
    if (!title) throw new BadRequestException('title is required');

    const last = await this.prisma.studioProgramModule.findFirst({
      where: { studioId },
      orderBy: { sortOrder: 'desc' },
      select: { sortOrder: true },
    });
    const sortOrder = (last?.sortOrder ?? 0) + 10;

    const module = await this.prisma.studioProgramModule.create({
      data: {
        studioId,
        title,
        description: body.description?.trim() || null,
        imageUrl: body.imageUrl?.trim() || null,
        sortOrder,
      },
      include: { lessons: true },
    });

    return this.serializeModule(module);
  }

  async updateModule(
    userId: string,
    userEmail: string,
    studioId: string,
    moduleId: string,
    body: UpdateModuleDto,
  ) {
    const access = await this.resolveStudioAccess(userId, userEmail, studioId);
    this.assertCanManage(access);

    const module = await this.prisma.studioProgramModule.findFirst({
      where: { id: moduleId, studioId },
    });
    if (!module) throw new NotFoundException('Module not found');

    const data: {
      title?: string;
      description?: string | null;
      imageUrl?: string | null;
    } = {};
    if (body.title !== undefined) {
      const title = String(body.title).trim();
      if (!title) throw new BadRequestException('title is required');
      data.title = title;
    }
    if (body.description !== undefined) {
      data.description = body.description?.trim() || null;
    }
    if (body.imageUrl !== undefined) {
      data.imageUrl = body.imageUrl?.trim() || null;
    }

    const updated = await this.prisma.studioProgramModule.update({
      where: { id: moduleId },
      data,
      include: { lessons: { orderBy: { sortOrder: 'asc' } } },
    });
    return this.serializeModule(updated);
  }

  async deleteModule(
    userId: string,
    userEmail: string,
    studioId: string,
    moduleId: string,
  ) {
    const access = await this.resolveStudioAccess(userId, userEmail, studioId);
    this.assertCanManage(access);

    const module = await this.prisma.studioProgramModule.findFirst({
      where: { id: moduleId, studioId },
    });
    if (!module) throw new NotFoundException('Module not found');

    await this.prisma.studioProgramModule.delete({ where: { id: moduleId } });
    return { ok: true };
  }

  async createLesson(
    userId: string,
    userEmail: string,
    studioId: string,
    moduleId: string,
    body: CreateLessonDto,
  ) {
    const access = await this.resolveStudioAccess(userId, userEmail, studioId);
    this.assertCanManage(access);

    const module = await this.prisma.studioProgramModule.findFirst({
      where: { id: moduleId, studioId },
    });
    if (!module) throw new NotFoundException('Module not found');

    const title = String(body.title ?? '').trim();
    if (!title) throw new BadRequestException('title is required');

    const last = await this.prisma.studioProgramLesson.findFirst({
      where: { moduleId },
      orderBy: { sortOrder: 'desc' },
      select: { sortOrder: true },
    });
    const sortOrder = (last?.sortOrder ?? 0) + 10;

    const lesson = await this.prisma.studioProgramLesson.create({
      data: {
        moduleId,
        title,
        body: body.body?.trim() || null,
        taskType: body.taskType ?? 'complete',
        taskPrompt: body.taskPrompt?.trim() || null,
        sortOrder,
      },
    });
    return this.serializeLesson(lesson);
  }

  async updateLesson(
    userId: string,
    userEmail: string,
    studioId: string,
    moduleId: string,
    lessonId: string,
    body: UpdateLessonDto,
  ) {
    const access = await this.resolveStudioAccess(userId, userEmail, studioId);
    this.assertCanManage(access);

    const lesson = await this.prisma.studioProgramLesson.findFirst({
      where: { id: lessonId, moduleId, module: { studioId } },
    });
    if (!lesson) throw new NotFoundException('Lesson not found');

    const data: {
      title?: string;
      body?: string | null;
      taskType?: 'complete' | 'video';
      taskPrompt?: string | null;
    } = {};
    if (body.title !== undefined) {
      const title = String(body.title).trim();
      if (!title) throw new BadRequestException('title is required');
      data.title = title;
    }
    if (body.body !== undefined) {
      data.body = body.body?.trim() || null;
    }
    if (body.taskType !== undefined) {
      data.taskType = body.taskType;
    }
    if (body.taskPrompt !== undefined) {
      data.taskPrompt = body.taskPrompt?.trim() || null;
    }

    const updated = await this.prisma.studioProgramLesson.update({
      where: { id: lessonId },
      data,
    });
    return this.serializeLesson(updated);
  }

  async deleteLesson(
    userId: string,
    userEmail: string,
    studioId: string,
    moduleId: string,
    lessonId: string,
  ) {
    const access = await this.resolveStudioAccess(userId, userEmail, studioId);
    this.assertCanManage(access);

    const lesson = await this.prisma.studioProgramLesson.findFirst({
      where: { id: lessonId, moduleId, module: { studioId } },
    });
    if (!lesson) throw new NotFoundException('Lesson not found');

    await this.prisma.studioProgramLesson.delete({ where: { id: lessonId } });
    return { ok: true };
  }

  async getLesson(
    userId: string,
    userEmail: string,
    studioId: string,
    moduleId: string,
    lessonId: string,
  ) {
    const access = await this.resolveStudioAccess(userId, userEmail, studioId);

    const lesson = await this.prisma.studioProgramLesson.findFirst({
      where: { id: lessonId, moduleId, module: { studioId } },
      include: {
        module: { select: { id: true, title: true } },
      },
    });
    if (!lesson) throw new NotFoundException('Lesson not found');

    const myProgressRow = await this.prisma.studioLessonProgress.findUnique({
      where: {
        lessonId_email: {
          lessonId,
          email: access.myEmail,
        },
      },
    });

    let roster: Array<{
      email: string;
      displayName: string;
      avatarUrl: string | null;
      role: StudioMemberRole;
      progress: ReturnType<StudioService['serializeLessonProgress']> | null;
    }> | null = null;
    let stats: {
      totalStudents: number;
      pending: number;
      submitted: number;
      completed: number;
      rejected: number;
    } | null = null;

    if (access.canManage) {
      const students = await this.prisma.studioMember.findMany({
        where: { studioId, role: 'student' },
        orderBy: { email: 'asc' },
      });
      const progressRows = await this.prisma.studioLessonProgress.findMany({
        where: { lessonId },
      });
      const progressByEmail = new Map(
        progressRows.map((row) => [row.email.trim().toLowerCase(), row]),
      );
      const profileByEmail = await this.buildProfileMap(
        students.map((s) => s.email),
      );

      roster = students.map((student) => {
        const email = student.email.trim().toLowerCase();
        const progress = progressByEmail.get(email) ?? null;
        return {
          email,
          displayName: this.formatRecipientName(email, profileByEmail),
          avatarUrl: profileByEmail.get(email)?.avatarUrl?.trim() || null,
          role: student.role,
          progress: progress ? this.serializeLessonProgress(progress) : null,
        };
      });

      let pending = 0;
      let submitted = 0;
      let completed = 0;
      let rejected = 0;
      for (const item of roster) {
        const status = item.progress?.status ?? 'pending';
        if (status === 'submitted') submitted += 1;
        else if (status === 'completed') completed += 1;
        else if (status === 'rejected') rejected += 1;
        else pending += 1;
      }
      stats = {
        totalStudents: roster.length,
        pending,
        submitted,
        completed,
        rejected,
      };
    }

    return {
      ...this.serializeLesson(lesson),
      module: {
        id: lesson.module.id,
        title: lesson.module.title,
      },
      studioId,
      canManage: access.canManage,
      myRole: access.myRole,
      myProgress: myProgressRow
        ? this.serializeLessonProgress(myProgressRow)
        : null,
      roster,
      stats,
    };
  }

  async submitLesson(
    userId: string,
    userEmail: string,
    studioId: string,
    moduleId: string,
    lessonId: string,
    body: SubmitLessonDto,
  ) {
    const access = await this.resolveStudioAccess(userId, userEmail, studioId);

    const lesson = await this.prisma.studioProgramLesson.findFirst({
      where: { id: lessonId, moduleId, module: { studioId } },
    });
    if (!lesson) throw new NotFoundException('Lesson not found');

    if (body.mode !== lesson.taskType) {
      throw new BadRequestException('Неверный способ сдачи для этого урока');
    }

    const now = new Date();
    const note = body.note?.trim() || null;

    if (body.mode === 'complete') {
      const progress = await this.prisma.studioLessonProgress.upsert({
        where: {
          lessonId_email: {
            lessonId,
            email: access.myEmail,
          },
        },
        create: {
          lessonId,
          email: access.myEmail,
          status: 'completed',
          note,
          submittedAt: now,
          completedAt: now,
        },
        update: {
          status: 'completed',
          note,
          videoUrl: null,
          submittedAt: now,
          completedAt: now,
          reviewedAt: null,
          reviewedByUserId: null,
          reviewComment: null,
        },
      });
      return this.serializeLessonProgress(progress);
    }

    const videoUrl = body.videoUrl?.trim() || '';
    if (!videoUrl) {
      throw new BadRequestException('Укажите ссылку на видео');
    }

    const progress = await this.prisma.studioLessonProgress.upsert({
      where: {
        lessonId_email: {
          lessonId,
          email: access.myEmail,
        },
      },
      create: {
        lessonId,
        email: access.myEmail,
        status: 'submitted',
        videoUrl,
        note,
        submittedAt: now,
        completedAt: null,
      },
      update: {
        status: 'submitted',
        videoUrl,
        note,
        submittedAt: now,
        completedAt: null,
        reviewedAt: null,
        reviewedByUserId: null,
        reviewComment: null,
      },
    });
    return this.serializeLessonProgress(progress);
  }

  async reviewLessonProgress(
    userId: string,
    userEmail: string,
    studioId: string,
    moduleId: string,
    lessonId: string,
    progressId: string,
    body: ReviewLessonProgressDto,
  ) {
    const access = await this.resolveStudioAccess(userId, userEmail, studioId);
    this.assertCanManage(access);

    const lesson = await this.prisma.studioProgramLesson.findFirst({
      where: { id: lessonId, moduleId, module: { studioId } },
      select: { id: true },
    });
    if (!lesson) throw new NotFoundException('Lesson not found');

    const progress = await this.prisma.studioLessonProgress.findFirst({
      where: { id: progressId, lessonId },
    });
    if (!progress) throw new NotFoundException('Progress not found');

    const now = new Date();
    const updated = await this.prisma.studioLessonProgress.update({
      where: { id: progressId },
      data: {
        status: body.status,
        completedAt: body.status === 'completed' ? now : null,
        reviewedAt: now,
        reviewedByUserId: userId,
        reviewComment: body.reviewComment?.trim() || null,
      },
    });
    return this.serializeLessonProgress(updated);
  }

  private async loadAssignment(studioId: string, assignmentId: string) {
    const assignment = await this.prisma.studioAssignment.findFirst({
      where: { id: assignmentId, studioId },
      include: {
        targets: true,
        submissions: true,
      },
    });
    if (!assignment) throw new NotFoundException('Assignment not found');
    return assignment;
  }

  private isAssignmentTargeted(
    assignment: { targets: Array<{ email: string }> },
    email: string,
  ): boolean {
    return assignment.targets.some(
      (t) => t.email.trim().toLowerCase() === email,
    );
  }

  private canSubmitToAssignment(
    access: StudioAccess,
    assignment: { targets: Array<{ email: string }> },
  ): boolean {
    const isTargeted = this.isAssignmentTargeted(assignment, access.myEmail);
    if (isTargeted) return true;
    return access.myRole === 'student';
  }

  private assertCanViewAssignment(
    access: StudioAccess,
    assignment: { targets: Array<{ email: string }> },
  ) {
    if (access.canManage) return;
    if (this.isAssignmentTargeted(assignment, access.myEmail)) return;
    throw new ForbiddenException('Assignment not available');
  }

  async createAssignment(
    userId: string,
    userEmail: string,
    studioId: string,
    body: CreateAssignmentDto,
  ) {
    const access = await this.resolveStudioAccess(userId, userEmail, studioId);
    this.assertCanManage(access);

    const title = String(body.title ?? '').trim();
    if (!title) throw new BadRequestException('title is required');

    const targetEmails = [
      ...new Set(
        (body.targetEmails ?? []).map((e) => normalizeEmail(e)),
      ),
    ];
    if (targetEmails.length === 0) {
      throw new BadRequestException('At least one target email is required');
    }

    if (body.lessonId) {
      const lesson = await this.prisma.studioProgramLesson.findFirst({
        where: { id: body.lessonId, module: { studioId } },
        select: { id: true },
      });
      if (!lesson) throw new BadRequestException('Invalid lessonId');
    }

    const dueAt = parseOptionalDate(body.dueAt);

    const assignmentId = await this.prisma.$transaction(async (tx) => {
      const assignment = await tx.studioAssignment.create({
        data: {
          studioId,
          title,
          description: body.description?.trim() || null,
          createdByUserId: userId,
          lessonId: body.lessonId || null,
          dueAt,
        },
      });
      await tx.studioAssignmentTarget.createMany({
        data: targetEmails.map((email) => ({
          assignmentId: assignment.id,
          email,
        })),
      });
      return assignment.id;
    });

    return this.getAssignment(userId, userEmail, studioId, assignmentId);
  }

  async listAssignments(userId: string, userEmail: string, studioId: string) {
    const access = await this.resolveStudioAccess(userId, userEmail, studioId);

    const where = access.canManage
      ? { studioId }
      : { studioId, targets: { some: { email: access.myEmail } } };

    const rows = await this.prisma.studioAssignment.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: {
        targets: { select: { email: true } },
        submissions: { select: { email: true, grade: true } },
      },
    });

    return {
      assignments: rows.map((row) =>
        this.serializeAssignmentSummary(row, access.myEmail, access.canManage),
      ),
    };
  }

  async getAssignment(
    userId: string,
    userEmail: string,
    studioId: string,
    assignmentId: string,
  ) {
    const access = await this.resolveStudioAccess(userId, userEmail, studioId);
    const assignment = await this.loadAssignment(studioId, assignmentId);
    this.assertCanViewAssignment(access, assignment);

    const targetEmails = assignment.targets.map((t) =>
      t.email.trim().toLowerCase(),
    );

    let submissions = assignment.submissions;
    if (!access.canManage) {
      submissions = submissions.filter((s) => s.email === access.myEmail);
    }

    return {
      id: assignment.id,
      title: assignment.title,
      description: assignment.description,
      lessonId: assignment.lessonId,
      dueAt: assignment.dueAt,
      targetEmails,
      createdAt: assignment.createdAt,
      updatedAt: assignment.updatedAt,
      submissions: submissions.map((s) => this.serializeSubmission(s)),
      canSubmit: this.canSubmitToAssignment(access, assignment),
    };
  }

  async updateAssignment(
    userId: string,
    userEmail: string,
    studioId: string,
    assignmentId: string,
    body: UpdateAssignmentDto,
  ) {
    const access = await this.resolveStudioAccess(userId, userEmail, studioId);
    this.assertCanManage(access);
    await this.loadAssignment(studioId, assignmentId);

    const data: {
      title?: string;
      description?: string | null;
      lessonId?: string | null;
      dueAt?: Date | null;
    } = {};

    if (body.title !== undefined) {
      const title = String(body.title).trim();
      if (!title) throw new BadRequestException('title is required');
      data.title = title;
    }
    if (body.description !== undefined) {
      data.description = body.description?.trim() || null;
    }
    if (body.lessonId !== undefined) {
      if (body.lessonId) {
        const lesson = await this.prisma.studioProgramLesson.findFirst({
          where: { id: body.lessonId, module: { studioId } },
          select: { id: true },
        });
        if (!lesson) throw new BadRequestException('Invalid lessonId');
        data.lessonId = body.lessonId;
      } else {
        data.lessonId = null;
      }
    }
    if (body.dueAt !== undefined) {
      data.dueAt = parseOptionalDate(body.dueAt);
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.studioAssignment.update({
        where: { id: assignmentId },
        data,
      });
      if (body.targetEmails !== undefined) {
        const targetEmails = [
          ...new Set(
            body.targetEmails.map((e) => normalizeEmail(e)),
          ),
        ];
        if (targetEmails.length === 0) {
          throw new BadRequestException('At least one target email is required');
        }
        await tx.studioAssignmentTarget.deleteMany({
          where: { assignmentId },
        });
        await tx.studioAssignmentTarget.createMany({
          data: targetEmails.map((email) => ({ assignmentId, email })),
        });
      }
    });

    return this.getAssignment(userId, userEmail, studioId, assignmentId);
  }

  async deleteAssignment(
    userId: string,
    userEmail: string,
    studioId: string,
    assignmentId: string,
  ) {
    const access = await this.resolveStudioAccess(userId, userEmail, studioId);
    this.assertCanManage(access);
    await this.loadAssignment(studioId, assignmentId);
    await this.prisma.studioAssignment.delete({ where: { id: assignmentId } });
    return { ok: true };
  }

  async submitAssignment(
    userId: string,
    userEmail: string,
    studioId: string,
    assignmentId: string,
    body: SubmitAssignmentDto,
  ) {
    const access = await this.resolveStudioAccess(userId, userEmail, studioId);
    const assignment = await this.loadAssignment(studioId, assignmentId);
    this.assertCanViewAssignment(access, assignment);

    if (!this.canSubmitToAssignment(access, assignment)) {
      throw new ForbiddenException('Cannot submit this assignment');
    }

    const hasBody = body.body != null && String(body.body).trim() !== '';
    const hasVideo = body.videoUrl != null && String(body.videoUrl).trim() !== '';
    if (!hasBody && !hasVideo) {
      throw new BadRequestException('body or videoUrl is required');
    }

    const submission = await this.prisma.studioSubmission.upsert({
      where: {
        assignmentId_email: {
          assignmentId,
          email: access.myEmail,
        },
      },
      create: {
        assignmentId,
        email: access.myEmail,
        body: hasBody ? String(body.body).trim() : null,
        videoUrl: hasVideo ? String(body.videoUrl).trim() : null,
      },
      update: {
        body: hasBody ? String(body.body).trim() : null,
        videoUrl: hasVideo ? String(body.videoUrl).trim() : null,
        submittedAt: new Date(),
      },
    });

    return this.serializeSubmission(submission);
  }

  async gradeSubmission(
    userId: string,
    userEmail: string,
    studioId: string,
    assignmentId: string,
    submissionId: string,
    body: GradeSubmissionDto,
  ) {
    const access = await this.resolveStudioAccess(userId, userEmail, studioId);
    this.assertCanManage(access);
    await this.loadAssignment(studioId, assignmentId);

    const submission = await this.prisma.studioSubmission.findFirst({
      where: { id: submissionId, assignmentId },
    });
    if (!submission) throw new NotFoundException('Submission not found');

    const updated = await this.prisma.studioSubmission.update({
      where: { id: submissionId },
      data: {
        grade: body.grade,
        gradeComment: body.gradeComment?.trim() || null,
        gradedAt: new Date(),
        gradedByUserId: userId,
      },
    });

    return this.serializeSubmission(updated);
  }

  async createVideo(
    userId: string,
    userEmail: string,
    studioId: string,
    body: CreateVideoDto,
  ) {
    const access = await this.resolveStudioAccess(userId, userEmail, studioId);

    const title = String(body.title ?? '').trim();
    if (!title) throw new BadRequestException('title is required');
    const url = String(body.url ?? '').trim();
    if (!url) throw new BadRequestException('url is required');

    if (body.assignmentId) {
      await this.loadAssignment(studioId, body.assignmentId);
    }

    const video = await this.prisma.studioVideo.create({
      data: {
        studioId,
        title,
        url,
        description: body.description?.trim() || null,
        uploadedByEmail: access.myEmail,
        assignmentId: body.assignmentId || null,
      },
      include: { _count: { select: { markers: true } } },
    });

    return this.serializeVideoSummary(video);
  }

  async listVideos(userId: string, userEmail: string, studioId: string) {
    const access = await this.resolveStudioAccess(userId, userEmail, studioId);

    const rows = await this.prisma.studioVideo.findMany({
      where: { studioId },
      orderBy: { createdAt: 'desc' },
      include: { _count: { select: { markers: true } } },
    });

    return {
      videos: rows.map((row) => this.serializeVideoSummary(row)),
    };
  }

  async getVideo(
    userId: string,
    userEmail: string,
    studioId: string,
    videoId: string,
  ) {
    const access = await this.resolveStudioAccess(userId, userEmail, studioId);

    const video = await this.prisma.studioVideo.findFirst({
      where: { id: videoId, studioId },
      include: {
        markers: { orderBy: { timeSec: 'asc' } },
      },
    });
    if (!video) throw new NotFoundException('Video not found');

    return {
      ...this.serializeVideoSummary({
        ...video,
        _count: { markers: video.markers.length },
      }),
      markers: video.markers.map((m) => this.serializeMarker(m)),
      canManage: access.canManage,
      myEmail: access.myEmail,
    };
  }

  async updateVideo(
    userId: string,
    userEmail: string,
    studioId: string,
    videoId: string,
    body: UpdateVideoDto,
  ) {
    const access = await this.resolveStudioAccess(userId, userEmail, studioId);

    const video = await this.prisma.studioVideo.findFirst({
      where: { id: videoId, studioId },
    });
    if (!video) throw new NotFoundException('Video not found');

    const isAuthor = video.uploadedByEmail === access.myEmail;
    if (!access.canManage && !isAuthor) {
      throw new ForbiddenException('Cannot edit this video');
    }

    const data: {
      title?: string;
      url?: string;
      description?: string | null;
      assignmentId?: string | null;
    } = {};

    if (body.title !== undefined) {
      const title = String(body.title).trim();
      if (!title) throw new BadRequestException('title is required');
      data.title = title;
    }
    if (body.url !== undefined) {
      const url = String(body.url).trim();
      if (!url) throw new BadRequestException('url is required');
      data.url = url;
    }
    if (body.description !== undefined) {
      data.description = body.description?.trim() || null;
    }
    if (body.assignmentId !== undefined) {
      if (body.assignmentId) {
        await this.loadAssignment(studioId, body.assignmentId);
        data.assignmentId = body.assignmentId;
      } else {
        data.assignmentId = null;
      }
    }

    const updated = await this.prisma.studioVideo.update({
      where: { id: videoId },
      data,
      include: { _count: { select: { markers: true } } },
    });

    return this.serializeVideoSummary(updated);
  }

  async deleteVideo(
    userId: string,
    userEmail: string,
    studioId: string,
    videoId: string,
  ) {
    const access = await this.resolveStudioAccess(userId, userEmail, studioId);

    const video = await this.prisma.studioVideo.findFirst({
      where: { id: videoId, studioId },
    });
    if (!video) throw new NotFoundException('Video not found');

    const isAuthor = video.uploadedByEmail === access.myEmail;
    if (!access.canManage && !isAuthor) {
      throw new ForbiddenException('Cannot delete this video');
    }

    await this.prisma.studioVideo.delete({ where: { id: videoId } });
    return { ok: true };
  }

  async createMarker(
    userId: string,
    userEmail: string,
    studioId: string,
    videoId: string,
    body: CreateMarkerDto,
  ) {
    const access = await this.resolveStudioAccess(userId, userEmail, studioId);

    const video = await this.prisma.studioVideo.findFirst({
      where: { id: videoId, studioId },
      select: { id: true },
    });
    if (!video) throw new NotFoundException('Video not found');

    const marker = await this.prisma.studioVideoMarker.create({
      data: {
        videoId,
        timeSec: body.timeSec,
        body: String(body.body).trim(),
        authorEmail: access.myEmail,
      },
    });

    return this.serializeMarker(marker);
  }

  async updateMarker(
    userId: string,
    userEmail: string,
    studioId: string,
    videoId: string,
    markerId: string,
    body: UpdateMarkerDto,
  ) {
    const access = await this.resolveStudioAccess(userId, userEmail, studioId);

    const marker = await this.prisma.studioVideoMarker.findFirst({
      where: { id: markerId, videoId, video: { studioId } },
    });
    if (!marker) throw new NotFoundException('Marker not found');

    const isAuthor = marker.authorEmail === access.myEmail;
    if (!access.canManage && !isAuthor) {
      throw new ForbiddenException('Cannot edit this marker');
    }

    const data: { timeSec?: number; body?: string } = {};
    if (body.timeSec !== undefined) data.timeSec = body.timeSec;
    if (body.body !== undefined) {
      const text = String(body.body).trim();
      if (!text) throw new BadRequestException('body is required');
      data.body = text;
    }

    const updated = await this.prisma.studioVideoMarker.update({
      where: { id: markerId },
      data,
    });

    return this.serializeMarker(updated);
  }

  async deleteMarker(
    userId: string,
    userEmail: string,
    studioId: string,
    videoId: string,
    markerId: string,
  ) {
    const access = await this.resolveStudioAccess(userId, userEmail, studioId);

    const marker = await this.prisma.studioVideoMarker.findFirst({
      where: { id: markerId, videoId, video: { studioId } },
    });
    if (!marker) throw new NotFoundException('Marker not found');

    const isAuthor = marker.authorEmail === access.myEmail;
    if (!access.canManage && !isAuthor) {
      throw new ForbiddenException('Cannot delete this marker');
    }

    await this.prisma.studioVideoMarker.delete({ where: { id: markerId } });
    return { ok: true };
  }
}
