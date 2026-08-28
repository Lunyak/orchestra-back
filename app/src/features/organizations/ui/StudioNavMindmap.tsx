import { getStudioNavMap } from "../model/studio-nav-map";
import {
  readStudioPoster,
  removeStudioPoster,
  storeStudioPoster,
} from "../model/studio-poster-storage";
import { NavMindmap } from "../../project/ui/NavMindmap";
import posterPlaceholderUrl from "../assets/org-poster-studios.jpg";

type StudioNavMindmapProps = {
  studioId: string;
  rootLabel?: string;
  imageUrl?: string | null;
};

export function StudioNavMindmap({
  studioId,
  rootLabel = "",
  imageUrl,
}: StudioNavMindmapProps) {
  return (
    <NavMindmap
      navMap={getStudioNavMap(studioId, rootLabel)}
      posterKey={studioId}
      poster={{
        read: () => readStudioPoster(studioId),
        store: (dataUrl) => storeStudioPoster(studioId, dataUrl),
        remove: () => removeStudioPoster(studioId),
        placeholderUrl: posterPlaceholderUrl,
        remoteUrl: imageUrl,
      }}
      navAriaLabel="Карта разделов студии"
      overviewAriaLabel={rootLabel || "Обзор студии"}
      menuTitle="Разделы студии"
    />
  );
}
