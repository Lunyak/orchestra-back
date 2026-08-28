import cn from "classnames";
import {
  CustomSelect,
  type CustomSelectOption,
} from "../../../shared/core/custom-select/CustomSelect";
import { ProjectorMediaPreview } from "../../projector/ui/ProjectorMediaPreview";
import type { ProjectorMediaContext } from "../../projector/model/projector-media";

type CreateKadrModalProjectorSectionProps = {
  projectorCtx: ProjectorMediaContext;
  projectorValue: string;
  projectorOptions: CustomSelectOption[];
  isProjectorVideo: boolean;
  projectorVideoMuted: boolean;
  projectorPreviewMode: "video" | "hold" | null;
  projectorPreviewVideoId: number | null;
  projectorPreviewHoldId: number | null;
  projectorPreviewTitle: string;
  onProjectorChange: (value: string) => void;
  onToggleMuted: () => void;
};

export function CreateKadrModalProjectorSection({
  projectorCtx,
  projectorValue,
  projectorOptions,
  isProjectorVideo,
  projectorVideoMuted,
  projectorPreviewMode,
  projectorPreviewVideoId,
  projectorPreviewHoldId,
  projectorPreviewTitle,
  onProjectorChange,
  onToggleMuted,
}: CreateKadrModalProjectorSectionProps) {
  return (
    <section className="create-kadr-modal__section">
      <h3 className="create-kadr-modal__section-title">Проектор</h3>
      <div className="create-kadr-modal__projector-row">
        <label className="create-kadr-modal__field create-kadr-modal__field--grow">
          <span className="create-kadr-modal__label">Видео или заставка</span>
          <CustomSelect
            value={projectorValue}
            options={projectorOptions}
            onChange={onProjectorChange}
            searchable={projectorOptions.length > 8}
            className="create-kadr-modal__select"
            aria-label="Видео или заставка"
          />
        </label>
        {isProjectorVideo ? (
          <label
            className={cn(
              "create-kadr-modal__check",
              "create-kadr-modal__check--projector-mute",
              projectorVideoMuted && "create-kadr-modal__check--active",
            )}
          >
            <input
              type="checkbox"
              checked={projectorVideoMuted}
              onChange={onToggleMuted}
            />
            <span>Без звука</span>
          </label>
        ) : null}
      </div>
      {projectorPreviewMode ? (
        <ProjectorMediaPreview
          ctx={projectorCtx}
          mode={projectorPreviewMode}
          videoId={projectorPreviewVideoId}
          holdId={projectorPreviewHoldId}
          title={projectorPreviewTitle}
          className="create-kadr-modal__projector-preview"
        />
      ) : null}
    </section>
  );
}
