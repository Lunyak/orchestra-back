import { useMemo } from "react";
import {
  useMyProfileQuery,
  useProfilesBatchQuery,
} from "../../profile/api/profile-api";
import {
  mergeSelfEmail,
  mergeSelfIntoProfiles,
} from "../../profile/model/availability-calendar";
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

  const { data: myProfile } = useMyProfileQuery(undefined, {
    skip: !accessToken,
  });

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
    () =>
      mergeSelfEmail(
        memberEmailsFromProjectMembers(membersRes),
        myProfile?.email,
      ),
    [membersRes, myProfile?.email],
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
      mergeSelfEmail(
        (theaterTroupe?.members ?? [])
          .map((member) => normalizeEmail(String(member.email ?? "")))
          .filter(Boolean),
        myProfile?.email,
      ),
    [myProfile?.email, theaterTroupe?.members],
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

  const teamProfilesWithMe = useMemo(
    () => mergeSelfIntoProfiles(teamProfiles, myProfile),
    [myProfile, teamProfiles],
  );
  const theaterScheduleProfilesWithMe = useMemo(
    () => mergeSelfIntoProfiles(theaterScheduleProfiles, myProfile),
    [myProfile, theaterScheduleProfiles],
  );

  return {
    membersLoading,
    roleEmailsByKey,
    roleTitleByKey,
    teamProfiles: teamProfilesWithMe,
    theaterMembers,
    theaterScheduleProfiles: theaterScheduleProfilesWithMe,
    theaterScheduleProfilesLoading,
    availabilityError,
  };
}
