import cn from "classnames";
import { useId, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useCompactKadrStrip } from "@shared/hooks/useCompactKadrStrip";
import { Modal } from "../../core/modal/Modal";
import "../../../features/spectacle/ui/spectacle-direction-switch.css";
import "./workspace-section-switch.css";

export type WorkspaceSectionItem = {
  id: string;
  label: string;
  to: string;
};

type WorkspaceSectionSwitchProps = {
  ariaLabel: string;
  items: ReadonlyArray<WorkspaceSectionItem>;
  activeId: string;
  /** bar — верхняя полоса; inline — ничего (назад в шапке приложения) */
  variant?: "bar" | "inline";
};

export function WorkspaceSectionSwitch({
  ariaLabel,
  items,
  activeId,
  variant = "bar",
}: WorkspaceSectionSwitchProps) {
  const compactStrip = useCompactKadrStrip();
  const navigate = useNavigate();
  const [modalOpen, setModalOpen] = useState(false);
  const titleId = useId();

  if (variant === "inline") return null;

  const activeLabel =
    items.find((item) => item.id === activeId)?.label ?? "Раздел";

  const modeLinks = items.map((item) => {
    const isActive = item.id === activeId;
    return (
      <li key={item.id}>
        <Link
          to={item.to}
          className={cn(
            "spectacle-direction-switch__item",
            isActive && "spectacle-direction-switch__item--active",
          )}
          aria-current={isActive ? "page" : undefined}
        >
          {item.label}
        </Link>
      </li>
    );
  });

  if (compactStrip) {
    return (
      <nav
        className={cn(
          "spectacle-direction-switch",
          "spectacle-direction-switch--centered",
          "workspace-section-switch",
          "workspace-section-switch--compact",
        )}
        aria-label={ariaLabel}
      >
        <div className="workspace-section-switch__track">
          <div className="spectacle-direction-switch__right">
            <button
              type="button"
              className="workspace-section-switch__nav-btn"
              title={`Раздел: ${activeLabel}`}
              aria-label={`Раздел: ${activeLabel}`}
              aria-haspopup="dialog"
              aria-expanded={modalOpen}
              onClick={() => setModalOpen(true)}
            >
              {activeLabel}
            </button>
          </div>
        </div>
        <Modal
          isOpen={modalOpen}
          onClose={() => setModalOpen(false)}
          panelClassName="workspace-section-switch__modal-panel"
          ariaLabelledBy={titleId}
        >
          <div className="workspace-section-switch__modal">
            <h2 id={titleId} className="workspace-section-switch__modal-title">
              Раздел
            </h2>
            <ul className="workspace-section-switch__modal-list">
              {items.map((item) => {
                const isActive = item.id === activeId;
                return (
                  <li key={item.id}>
                    <button
                      type="button"
                      className={cn(
                        "workspace-section-switch__modal-item",
                        isActive &&
                          "workspace-section-switch__modal-item--active",
                      )}
                      aria-pressed={isActive}
                      onClick={() => {
                        setModalOpen(false);
                        if (!isActive) navigate(item.to);
                      }}
                    >
                      {item.label}
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>
        </Modal>
      </nav>
    );
  }

  return (
    <nav
      className="spectacle-direction-switch workspace-section-switch"
      aria-label={ariaLabel}
    >
      <div className="workspace-section-switch__track">
        <div className="spectacle-direction-switch__right">
          <ul
            className="spectacle-direction-switch__modes"
            aria-label="Разделы"
          >
            {modeLinks}
          </ul>
        </div>
      </div>
    </nav>
  );
}
