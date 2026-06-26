import { Modal } from "@shared/core/modal/Modal";
import { DirectorSessionDetailPanel } from "./DirectorSessionDetailPanel";
import { Buttons } from "@shared/components/buttons/Buttons";

export type DirectorSessionDetailModalProps = {
  isOpen: boolean;
  sessionId: string | null;
  accessToken: string | null | undefined;
  onClose: () => void;
};

export function DirectorSessionDetailModal({
  isOpen,
  sessionId,
  accessToken,
  onClose,
}: DirectorSessionDetailModalProps) {
  const sid = String(sessionId ?? "").trim();
  const open = Boolean(isOpen && sid && accessToken);

  /** Пока модалка закрыта — не монтируем панель (никаких getDirectorSession / syncPull / batch). */
  if (!open) return null;

  return (
    <Modal
      isOpen
      onClose={onClose}
      panelClassName="director-session-detail-modal"
      ariaLabel="Сессия"
    >
      <Buttons.CloseButton
        type="button"
        className="director-session-detail-modal__close"
        onClick={onClose}
        aria-label="Закрыть"
      >
        ×
      </Buttons.CloseButton>
      <div className="director-session-detail-modal__body">
        <DirectorSessionDetailPanel
          accessToken={accessToken as string}
          sessionId={sid}
          onClose={onClose}
        />
      </div>
    </Modal>
  );
}
