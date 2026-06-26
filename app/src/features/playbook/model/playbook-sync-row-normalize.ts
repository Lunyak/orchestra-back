import { syncRowMatchesPlaybook } from "../../../sync/sync-pull-normalize";

export function normalizeSyncPlaylistItems(playlistItems: unknown[] | undefined, sceneId: string) {
  return (Array.isArray(playlistItems) ? playlistItems : [])
    .filter((pi) => syncRowMatchesPlaybook(pi, sceneId))
    .sort((a: any, b: any) => Number(a?.order ?? 0) - Number(b?.order ?? 0))
    .map((pi: any) => ({
      id: Number(pi?.sourceId ?? 0),
      title: String(pi?.title ?? ""),
      file: String(pi?.file ?? ""),
      fadeMs: typeof pi?.fadeMs === "number" ? pi.fadeMs : 500,
      loop: Boolean(pi?.loop),
      remoteKey: pi?.remoteKey ?? undefined,
      remoteUrl: pi?.remoteUrl ?? undefined,
    }))
    .filter((x: any) => Number.isFinite(x.id) && x.id > 0);
}

export function normalizeSyncSounds(sounds: unknown[] | undefined, sceneId: string) {
  return (Array.isArray(sounds) ? sounds : [])
    .filter((sd) => syncRowMatchesPlaybook(sd, sceneId))
    .map((sd: any) => ({
      id: Number(sd?.sourceId ?? 0),
      title: String(sd?.title ?? ""),
      file: String(sd?.file ?? ""),
      icon: sd?.icon ?? undefined,
      iconRemoteKey: sd?.iconRemoteKey ?? undefined,
      iconRemoteUrl: sd?.iconRemoteUrl ?? undefined,
      volume: typeof sd?.volume === "number" ? sd.volume : 0.8,
      fadeMs: typeof sd?.fadeMs === "number" ? sd.fadeMs : 500,
      loop: Boolean(sd?.loop),
      remoteKey: sd?.remoteKey ?? undefined,
      remoteUrl: sd?.remoteUrl ?? undefined,
    }))
    .filter((x: any) => Number.isFinite(x.id) && x.id > 0);
}
