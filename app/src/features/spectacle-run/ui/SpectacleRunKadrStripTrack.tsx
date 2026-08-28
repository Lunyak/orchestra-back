import type { RefObject } from "react";

import type { SpectacleRunKadrStripChipModel } from "../model/spectacle-run-kadr-strip-types";
import type { SpectacleTapeSceneGroup, SpectacleTapeItem } from "../model/spectacle-kadr-tape";
import { SpectacleRunKadrStripProgRunChip } from "./SpectacleRunKadrStripProgRunChip";
import { SpectacleRunKadrStripRehearsalChip } from "./SpectacleRunKadrStripRehearsalChip";

type SpectacleRunKadrStripTrackProps = {
  trackRef: RefObject<HTMLDivElement>;
  isFlatTapeLayout: boolean;
  tape: SpectacleTapeItem[];
  groups: SpectacleTapeSceneGroup[];
  buildChipModel: (index: number, item: SpectacleTapeItem) => SpectacleRunKadrStripChipModel;
};

function renderChip(model: SpectacleRunKadrStripChipModel) {
  if (model.kind === "rehearsal") {
    return <SpectacleRunKadrStripRehearsalChip key={model.key} {...model.props} />;
  }
  return <SpectacleRunKadrStripProgRunChip key={model.key} {...model.props} />;
}

export function SpectacleRunKadrStripTrack({
  trackRef,
  isFlatTapeLayout,
  tape,
  groups,
  buildChipModel,
}: SpectacleRunKadrStripTrackProps) {
  return (
    <div ref={trackRef} className="spectacle-run-kadr-strip__track">
      {isFlatTapeLayout
        ? tape.map((item, index) => renderChip(buildChipModel(index, item)))
        : groups.map((group) => (
            <section
              key={group.sceneId}
              className="spectacle-run-kadr-strip__scene"
              aria-label={`Сцена ${group.sceneOrdinal}: ${group.sceneTitle}`}
            >
              <span className="spectacle-run-kadr-strip__scene-number">
                {group.sceneOrdinal}
              </span>
              <span
                className="spectacle-run-kadr-strip__scene-title"
                title={group.sceneTitle}
              >
                {group.sceneTitle}
              </span>
              <div className="spectacle-run-kadr-strip__chips">
                {group.items.map(({ tapeIndex: index, item }) =>
                  renderChip(buildChipModel(index, item)),
                )}
              </div>
            </section>
          ))}
    </div>
  );
}
