export type StudioMemberRole = "owner" | "teacher" | "student";

export type StudioMemberItem = {
  id: string;
  email: string;
  userId: string | null;
  role: StudioMemberRole;
  displayName: string;
  avatarUrl: string | null;
  createdAt: string;
  updatedAt: string;
};

export type StudioLessonTaskType = "complete" | "video";

export type StudioLessonProgressStatus =
  | "pending"
  | "submitted"
  | "completed"
  | "rejected";

export type StudioProgramLesson = {
  id: string;
  moduleId: string;
  title: string;
  body: string | null;
  taskType: StudioLessonTaskType;
  taskPrompt: string | null;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
};

export type StudioLessonProgress = {
  id: string;
  lessonId: string;
  email: string;
  status: StudioLessonProgressStatus;
  videoUrl: string | null;
  note: string | null;
  submittedAt: string | null;
  completedAt: string | null;
  reviewedAt: string | null;
  reviewedByUserId: string | null;
  reviewComment: string | null;
  createdAt: string;
  updatedAt: string;
};

export type StudioLessonRosterItem = {
  email: string;
  displayName: string;
  avatarUrl: string | null;
  role: StudioMemberRole;
  progress: StudioLessonProgress | null;
};

export type StudioLessonDetail = StudioProgramLesson & {
  module: { id: string; title: string };
  studioId: string;
  canManage: boolean;
  myRole: StudioMemberRole;
  myProgress: StudioLessonProgress | null;
  roster: StudioLessonRosterItem[] | null;
  stats: {
    totalStudents: number;
    pending: number;
    submitted: number;
    completed: number;
    rejected: number;
  } | null;
};

export type StudioProgramModule = {
  id: string;
  studioId: string;
  title: string;
  description: string | null;
  imageUrl: string | null;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
  lessons: StudioProgramLesson[];
};

export type StudioAssignmentSummary = {
  id: string;
  title: string;
  description: string | null;
  lessonId: string | null;
  dueAt: string | null;
  targetCount: number;
  submissionCount: number;
  mySubmission: { email: string; grade: number | null } | null;
  isTargeted: boolean;
  createdAt: string;
  updatedAt: string;
};

export type StudioSubmissionItem = {
  id: string;
  assignmentId: string;
  email: string;
  body: string | null;
  videoUrl: string | null;
  submittedAt: string;
  updatedAt: string;
  grade: number | null;
  gradeComment: string | null;
  gradedAt: string | null;
  gradedByUserId: string | null;
};

export type StudioAssignmentDetail = {
  id: string;
  title: string;
  description: string | null;
  lessonId: string | null;
  dueAt: string | null;
  createdAt: string;
  updatedAt: string;
  targetEmails: string[];
  submissions: StudioSubmissionItem[];
  canSubmit: boolean;
};

export type StudioVideoSummary = {
  id: string;
  title: string;
  url: string;
  description: string | null;
  uploadedByEmail: string;
  assignmentId: string | null;
  markerCount: number;
  createdAt: string;
  updatedAt: string;
};

export type StudioVideoMarker = {
  id: string;
  videoId: string;
  timeSec: number;
  body: string;
  authorEmail: string;
  createdAt: string;
  updatedAt: string;
};

export type StudioVideoDetail = StudioVideoSummary & {
  markers: StudioVideoMarker[];
  canManage: boolean;
  myEmail: string;
};

export type StudioInvitesListResponse = {
  invites: StudioInviteItem[];
};

export type StudioSummary = {
  id: string;
  title: string;
  description: string | null;
  imageUrl: string | null;
  ownerUserId: string;
  myRole: StudioMemberRole;
  canManage: boolean;
  createdAt: string;
  updatedAt: string;
};

export type StudiosListResponse = {
  studios: StudioSummary[];
};

export type StudioDetail = {
  id: string;
  title: string;
  description: string | null;
  imageUrl: string | null;
  ownerUserId: string;
  createdAt: string;
  updatedAt: string;
  myRole: StudioMemberRole;
  canManage: boolean;
  members: StudioMemberItem[];
  modules: StudioProgramModule[];
  assignments: StudioAssignmentSummary[];
  videos: StudioVideoSummary[];
};

export type StudioInviteItem = {
  id: string;
  role: StudioMemberRole;
  email: string | null;
  expiresAt: string | null;
  createdAt: string;
  acceptedAt?: string | null;
  revokedAt?: string | null;
};

export type CreateStudioInviteResponse = {
  id: string;
  token: string;
  invitePath: string;
  role: StudioMemberRole;
  email: string | null;
  expiresAt: string | null;
};

export type StudioInvitePreview = {
  studioId: string;
  studioTitle: string;
  role: StudioMemberRole;
  email: string | null;
  emailMatches: boolean;
  isActive: boolean;
  expiresAt: string | null;
};

export type CreateStudioPayload = {
  title: string;
  description?: string;
};

export type UpdateStudioPayload = {
  title?: string;
  description?: string | null;
  imageUrl?: string | null;
};

export type AddStudioMemberPayload = {
  email: string;
  role: "teacher" | "student";
};

export type UpdateStudioMemberPayload = {
  role: "teacher" | "student";
};

export type CreateStudioInvitePayload = {
  role: "teacher" | "student";
  email?: string;
  expiresInDays?: number;
};

