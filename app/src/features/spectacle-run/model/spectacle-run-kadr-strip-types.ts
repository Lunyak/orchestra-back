import type { Ref } from "react";

import type {
  PlaybookLightFadersDataV1,
  PlaybookLightProgramsDataV1,
} from "../../playbook/model/playbook-slice";
import type { ProjectorMediaContext } from "../../projector/model/projector-media";
import type { ScriptScene, TheaterSpotlight } from "../../../shared/types/script";
import type { KadrStripTechSummary } from "./kadr-strip-tech-summary";
import type { ProgRunKadrStripLayout } from "./prog-run-prefs-storage";
import type { SpectacleTapeItem } from "./spectacle-kadr-tape";

export type SpectacleRunKadrStripLayout = ProgRunKadrStripLayout;

export type SpectacleRunKadrStripVariant = "rehearsal" | "prog-run";

export type ProgRunChipLiveConsoleProps = {
  lightChannels: string[];
  selectedLightSlot: number;
  faders: PlaybookLightFadersDataV1;
  programs: PlaybookLightProgramsDataV1;
};

export type SpectacleRunKadrStripProps = {
  variant?: SpectacleRunKadrStripVariant;
  layout?: SpectacleRunKadrStripLayout;
  notesOverlay?: boolean;
  plainCover?: boolean;
  lightConsoleOpen?: boolean;
  lightConsoleChannelColumns?: number;
  projectName: string;
  tape: SpectacleTapeItem[];
  tapeIndex: number;
  scenes: ScriptScene[];
  lightChannels: string[];
  lightFaders: PlaybookLightFadersDataV1 | null;
  lightPrograms: PlaybookLightProgramsDataV1 | null;
  playlist?: Array<{ id: number; title: string }>;
  sounds?: Array<{ id: number; title: string }>;
  videos?: Array<{ id: number; title: string }>;
  holdImages?: Array<{ id: number; title: string }>;
  projectorCtx?: ProjectorMediaContext | null;
  onSelectIndex: (index: number) => void;
};

export type SpectacleRunKadrStripRehearsalChipProps = {
  projectName: string;
  item: SpectacleTapeItem;
  imageHref: string | null;
  active: boolean;
  programColor: string | null;
  title: string;
  label: string;
  onSelect: () => void;
  chipRef?: Ref<HTMLElement>;
  tapeIndex: number;
};

export type SpectacleRunKadrStripProgRunChipProps = {
  projectName: string;
  item: SpectacleTapeItem;
  imageHref: string | null;
  summary: KadrStripTechSummary;
  projectorCtx: ProjectorMediaContext | null;
  active: boolean;
  programColor: string | null;
  title: string;
  chipNo: string;
  onSelect: () => void;
  chipRef?: Ref<HTMLElement>;
  tapeIndex: number;
  carouselOffset: number;
  carouselStacked: boolean;
  notesOverlay?: boolean;
  plainCover?: boolean;
  lightConsoleOpen?: boolean;
  chipLightConsole?: ProgRunChipLiveConsoleProps | null;
  lightConsoleChannelColumns?: number;
  sceneSpotlights?: TheaterSpotlight[];
};

export type SpectacleRunKadrStripChipModel =
  | {
      kind: "rehearsal";
      key: string;
      props: SpectacleRunKadrStripRehearsalChipProps;
    }
  | {
      kind: "prog-run";
      key: string;
      props: SpectacleRunKadrStripProgRunChipProps;
    };
