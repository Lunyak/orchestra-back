import { getTheaterNavMap } from "../model/theater-nav-map";
import {
  readTheaterPoster,
  removeTheaterPoster,
  storeTheaterPoster,
} from "../model/theater-poster-storage";
import { NavMindmap } from "../../project/ui/NavMindmap";
import posterPlaceholderUrl from "../assets/org-poster-theaters.jpg";

type TheaterNavMindmapProps = {
  theaterId: string;
  rootLabel?: string;
};

export function TheaterNavMindmap({
  theaterId,
  rootLabel = "",
}: TheaterNavMindmapProps) {
  return (
    <NavMindmap
      navMap={getTheaterNavMap(theaterId, rootLabel)}
      posterKey={theaterId}
      poster={{
        read: () => readTheaterPoster(theaterId),
        store: (dataUrl) => storeTheaterPoster(theaterId, dataUrl),
        remove: () => removeTheaterPoster(theaterId),
        placeholderUrl: posterPlaceholderUrl,
      }}
      navAriaLabel="Карта разделов театра"
      overviewAriaLabel={rootLabel || "Обзор театра"}
      menuTitle="Разделы театра"
    />
  );
}
