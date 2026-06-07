import type { ScriptStep, TheaterLayout } from "../../../shared/types/script";
import { prepareSceneLightBindings } from "../../theater/model/theater-light-fader-bindings";
import { getDesktopApi } from "../../../shared/platform/desktop-api";
import { desktopReadProjectScene } from "../../../shared/platform/desktop-methods";
import type { AppDispatch } from "../../../shared/store/store";
import { normalizePersistedTheaterLayout } from "../../theater/model/theater-metrics";
import { resolveInitialTheaterLayout } from "../../theater/model/theater-layout-draft-storage";
import { unpackProjectorMedia } from "../../projector/model/scene-projector-persist";
import { sceneActions, DEFAULT_THEATER_LAYOUT, type SceneData } from "./scene-slice";
import { showScriptMarkdownActions } from "../../show-script-markdown/model/show-script-markdown-slice";
import { normalizeLightChannelsLoose } from "./scene-normalize";

export async function hydrateSceneFromLocalPack(
  projectSlug: string,
  dispatch: AppDispatch,
): Promise<boolean> {
  const api = getDesktopApi();
  if (!api?.readProjectScene) return false;
  try {
    const fresh = await desktopReadProjectScene(api, projectSlug, "script");
    if (!fresh || typeof fresh !== "object") return false;
    const f = fresh as Record<string, unknown>;
    const rawLayout = f.theaterLayout as TheaterLayout | undefined;
    const theaterLayout = resolveInitialTheaterLayout(
      projectSlug,
      rawLayout ? normalizePersistedTheaterLayout(rawLayout) : undefined,
      DEFAULT_THEATER_LAYOUT,
    );
    const lc = normalizeLightChannelsLoose(f.lightChannels);
    const projectorBag = unpackProjectorMedia(f.projectorMedia);
    const sceneData: SceneData = {
      name: f.name as string | undefined,
      playlist: Array.isArray(f.playlist) ? (f.playlist as SceneData["playlist"]) : [],
      sounds: Array.isArray(f.sounds) ? f.sounds : [],
      videos:
        projectorBag.videos.length > 0
          ? projectorBag.videos
          : Array.isArray(f.videos)
            ? (f.videos as SceneData["videos"])
            : [],
      holdImages:
        projectorBag.holdImages.length > 0
          ? projectorBag.holdImages
          : Array.isArray(f.holdImages)
            ? (f.holdImages as SceneData["holdImages"])
            : [],
      projector: projectorBag.projector ?? (f.projector as SceneData["projector"]),
      sceneRoles: f.sceneRoles as SceneData["sceneRoles"],
      lightFaders: f.lightFaders as SceneData["lightFaders"],
      lightPrograms: f.lightPrograms as SceneData["lightPrograms"],
      lightChannelRoles: f.lightChannelRoles as SceneData["lightChannelRoles"],
      lightChannels: lc,
      images:
        f.images && typeof f.images === "object"
          ? (f.images as SceneData["images"])
          : undefined,
    };
    const prepared = prepareSceneLightBindings(
      Array.isArray(f.steps) ? (f.steps as ScriptStep[]) : [],
      sceneData.lightFaders,
    );
    sceneData.lightFaders = prepared.lightFaders ?? sceneData.lightFaders;
    const stepsOut = prepared.steps;
    dispatch(
      sceneActions.hydrateScene({
        sceneData,
        steps: stepsOut,
        theaterLayout,
        isSceneReady: true,
        serverShadow: {
          sceneData,
          steps: stepsOut,
          theaterLayout,
          lightChannels: lc,
        },
      }),
    );
    dispatch(
      showScriptMarkdownActions.setLightChannels({
        projectSlug,
        sceneName: "script",
        lightChannels: lc,
      }),
    );
    console.info("[sync] loaded scene from local offline pack");
    return true;
  } catch (e) {
    console.warn("[sync] local offline pack load failed:", e);
    return false;
  }
}
