import { AnimatePresence, motion } from "motion/react";
import cn from "classnames";
import {
  useEffect,
  useState,
  type FocusEvent,
  type ReactNode,
} from "react";

const expandEase = [0.22, 1, 0.36, 1] as const;
const MINDMAP_STACK_MQ = "(max-width: 720px)";

export function useMindmapStackLayout() {
  const [stackLayout, setStackLayout] = useState(() => {
    if (typeof window === "undefined") return false;
    return window.matchMedia(MINDMAP_STACK_MQ).matches;
  });

  useEffect(() => {
    const mediaQuery = window.matchMedia(MINDMAP_STACK_MQ);
    const onChange = () => setStackLayout(mediaQuery.matches);
    onChange();
    mediaQuery.addEventListener("change", onChange);
    return () => mediaQuery.removeEventListener("change", onChange);
  }, []);

  return stackLayout;
}

type MindmapExpandHandlers = {
  onMouseEnter: () => void;
  onMouseLeave: () => void;
  onFocusCapture: () => void;
  onBlurCapture: (event: FocusEvent<HTMLElement>) => void;
};

export function useMindmapBranchExpand(
  forceOpen: boolean,
  enabled: boolean,
  alwaysOpen = false,
) {
  const [hovered, setHovered] = useState(false);
  const isOpen = !enabled || forceOpen || hovered || alwaysOpen;

  const expandProps: MindmapExpandHandlers = {
    onMouseEnter: () => {
      if (enabled && !alwaysOpen) setHovered(true);
    },
    onMouseLeave: () => {
      setHovered(false);
    },
    onFocusCapture: () => {
      if (enabled && !alwaysOpen) setHovered(true);
    },
    onBlurCapture: (event: FocusEvent<HTMLElement>) => {
      const nextFocus = event.relatedTarget;
      if (
        nextFocus instanceof Node &&
        event.currentTarget.contains(nextFocus)
      ) {
        return;
      }
      setHovered(false);
    },
  };

  return { isOpen, expandProps };
}

type MindmapExpandPresenceProps = {
  open: boolean;
  children: ReactNode;
  stackLayout?: boolean;
};

export function MindmapExpandPresence({
  open,
  children,
  stackLayout = false,
}: MindmapExpandPresenceProps) {
  return (
    <div className="project-nav-mindmap__expand-anchor">
      <AnimatePresence initial={false}>
        {open ? (
          <motion.div
            key="mindmap-expand"
            className={cn(
              "project-nav-mindmap__expand",
              stackLayout && "project-nav-mindmap__expand--stack",
            )}
            initial={
              stackLayout
                ? { opacity: 0, height: 0 }
                : { opacity: 0, x: -12 }
            }
            animate={
              stackLayout
                ? { opacity: 1, height: "auto" }
                : { opacity: 1, x: 0 }
            }
            exit={
              stackLayout
                ? { opacity: 0, height: 0 }
                : { opacity: 0, x: -8 }
            }
            transition={{ duration: 0.28, ease: expandEase }}
          >
            {children}
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
}

type MindmapMotionItemProps = {
  animated: boolean;
  staggerIndex?: number;
  className?: string;
  children: ReactNode;
} & MindmapExpandHandlers;

export function MindmapMotionItem({
  animated,
  staggerIndex = 0,
  className,
  children,
  onMouseEnter,
  onMouseLeave,
  onFocusCapture,
  onBlurCapture,
}: MindmapMotionItemProps) {
  const handlers = {
    onMouseEnter,
    onMouseLeave,
    onFocusCapture,
    onBlurCapture,
  };

  if (!animated) {
    return (
      <li className={className} {...handlers}>
        {children}
      </li>
    );
  }

  const staggerDelay = staggerIndex * 0.045;

  return (
    <motion.li
      className={className}
      initial={{ opacity: 0, x: -12 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{
        duration: 0.26,
        delay: staggerDelay,
        ease: expandEase,
      }}
      {...handlers}
    >
      {children}
    </motion.li>
  );
}
