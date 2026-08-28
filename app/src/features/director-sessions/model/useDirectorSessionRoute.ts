import { useNavigate, useParams } from "react-router-dom";
import {
  projectSessionPath,
  theaterRehearsalsPath,
  theaterRehearsalSessionPath,
} from "../../../app/router/paths";
import { useProject } from "../../project";

export function useDirectorSessionRoute() {
  const navigate = useNavigate();
  const { projectName } = useProject();
  const { sessionId, slotId, theaterId: theaterIdParam } = useParams();

  const sid = String(sessionId ?? "").trim();
  const slId =
    slotId != null && String(slotId).trim() !== "" ? String(slotId).trim() : "";
  const theaterId = String(theaterIdParam ?? "").trim();
  const isTheaterContext = Boolean(theaterId);

  const sessionHref = (nextSlotId?: string) =>
    isTheaterContext
      ? theaterRehearsalSessionPath(theaterId, sid, nextSlotId)
      : projectSessionPath(projectName, sid, nextSlotId);

  const sessionsListHref = isTheaterContext
    ? theaterRehearsalsPath(theaterId)
    : `${projectSessionPath(projectName)}?sessionId=${encodeURIComponent(sid)}`;

  const selectSlot = (id: string) => {
    navigate(sessionHref(id));
  };

  const closeSlot = () => {
    navigate(sessionHref());
  };

  const onNoSlotsLeft = () => {
    navigate(sessionHref(), { replace: true });
  };

  return {
    navigate,
    sid,
    slId,
    theaterId,
    isTheaterContext,
    sessionHref,
    sessionsListHref,
    selectSlot,
    closeSlot,
    onNoSlotsLeft,
  };
}
