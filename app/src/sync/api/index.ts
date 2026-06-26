export type { ProjectSummary } from "./types/project";
export type {
  SyncChange,
  SyncEntityType,
  SyncOperation,
  SyncPullRequest,
  SyncPullResponse,
  SyncPushRequest,
  SyncPushOptions,
} from "./types/sync";

export { api, getApiBaseUrl, setupApiInterceptors } from "./client";

export { syncPull, syncPullScene, syncPush } from "./entity-sync";

export {
  addProjectRoleNote,
  cleanupProjectImages,
  createProjectRole,
  deleteProjectRole,
  ensureProject,
  fetchProjects,
  getProjectMembers,
  getProjectRoleNotes,
  getProjectRoles,
  inviteToProject,
  removeProjectMember,
  setProjectRoleAssignments,
  updateProject,
  updateProjectMemberRole,
  updateProjectRole,
  type ProjectMemberInfo,
  type ProjectRoleInfo,
  type RoleNoteItem,
} from "./projects";

export {
  addTroupeMember,
  getMyTroupe,
  patchMyTroupeTitle,
  removeTroupeMember,
  type TroupeMemberItem,
  type TroupeSummary,
} from "./troupe";

export {
  fetchChatConversations,
  fetchChatMessages,
  markChatConversationRead,
  postChatMessage,
  type ChatConversationItem,
  type ChatConversationKind,
  type ChatMessageItem,
} from "./chat";

export {
  deleteMyProfile,
  getMyProfile,
  getProfilesBatch,
  type MyProfile,
  type TeamProfile,
  updateMyProfile,
  uploadMyAvatar,
} from "./profile";

export {
  createRehearsal,
  getMyRehearsalComment,
  getRehearsal,
  getRehearsalScenes,
  listRehearsals,
  planRehearsal,
  publishRehearsal,
  setRehearsalParticipants,
  updateRehearsal,
  upsertMyRehearsalComment,
  type Rehearsal,
  type RehearsalMyComment,
  type RehearsalParticipant,
  type RehearsalParticipantStatus,
  type RehearsalSelectedScene,
} from "./rehearsals";

export {
  confirmMyDirectorSessionAttendance,
  declineMyDirectorSessionAttendance,
  getDirectorSession,
  getDirectorSessionInvitations,
  getDirectorSessions,
  getMyDirectorSessionComment,
  publishDirectorSession,
  remindDirectorSessionMissingAvailability,
  replaceDirectorSessions,
  upsertMyDirectorSessionComment,
  type DirectorSession,
  type DirectorSessionMyComment,
  type DirectorSessionParticipant,
  type DirectorSessionParticipantStatus,
  type DirectorSessionSlot,
  type DirectorSessionSlotRef,
  type DirectorSlotRoleRehearsalPick,
} from "./director-sessions";

export {
  fetchSoundStreamBlobUrl,
  getPlayUrl,
  uploadProjectFile,
  type UploadProjectFileType,
} from "./files";

export {
  createActorAnnotation,
  deleteActorAnnotation,
  deleteActorSceneNote,
  getActorSceneNote,
  listActorAnnotations,
  updateActorAnnotation,
  upsertActorSceneNote,
  type ActorAnnotation,
  type ActorAnnotationField,
  type ActorSceneNote,
} from "./actor-notes";

export {
  connectTelegramBot,
  deleteBotVariable,
  deleteTelegramBot,
  listBotVariables,
  listTelegramBots,
  sendTelegramBotTestMessage,
  updateTelegramBot,
  upsertBotVariable,
  type BotVariableItem,
  type TelegramBotIntegrationSummary,
} from "./telegram-bots";
