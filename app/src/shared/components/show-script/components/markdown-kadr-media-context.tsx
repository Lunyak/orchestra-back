import { createContext } from "react";
import type {
  PlaybookHoldImage,
  SceneProjectorSettingsV1,
  PlaybookVideo,
} from "../../../../features/playbook/model/playbook-slice";

export type MarkdownKadrMediaLookup = {
  projectSlug: string;
  videos: PlaybookVideo[];
  holdImages: PlaybookHoldImage[];
  projector?: SceneProjectorSettingsV1 | null;
};

export const MarkdownKadrMediaContext = createContext<MarkdownKadrMediaLookup>({
  projectSlug: "",
  videos: [],
  holdImages: [],
  projector: null,
});
