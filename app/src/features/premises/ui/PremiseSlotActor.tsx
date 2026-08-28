import { MiniAvatar } from "@shared/core/mini-avatar/MiniAvatar";
import cn from "classnames";
import type { TeamProfile } from "../../../sync/api/profile";
import type {
  PremiseBookedAsKind,
  PremiseSlotItem,
} from "../../../sync/api/premises";
import {
  normalizeMemberEmail,
  resolvePremiseMemberLabel,
} from "../model/premise-detail-helpers";
import { BookedAsGlyph } from "./BookedAsBadge";

export function PremiseSlotActorMark({
  kind,
  title,
  avatarUrl,
  size = 26,
}: {
  kind: PremiseBookedAsKind;
  title: string;
  avatarUrl: string | null;
  size?: number;
}) {
  if (kind === "user") {
    return <MiniAvatar src={avatarUrl} label={title} size={size} />;
  }

  return (
    <span
      className={cn(
        "premises-slot-row__actor-mark",
        kind === "theater" && "premises-slot-row__actor-mark--theater",
        kind === "troupe" && "premises-slot-row__actor-mark--troupe",
        kind === "studio" && "premises-slot-row__actor-mark--studio",
        kind === "external" && "premises-slot-row__actor-mark--external",
      )}
      aria-hidden
    >
      <BookedAsGlyph kind={kind} />
    </span>
  );
}

export function PremiseSlotActor({
  slot,
  profileByEmail,
  compact = false,
  hideName = false,
}: {
  slot: PremiseSlotItem;
  profileByEmail: Map<string, TeamProfile>;
  compact?: boolean;
  hideName?: boolean;
}) {
  const rental = slot.rental;
  const bookedKind = rental?.bookedAsKind ?? "user";
  const bookedTitle = String(rental?.bookedAsTitle ?? "").trim();
  const isOrgBooking = bookedKind !== "user" && Boolean(bookedTitle);
  const markSize = compact ? 26 : 52;
  const actorClassName = cn(
    "premises-slot-row__actor",
    compact && "premises-slot-row__actor--compact",
    hideName && "premises-slot-row__actor--avatar-only",
  );

  if (isOrgBooking) {
    return (
      <div className={actorClassName} title={bookedTitle}>
        <PremiseSlotActorMark
          kind={bookedKind}
          title={bookedTitle}
          avatarUrl={null}
          size={markSize}
        />
        {hideName ? null : (
          <span className="premises-slot-row__actor-name">{bookedTitle}</span>
        )}
      </div>
    );
  }

  const createdByEmail =
    rental?.createdByEmail?.trim() || slot.createdByEmail.trim();
  if (!createdByEmail) return null;

  const profile = profileByEmail.get(normalizeMemberEmail(createdByEmail));
  const { name } = resolvePremiseMemberLabel(createdByEmail, profile);
  const avatarUrl = String(profile?.avatarUrl ?? "").trim() || null;
  const displayName = bookedTitle || name;

  return (
    <div className={actorClassName} title={displayName}>
      <PremiseSlotActorMark
        kind="user"
        title={displayName}
        avatarUrl={avatarUrl}
        size={markSize}
      />
      {hideName ? null : (
        <span className="premises-slot-row__actor-name">{displayName}</span>
      )}
    </div>
  );
}
