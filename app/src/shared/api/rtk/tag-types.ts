/** Теги кэша RTK Query — добавляйте домены по мере миграции sync/api. */
export const orchestraApiTagTypes = [
  "Rehearsal",
  "RehearsalList",
  "RehearsalSteps",
  "RehearsalPlan",
  "Profile",
  "ProfileBatch",
  "ProjectRoles",
  "ProjectMembers",
  "Troupe",
  "Premises",
  "PremiseSlots",
  "PremiseMembers",
  "DirectorSessions",
  "ProjectMaterial",
  "ProjectTasks",
  "SyncPull",
] as const;
