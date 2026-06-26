import type { ScriptScene, TheaterLayout } from "../../../shared/types/script";
import { prepareSceneLightBindings } from "../../theater/model/theater-light-fader-bindings";
import { getDesktopApi } from "../../../shared/platform/desktop-api";
import { fetchDevLocalProjectJson } from "../../../shared/platform/local-project-dev";
import { readProjectFolderJson } from "../../../shared/platform/project-media-folder";
import { desktopReadProjectPlaybook } from "../../../shared/platform/desktop-methods";
import type { AppDispatch } from "../../../shared/store/store";
import { normalizePersistedTheaterLayout } from "../../theater/model/theater-metrics";
import {
  commitTheaterLayoutBaseline,
  isTheaterLayoutDraftDirty,
  resolveInitialTheaterLayout,
} from "../../theater/model/theater-layout-draft-storage";
import { unpackProjectorMedia } from "../../projector/model/playbook-projector-persist";
import { playbookActions, DEFAULT_THEATER_LAYOUT, type PlaybookData } from "./playbook-slice";
import { showScriptMarkdownActions } from "../../show-script-markdown/model/show-script-markdown-slice";
import { normalizeLightChannelsLoose, normalizePlaybookJsonPayload, readPlaybookScenes } from "./playbook-normalize";

async function readLocalProjectScript(
  projectSlug: string,
): Promise<Record<string, unknown> | null> {
  const api = getDesktopApi();
  if (api?.readProjectPlaybook) {
    const fresh = await desktopReadProjectPlaybook(api, projectSlug, "script");
    return fresh && typeof fresh === "object" ? (fresh as Record<string, unknown>) : null;
  }
  const fromFolder = await readProjectFolderJson(projectSlug, "script");
  if (fromFolder) return fromFolder;
  return fetchDevLocalProjectJson(projectSlug, "script");
}

function applyLocalScenePayload(
  projectSlug: string,
  dispatch: AppDispatch,
  f: Record<string, unknown>,
): boolean {
  const rawLayout = f.theaterLayout as TheaterLayout | undefined;
  const theaterLayout = resolveInitialTheaterLayout(
    projectSlug,
    rawLayout ? normalizePersistedTheaterLayout(rawLayout) : undefined,
    DEFAULT_THEATER_LAYOUT,
  );
  const lc = normalizeLightChannelsLoose(f.lightChannels);
  const projectorBag = unpackProjectorMedia(f.projectorMedia);
  const playbookData: PlaybookData = {
    name: f.name as string | undefined,
    playlist: Array.isArray(f.playlist) ? (f.playlist as PlaybookData["playlist"]) : [],
    sounds: Array.isArray(f.sounds) ? f.sounds : [],
    videos:
      projectorBag.videos.length > 0
        ? projectorBag.videos
        : Array.isArray(f.videos)
          ? (f.videos as PlaybookData["videos"])
          : [],
    holdImages:
      projectorBag.holdImages.length > 0
        ? projectorBag.holdImages
        : Array.isArray(f.holdImages)
          ? (f.holdImages as PlaybookData["holdImages"])
          : [],
    projector: projectorBag.projector ?? (f.projector as PlaybookData["projector"]),
    sceneRoles: f.sceneRoles as PlaybookData["sceneRoles"],
    lightFaders: f.lightFaders as PlaybookData["lightFaders"],
    lightPrograms: f.lightPrograms as PlaybookData["lightPrograms"],
    lightChannelRoles: f.lightChannelRoles as PlaybookData["lightChannelRoles"],
    lightChannels: lc,
    images:
      f.images && typeof f.images === "object"
        ? (f.images as PlaybookData["images"])
        : undefined,
  };
  const prepared = prepareSceneLightBindings(
    readPlaybookScenes(f),
    playbookData.lightFaders,
  );
  playbookData.lightFaders = prepared.lightFaders ?? playbookData.lightFaders;
  const scenesOut = prepared.scenes;
  dispatch(
    playbookActions.hydratePlaybook({
      playbookData,
      scenes: scenesOut,
      theaterLayout,
      isPlaybookReady: true,
      serverShadow: {
        playbookData,
        scenes: scenesOut,
        theaterLayout,
        lightChannels: lc,
      },
    }),
  );
  if (!isTheaterLayoutDraftDirty(projectSlug)) {
    commitTheaterLayoutBaseline(projectSlug, theaterLayout);
  }
  dispatch(
    showScriptMarkdownActions.setLightChannels({
      projectSlug,
      sceneName: "script",
      lightChannels: lc,
    }),
  );
  return true;
}

export async function hydratePlaybookFromLocalPack(
  projectSlug: string,
  dispatch: AppDispatch,
): Promise<boolean> {
  try {
    const fresh = await readLocalProjectScript(projectSlug);
    if (!fresh) return false;
    applyLocalScenePayload(projectSlug, dispatch, normalizePlaybookJsonPayload(fresh));
    console.info("[sync] loaded scene from local pack");
    return true;
  } catch (e) {
    console.warn("[sync] local offline pack load failed:", e);
    return false;
  }
}
