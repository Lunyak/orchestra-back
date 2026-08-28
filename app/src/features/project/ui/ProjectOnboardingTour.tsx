import cn from "classnames";
import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties } from "react";
import { createPortal } from "react-dom";
import { usePageBoot } from "@shared/components/page-loader/page-boot";
import {
  ONBOARDING_RING_PAD,
  onboardingArrowHeadPoints,
  onboardingArrowPath,
  onboardingEdgeAnchor,
  placeOnboardingCard,
  type OnboardingCardBox,
} from "../model/project-onboarding-layout";
import {
  onboardingCardPrefer,
  onboardingTargetSelector,
  PROJECT_ONBOARDING_SCRIPT_ID,
  type ProjectOnboardingStep,
} from "../model/project-onboarding";
import { ProjectOnboardingCoverStep } from "./ProjectOnboardingCoverStep";
import { ProjectOnboardingNavStep } from "./ProjectOnboardingNavStep";
import { ProjectOnboardingPanelsStep } from "./ProjectOnboardingPanelsStep";
import { ProjectOnboardingPlaylistStep } from "./ProjectOnboardingPlaylistStep";
import { ProjectOnboardingScriptStep } from "./ProjectOnboardingScriptStep";
import { ProjectOnboardingSplitStep } from "./ProjectOnboardingSplitStep";
import "./project-onboarding.css";

const ANCHOR_TICK_LIMIT = 180;

function queryVisibleTarget(selector: string) {
  const nodes = document.querySelectorAll(selector);
  for (const node of nodes) {
    const rect = node.getBoundingClientRect();
    if (rect.width > 1 && rect.height > 1) return node;
  }
  return null;
}

function useAnchorRect(selector: string, enabled: boolean) {
  const [rect, setRect] = useState<DOMRect | null>(null);

  useEffect(() => {
    if (!enabled) {
      setRect(null);
      return;
    }
    let frame = 0;
    let ticks = 0;
    const update = () => {
      const node = queryVisibleTarget(selector);
      setRect(node ? node.getBoundingClientRect() : null);
      return Boolean(node);
    };
    const onChange = () => {
      update();
    };
    update();
    const observer = new ResizeObserver(onChange);
    observer.observe(document.documentElement);
    window.addEventListener("scroll", onChange, true);
    window.addEventListener("resize", onChange);
    const tick = () => {
      const found = update();
      ticks += 1;
      if (!found && ticks < ANCHOR_TICK_LIMIT) {
        frame = window.requestAnimationFrame(tick);
      }
    };
    frame = window.requestAnimationFrame(tick);
    return () => {
      observer.disconnect();
      window.removeEventListener("scroll", onChange, true);
      window.removeEventListener("resize", onChange);
      window.cancelAnimationFrame(frame);
    };
  }, [enabled, selector]);

  return rect;
}

type ProjectOnboardingTourProps = {
  step: ProjectOnboardingStep;
  projectSlug: string;
  onNext: () => void;
  onDismiss: () => void;
};

function OnboardingStepBody({
  step,
  projectSlug,
}: {
  step: ProjectOnboardingStep;
  projectSlug: string;
}) {
  if (step === "cover") return <ProjectOnboardingCoverStep />;
  if (step === "nav") return <ProjectOnboardingNavStep />;
  if (step === "script") {
    return <ProjectOnboardingScriptStep projectSlug={projectSlug} />;
  }
  if (step === "panels") return <ProjectOnboardingPanelsStep />;
  if (step === "playlist") return <ProjectOnboardingPlaylistStep />;
  return <ProjectOnboardingSplitStep />;
}

