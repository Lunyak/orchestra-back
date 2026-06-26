import { unpackProjectorMedia } from "../../projector/model/playbook-projector-persist";
import type { AppDispatch } from "../../../shared/store/store";
import { store } from "../../../shared/store/store";
import { syncPull } from "../../../sync/api/entity-sync";
import {
  pullPlaybooksFromSync,
  pullScriptScenesFromSync,
  syncPullIncludeForPlaybook,
  syncRowMatchesPlaybook,
} from "../../../sync/sync-pull-normalize";
import {
  prepareSceneLightBindings,
} from "../../theater/model/theater-light-fader-bindings";
import {
  resolveInitialTheaterLayout,
} from "../../theater/model/theater-layout-draft-storage";
import { playbookActions, DEFAULT_THEATER_LAYOUT } from "./playbook-slice";
import {
  normalizeLightChannelsFromServer,
  normalizeScriptScenesFromSyncApi,
  normalizeTheaterLayoutFromServer,
} from "./playbook-normalize";
import {
  normalizeSyncPlaylistItems,
  normalizeSyncSounds,
} from "./playbook-sync-row-normalize";

export async function ensurePlaybookServerShadowForPush(
  dispatch: AppDispatch,
  token: string,
  projectName: string,
  sceneId: string,
) {
  if (store.getState().playbook.serverShadow) return;

  try {
    const pull = await syncPull(token, null, projectName, syncPullIncludeForPlaybook());
    const playbooksArr = pullPlaybooksFromSync(pull);
    const sceneRow = playbooksArr.find((s) => String(s?.id ?? "") === sceneId) ?? null;
    if (!sceneRow) return;

    const serverScenesRaw = pullScriptScenesFromSync(pull).filter((st) =>
      syncRowMatchesPlaybook(st, sceneId),
    );
    const prevScenes = normalizeScriptScenesFromSyncApi(serverScenesRaw);

    const playlistItems = Array.isArray((pull as any)?.playlistItems)
      ? (pull as any).playlistItems.filter((pi: any) => syncRowMatchesPlaybook(pi, sceneId))
      : [];
    const sounds = Array.isArray((pull as any)?.sounds)
      ? (pull as any).sounds.filter((sd: any) => syncRowMatchesPlaybook(sd, sceneId))
      : [];
    const normalizedPlaylist = normalizeSyncPlaylistItems(playlistItems, sceneId);
    const normalizedSounds = normalizeSyncSounds(sounds, sceneId);

    const serverLightChannels = Array.isArray((pull as any)?.lightChannels)
      ? (pull as any).lightChannels.filter((ch: any) => syncRowMatchesPlaybook(ch, sceneId))
      : [];
    const normalizedLight = normalizeLightChannelsFromServer(serverLightChannels);
    const layoutRow =
      (Array.isArray((pull as any)?.theaterLayouts) ? (pull as any).theaterLayouts : []).find(
        (tl: any) => syncRowMatchesPlaybook(tl, sceneId),
      ) ?? null;
    const normalizedLayout = resolveInitialTheaterLayout(
      projectName,
      normalizeTheaterLayoutFromServer(layoutRow),
      DEFAULT_THEATER_LAYOUT,
    );

    const serverLightFaders = (sceneRow as any)?.lightFaders ?? null;
    const shadowPlaybookData: any = {
      name: sceneRow?.name ?? "script",
      playlist: normalizedPlaylist,
      sounds: normalizedSounds,
      lightChannels: normalizedLight,
      ...(serverLightFaders && typeof serverLightFaders === "object"
        ? { lightFaders: serverLightFaders }
        : {}),
      ...((sceneRow as any)?.lightPrograms && typeof (sceneRow as any).lightPrograms === "object"
        ? { lightPrograms: (sceneRow as any).lightPrograms }
        : {}),
      ...((sceneRow as any)?.lightChannelRoles &&
      typeof (sceneRow as any).lightChannelRoles === "object"
        ? { lightChannelRoles: (sceneRow as any).lightChannelRoles }
        : {}),
      ...(() => {
        const bag = unpackProjectorMedia((sceneRow as any)?.projectorMedia);
        return {
          ...(bag.videos.length > 0 ? { videos: bag.videos } : {}),
          ...(bag.holdImages.length > 0 ? { holdImages: bag.holdImages } : {}),
          ...(bag.projector ? { projector: bag.projector } : {}),
        };
      })(),
    };
    const shadowBindings = prepareSceneLightBindings(
      prevScenes.length ? prevScenes : [],
      serverLightFaders,
    );
    const shadowScenes = shadowBindings.scenes;
    if (shadowBindings.lightFaders && shadowBindings.lightFaders !== serverLightFaders) {
      shadowPlaybookData.lightFaders = shadowBindings.lightFaders;
    }
    dispatch(
      playbookActions.setServerShadow({
        playbookData: shadowPlaybookData,
        scenes: shadowScenes,
        theaterLayout: normalizedLayout,
        lightChannels: normalizedLight,
      }),
    );
  } catch {
    // ignore (fallback: diff will consider everything changed)
  }
}
