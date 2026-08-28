import type { TeamProfile } from "../../../sync/api/profile";
import type { PremiseRentalItem } from "../../../sync/api/premises";
import {
  normalizeMemberEmail,
  resolvePremiseMemberLabel,
} from "../model/premise-detail-helpers";
import { PremiseSlotActorMark } from "./PremiseSlotActor";

export function PremiseRentalPeople({
  rental,
  profileByEmail,
}: {
  rental: PremiseRentalItem;
  profileByEmail: Map<string, TeamProfile>;
}) {
  const bookedKind = rental.bookedAsKind ?? "user";
  const bookedTitle = String(rental.bookedAsTitle ?? "").trim();
  const isOrgBooking = bookedKind !== "user" && Boolean(bookedTitle);

  const createdByEmail = rental.createdByEmail.trim();
  const creatorProfile = createdByEmail
    ? profileByEmail.get(normalizeMemberEmail(createdByEmail))
    : undefined;
  const creatorName = createdByEmail
    ? resolvePremiseMemberLabel(createdByEmail, creatorProfile).name
    : "";
  const actorTitle = isOrgBooking ? bookedTitle : bookedTitle || creatorName;
  const actorAvatarUrl = isOrgBooking
    ? null
    : String(creatorProfile?.avatarUrl ?? "").trim() || null;

  const confirmedByEmail = rental.confirmedByEmail?.trim() || "";
  const confirmedByLabel = confirmedByEmail
    ? resolvePremiseMemberLabel(
        confirmedByEmail,
        profileByEmail.get(normalizeMemberEmail(confirmedByEmail)),
      ).name
    : "";
  const showConfirmed =
    Boolean(confirmedByLabel) && rental.status === "active";

  if (!actorTitle && !showConfirmed) return null;

  const actorKind = isOrgBooking ? bookedKind : "user";

  return (
    <div className="premises-slot-row__people">
      {actorTitle ? (
        <div className="premises-slot-row__actor" title={actorTitle}>
          <PremiseSlotActorMark
            kind={actorKind}
            title={actorTitle}
            avatarUrl={actorAvatarUrl}
          />
          <span className="premises-slot-row__actor-name">{actorTitle}</span>
        </div>
      ) : null}
      {showConfirmed ? (
        <div className="rehearsals-muted">Подтвердил: {confirmedByLabel}</div>
      ) : null}
    </div>
  );
}
