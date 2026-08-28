export type OnboardingPoint = { x: number; y: number };

export type OnboardingCardBox = {
  left: number;
  top: number;
};

export type OnboardingPlacePrefer = "left" | "right" | "below";

export type OnboardingPlaceOptions = {
  prefer?: OnboardingPlacePrefer;
  cardWidth?: number;
};

export const ONBOARDING_CARD_WIDTH = 340;
export const ONBOARDING_CARD_GAP = 44;
export const ONBOARDING_VIEW_PAD = 16;
export const ONBOARDING_RING_PAD = 8;

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

type PlaceBounds = {
  left: number;
  top: number;
  right: number;
  bottom: number;
};

function readPlacementBounds(): PlaceBounds {
  const pad = ONBOARDING_VIEW_PAD;
  const view: PlaceBounds = {
    left: pad,
    top: pad,
    right: window.innerWidth - pad,
    bottom: window.innerHeight - pad,
  };
  const plate = document.querySelector(".project-overview");
  if (!(plate instanceof HTMLElement)) return view;
  const rect = plate.getBoundingClientRect();
  return {
    left: Math.max(view.left, rect.left + pad),
    top: Math.max(view.top, rect.top + pad),
    right: Math.min(view.right, rect.right - pad),
    bottom: Math.min(view.bottom, rect.bottom - pad),
  };
}

export function fallbackOnboardingCard(): OnboardingCardBox {
  const bounds = readPlacementBounds();
  const width = Math.min(ONBOARDING_CARD_WIDTH, bounds.right - bounds.left);
  return {
    left: clamp(
      (bounds.left + bounds.right - width) / 2,
      bounds.left,
      Math.max(bounds.left, bounds.right - width),
    ),
    top: bounds.top + 8,
  };
}

export function placeOnboardingCard(
  target: DOMRect,
  cardHeight: number,
  options: OnboardingPlaceOptions = {},
): OnboardingCardBox {
  const bounds = readPlacementBounds();
  const cardWidth = Math.min(
    options.cardWidth ?? ONBOARDING_CARD_WIDTH,
    Math.max(160, bounds.right - bounds.left),
  );
  const prefer = options.prefer ?? "right";
  const maxTop = Math.max(bounds.top, bounds.bottom - cardHeight);
  const centerTop = clamp(
    target.top + target.height / 2 - cardHeight / 2,
    bounds.top,
    maxTop,
  );
  const gap = cardWidth > bounds.right - bounds.left - 48
    ? 16
    : ONBOARDING_CARD_GAP;
  const centerLeft = clamp(
    target.left + target.width / 2 - cardWidth / 2,
    bounds.left,
    Math.max(bounds.left, bounds.right - cardWidth),
  );
  const roomForSide = target.width + cardWidth + gap <= bounds.right - bounds.left;

  const tryRight = () => {
    const left = target.right + gap;
    if (left + cardWidth <= bounds.right) return { left, top: centerTop };
    return null;
  };
  const tryLeft = () => {
    const left = target.left - gap - cardWidth;
    if (left >= bounds.left) return { left, top: centerTop };
    return null;
  };
  const tryBelow = () => {
    const top = target.bottom + gap;
    if (top + cardHeight <= bounds.bottom) return { left: centerLeft, top };
    return null;
  };
  const tryAbove = () => {
    const top = target.top - gap - cardHeight;
    if (top >= bounds.top) return { left: centerLeft, top };
    return null;
  };

  if (prefer === "below") {
    const below = tryBelow();
    if (below) return below;
    const above = tryAbove();
    if (above) return above;
  }

  if (roomForSide) {
    const first = prefer === "left" ? tryLeft() : tryRight();
    if (first) return first;
    const second = prefer === "left" ? tryRight() : tryLeft();
    if (second) return second;
  }

  const below = tryBelow();
  if (below) return below;
  const above = tryAbove();
  if (above) return above;
  return {
    left: centerLeft,
    top: clamp(centerTop, bounds.top, maxTop),
  };
}

export function onboardingEdgeAnchor(
  rect: DOMRect,
  towardX: number,
  towardY: number,
): OnboardingPoint {
  const centerX = rect.left + rect.width / 2;
  const centerY = rect.top + rect.height / 2;
  const deltaX = towardX - centerX;
  const deltaY = towardY - centerY;
  if (Math.abs(deltaX) > Math.abs(deltaY)) {
    return deltaX > 0
      ? { x: rect.right, y: centerY }
      : { x: rect.left, y: centerY };
  }
  return deltaY > 0
    ? { x: centerX, y: rect.bottom }
    : { x: centerX, y: rect.top };
}

export function onboardingArrowPath(from: OnboardingPoint, to: OnboardingPoint) {
  const deltaX = to.x - from.x;
  const deltaY = to.y - from.y;
  const length = Math.hypot(deltaX, deltaY) || 1;
  const bulge = Math.min(72, length * 0.32);
  const controlX = from.x + deltaX * 0.42 - (deltaY / length) * bulge;
  const controlY = from.y + deltaY * 0.42 + (deltaX / length) * bulge;
  return `M ${from.x} ${from.y} Q ${controlX} ${controlY} ${to.x} ${to.y}`;
}

export function onboardingArrowHeadPoints(
  from: OnboardingPoint,
  to: OnboardingPoint,
) {
  const angle = Math.atan2(to.y - from.y, to.x - from.x);
  const size = 11;
  const left = angle + Math.PI * 0.82;
  const right = angle - Math.PI * 0.82;
  return [
    `${to.x},${to.y}`,
    `${to.x + Math.cos(left) * size},${to.y + Math.sin(left) * size}`,
    `${to.x + Math.cos(right) * size},${to.y + Math.sin(right) * size}`,
  ].join(" ");
}