export function ProjectOnboardingTour({
  step,
  projectSlug,
  onNext,
  onDismiss,
}: ProjectOnboardingTourProps) {
  const { blocking } = usePageBoot();
  const pageReady = !blocking;
  const cardRef = useRef<HTMLDivElement>(null);
  const selector = onboardingTargetSelector(step);
  const targetRect = useAnchorRect(selector, pageReady);
  const [cardBox, setCardBox] = useState<OnboardingCardBox | null>(null);
  const isLastStep = step === "split";
  const actionLabel = isLastStep ? "Понятно" : "Далее";
  const hasTarget = Boolean(
    targetRect && targetRect.width > 1 && targetRect.height > 1,
  );

  useLayoutEffect(() => {
    if (!hasTarget || !targetRect) {
      setCardBox(null);
      return;
    }
    const cardHeight = cardRef.current?.offsetHeight ?? 188;
    const cardWidth = cardRef.current?.offsetWidth;
    setCardBox(
      placeOnboardingCard(targetRect, cardHeight, {
        prefer: onboardingCardPrefer(step),
        cardWidth,
      }),
    );
  }, [hasTarget, targetRect, step]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onDismiss();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onDismiss]);

  useEffect(() => {
    if (!hasTarget) return;
    const node = queryVisibleTarget(selector);
    if (!(node instanceof HTMLElement)) return;
    node.scrollIntoView({ block: "nearest", inline: "nearest" });
  }, [hasTarget, selector]);

  useEffect(() => {
    if (step !== "script") return;
    const onClick = (event: MouseEvent) => {
      const node = event.target;
      if (!(node instanceof Element)) return;
      const hit = node.closest(
        `[data-project-nav-id="${PROJECT_ONBOARDING_SCRIPT_ID}"]`,
      );
      if (!hit) return;
      event.preventDefault();
      event.stopPropagation();
      onNext();
    };
    document.addEventListener("click", onClick, true);
    return () => document.removeEventListener("click", onClick, true);
  }, [onNext, step]);

  if (!pageReady || !hasTarget || !targetRect) return null;

  const cardRect =
    cardBox && cardRef.current
      ? new DOMRect(
          cardBox.left,
          cardBox.top,
          cardRef.current.offsetWidth,
          cardRef.current.offsetHeight,
        )
      : null;
  const targetCenter = {
    x: targetRect.left + targetRect.width / 2,
    y: targetRect.top + targetRect.height / 2,
  };
  const fromPoint = cardRect
    ? onboardingEdgeAnchor(cardRect, targetCenter.x, targetCenter.y)
    : null;
  const toPoint = fromPoint
    ? onboardingEdgeAnchor(targetRect, fromPoint.x, fromPoint.y)
    : null;
  const showArrow = Boolean(fromPoint && toPoint);

  return createPortal(
    <div className="project-onboarding" role="dialog" aria-labelledby="project-onboarding-title">
      <div
        className="project-onboarding__ring"
        style={{
          "--onboarding-top": `${targetRect.top - ONBOARDING_RING_PAD}px`,
          "--onboarding-left": `${targetRect.left - ONBOARDING_RING_PAD}px`,
          "--onboarding-width": `${targetRect.width + ONBOARDING_RING_PAD * 2}px`,
          "--onboarding-height": `${targetRect.height + ONBOARDING_RING_PAD * 2}px`,
        } as CSSProperties}
      />

      {showArrow && fromPoint && toPoint ? (
        <svg
          className="project-onboarding__arrow"
          viewBox={`0 0 ${window.innerWidth} ${window.innerHeight}`}
          width={window.innerWidth}
          height={window.innerHeight}
          aria-hidden="true"
        >
          <path d={onboardingArrowPath(fromPoint, toPoint)} />
          <polygon points={onboardingArrowHeadPoints(fromPoint, toPoint)} />
        </svg>
      ) : null}

      <div
        ref={cardRef}
        className={cn(
          "project-onboarding__card",
          `project-onboarding__card--${step}`,
          cardBox && "project-onboarding__card--placed",
        )}
        style={
          cardBox
            ? ({
                "--onboarding-top": `${cardBox.top}px`,
                "--onboarding-left": `${cardBox.left}px`,
              } as CSSProperties)
            : undefined
        }
      >
        <p className="project-onboarding__kicker">Новый проект</p>
        <OnboardingStepBody step={step} projectSlug={projectSlug} />
        <div className="project-onboarding__actions">
          <button
            type="button"
            className="project-onboarding__skip"
            onClick={onDismiss}
          >
            Пропустить
          </button>
          <button
            type="button"
            className="project-onboarding__next"
            onClick={onNext}
          >
            {actionLabel}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