export type CreateStudioModulePayload = {
  title: string;
  description?: string;
  imageUrl?: string;
  sortOrder?: number;
};

export type UpdateStudioModulePayload = {
  title?: string;
  description?: string | null;
  imageUrl?: string | null;
  sortOrder?: number;
};

export type CreateStudioLessonPayload = {
  title: string;
  body?: string;
  taskType?: StudioLessonTaskType;
  taskPrompt?: string;
  sortOrder?: number;
};

export type UpdateStudioLessonPayload = {
  title?: string;
  body?: string | null;
  taskType?: StudioLessonTaskType;
  taskPrompt?: string | null;
  sortOrder?: number;
};

export type SubmitStudioLessonPayload = {
  mode: StudioLessonTaskType;
  videoUrl?: string;
  note?: string;
};

export type ReviewStudioLessonProgressPayload = {
  status: "completed" | "rejected";
  reviewComment?: string;
};

export function studioLessonTaskLabel(taskType: StudioLessonTaskType): string {
  if (taskType === "video") return "Видео";
  return "Отметить выполненным";
}

export function studioLessonProgressLabel(
  status: StudioLessonProgressStatus,
): string {
  if (status === "submitted") return "На проверке";
  if (status === "completed") return "Выполнен";
  if (status === "rejected") return "Отклонён";
  return "Не выполнен";
}

export type CreateStudioAssignmentPayload = {
  title: string;
  description?: string;
  lessonId?: string;
  dueAt?: string;
  targetEmails: string[];
};

export type UpdateStudioAssignmentPayload = {
  title?: string;
  description?: string | null;
  lessonId?: string | null;
  dueAt?: string | null;
  targetEmails?: string[];
};

export type SubmitStudioAssignmentPayload = {
  body?: string;
  videoUrl?: string;
};

export type GradeStudioSubmissionPayload = {
  grade: number;
  gradeComment?: string;
};

export type CreateStudioVideoPayload = {
  title: string;
  url: string;
  description?: string;
  assignmentId?: string;
};

export type UpdateStudioVideoPayload = {
  title?: string;
  url?: string;
  description?: string | null;
  assignmentId?: string | null;
};

export type CreateStudioMarkerPayload = {
  timeSec: number;
  body: string;
};

export type UpdateStudioMarkerPayload = {
  timeSec?: number;
  body?: string;
};

export function studioRoleLabel(role: StudioMemberRole): string {
  if (role === "owner") return "Владелец";
  if (role === "teacher") return "Педагог";
  return "Студиец";
}

export function formatStudioTimecode(timeSec: number): string {
  const safe = Math.max(0, Math.floor(timeSec));
  const hours = Math.floor(safe / 3600);
  const minutes = Math.floor((safe % 3600) / 60);
  const seconds = safe % 60;
  const mm = String(minutes).padStart(2, "0");
  const ss = String(seconds).padStart(2, "0");
  if (hours > 0) {
    return `${hours}:${mm}:${ss}`;
  }
  return `${mm}:${ss}`;
}

export function parseStudioTimecode(raw: string): number | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  const parts = trimmed.split(":").map((part) => Number(part));
  if (parts.some((part) => !Number.isFinite(part) || part < 0)) return null;
  if (parts.length === 1) return Math.floor(parts[0]);
  if (parts.length === 2) {
    return Math.floor(parts[0] * 60 + parts[1]);
  }
  if (parts.length === 3) {
    return Math.floor(parts[0] * 3600 + parts[1] * 60 + parts[2]);
  }
  return null;
}

export type StudioVideoEmbed =
  | { kind: "youtube"; videoId: string; embedUrl: string }
  | { kind: "direct"; src: string }
  | { kind: "external"; href: string };

export function resolveStudioVideoEmbed(url: string): StudioVideoEmbed {
  const trimmed = url.trim();
  try {
    const parsed = new URL(trimmed);
    const host = parsed.hostname.replace(/^www\./, "");

    if (host === "youtu.be") {
      const videoId = parsed.pathname.replace(/^\//, "").split("/")[0];
      if (videoId) {
        return {
          kind: "youtube",
          videoId,
          embedUrl: `https://www.youtube.com/embed/${videoId}`,
        };
      }
    }

    if (host === "youtube.com" || host === "m.youtube.com") {
      const fromQuery = parsed.searchParams.get("v");
      if (fromQuery) {
        return {
          kind: "youtube",
          videoId: fromQuery,
          embedUrl: `https://www.youtube.com/embed/${fromQuery}`,
        };
      }
      const embedMatch = parsed.pathname.match(/\/embed\/([^/]+)/);
      if (embedMatch?.[1]) {
        return {
          kind: "youtube",
          videoId: embedMatch[1],
          embedUrl: `https://www.youtube.com/embed/${embedMatch[1]}`,
        };
      }
      const shortsMatch = parsed.pathname.match(/\/shorts\/([^/]+)/);
      if (shortsMatch?.[1]) {
        return {
          kind: "youtube",
          videoId: shortsMatch[1],
          embedUrl: `https://www.youtube.com/embed/${shortsMatch[1]}`,
        };
      }
    }

    if (/\.(mp4|webm|ogg)(\?|$)/i.test(parsed.pathname)) {
      return { kind: "direct", src: trimmed };
    }
  } catch {
    // fall through
  }

  return { kind: "external", href: trimmed };
}
