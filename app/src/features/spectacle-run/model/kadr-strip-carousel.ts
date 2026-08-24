export function centerKadrStripChip(
  track: HTMLElement,
  chip: HTMLElement,
  behavior: ScrollBehavior = "smooth",
): void {
  const trackRect = track.getBoundingClientRect();
  const chipRect = chip.getBoundingClientRect();
  const chipCenterInContent =
    chipRect.left - trackRect.left + track.scrollLeft + chipRect.width / 2;
  const targetLeft = chipCenterInContent - track.clientWidth / 2;
  const maxLeft = Math.max(0, track.scrollWidth - track.clientWidth);
  const nextLeft = Math.min(maxLeft, Math.max(0, targetLeft));

  if (Math.abs(track.scrollLeft - nextLeft) < 1) return;
  track.scrollTo({ left: nextLeft, behavior });
}

export function findNearestKadrStripChipIndex(track: HTMLElement): number | null {
  const trackRect = track.getBoundingClientRect();
  const centerX = trackRect.left + trackRect.width / 2;
  const chips = track.querySelectorAll<HTMLElement>("[data-tape-index]");
  let bestIndex: number | null = null;
  let bestDist = Infinity;

  chips.forEach((chip) => {
    const rect = chip.getBoundingClientRect();
    const chipCenter = rect.left + rect.width / 2;
    const dist = Math.abs(chipCenter - centerX);
    if (dist >= bestDist) return;
    const index = Number(chip.dataset.tapeIndex);
    if (!Number.isFinite(index)) return;
    bestDist = dist;
    bestIndex = index;
  });

  return bestIndex;
}
