import type { TeamProfile } from "../../../sync/api/profile";
import type { PremiseSlotItem } from "../../../sync/api/premises";
import {
  normalizeMemberEmail,
  resolvePremiseMemberLabel,
} from "../model/premise-detail-helpers";

export function PremiseSlotPeople({
  slot,
  profileByEmail,
}: {
  slot: PremiseSlotItem;
  profileByEmail: Map<string, TeamProfile>;
}) {
  const confirmedByEmail = slot.rental?.confirmedByEmail?.trim() || "";
  const confirmedByLabel = confirmedByEmail
    ? resolvePremiseMemberLabel(
        confirmedByEmail,
        profileByEmail.get(normalizeMemberEmail(confirmedByEmail)),
      ).name
    : "";
  const showConfirmed =
    Boolean(confirmedByLabel) &&
    (slot.status === "confirmed" || slot.rental?.status === "active");

  if (!showConfirmed) return null;

  return (
    <div className="premises-slot-row__people">
      <div className="sessions-slots-readonly__notes">
        <b>Подтвердил:</b> {confirmedByLabel}
      </div>
    </div>
  );
}
