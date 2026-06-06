import { createContext } from "react";
import type {
  SceneHoldImage,
  SceneProjectorSettingsV1,
  SceneVideo,
} from "../../../../features/scene/model/scene-slice";

export type MarkdownKadrMediaLookup = {
  projectSlug: string;
  videos: SceneVideo[];
  holdImages: SceneHoldImage[];
  projector?: SceneProjectorSettingsV1 | null;
};

export const MarkdownKadrMediaContext = createContext<MarkdownKadrMediaLookup>({
  projectSlug: "",
  videos: [],
  holdImages: [],
  projector: null,
});
