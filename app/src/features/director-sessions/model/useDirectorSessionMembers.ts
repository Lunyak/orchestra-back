import { useMemo } from "react";
import { useProfilesBatchQuery } from "../../profile/api/profile-api";
import {
  useProjectMembersQuery,
  useProjectRolesQuery,
} from "../../project/api/project-api";
import { useTheaterHomeTroupeQuery } from "../../troupe/api/troupe-api";
import { pickQueryErrorMessage } from "./director-session-page-helpers";
import {
  memberEmailsFromProjectMembers,
  normalizeEmail,
  roleMapsFromProjectRoles,
} from "./session-page-utils";

export function useDirectorSessionMembers(args: {
  accessToken: string | null | undefined;
  theaterId: string;
  isTheaterContext: boolean;
  rolesSlug: string;
}) {
  const { accessToken, theaterId, isTheaterContext, rolesSlug } = args;

  const { data: theaterTroupe } = useTheaterHomeTroupeQuery(
    { theaterId },
    { skip: !accessToken || !isTheaterContext },
  );

  const {
    data: membersRes,
    isLoading: membersLoading,
    error: membersQueryError,
  } = useProjectMembersQuery(rolesSlug, {
    skip: !accessToken || !rolesSlug,
  });

  const { data: rolesRes, error: rolesQueryError } = useProjectRolesQuery(
    rolesSlug,
    {
      skip: !accessToken || !rolesSlug,
    },
  );

  const projectMemberEmails = useMemo(
    () => memberEmailsFromProjectMembers(membersRes),
    [membersRes],
  );

  const { roleEmailsByKey, roleTitleByKey } = useMemo(
    () => roleMapsFromProjectRoles(rolesRes?.roles),
    [rolesRes?.roles],
  );

  const {
    data: teamProfiles = [],
    error: profilesQueryError,
  } = useProfilesBatchQuery(projectMemberEmails, {
    skip: !accessToken || projectMemberEmails.length === 0,
  });

  const theaterMemberEmails = useMemo(
    () =>
      (theaterTroupe?.members ?? [])
        .map((member) => normalizeEmail(String(member.email ?? "")))
        .filter(Boolean),
    [theaterTroupe?.members],
  );

  const {
    data: theaterScheduleProfiles = [],
    isLoading: theaterScheduleProfilesLoading,
  } = useProfilesBatchQuery(theaterMemberEmails, {
    skip:
      !accessToken ||
      !isTheaterContext ||
      theaterMemberEmails.length === 0,
  });

  const availabilityError = useMemo(() => {
    if (membersQueryError)
      return pickQueryErrorMessage(
        membersQueryError,
        "Не удалось загрузить участников проекта",
      );
    if (rolesQueryError)
      return pickQueryErrorMessage(
        rolesQueryError,
        "Не удалось загрузить роли проекта",
      );
    if (profilesQueryError)
      return pickQueryErrorMessage(
        profilesQueryError,
        "Не удалось загрузить профили участников",
      );
    return null;
  }, [membersQueryError, rolesQueryError, profilesQueryError]);

  const theaterMembers = useMemo(
    () => theaterTroupe?.members ?? [],
    [theaterTroupe?.members],
  );

  return {
    membersLoading,
    roleEmailsByKey,
    roleTitleByKey,
    teamProfiles,
    theaterMembers,
    theaterScheduleProfiles,
    theaterScheduleProfilesLoading,
    availabilityError,
  };
}
