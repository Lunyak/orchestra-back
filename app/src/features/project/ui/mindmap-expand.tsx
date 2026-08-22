import { AnimatePresence, motion } from "motion/react";
import {
  useState,
  type FocusEvent,
  type ReactNode,
} from "react";

const expandEase = [0.22, 1, 0.36, 1] as const;

type MindmapExpandHandlers = {
  onMouseEnter: () => void;
  onMouseLeave: () => void;
  onFocusCapture: () => void;
  onBlurCapture: (event: FocusEvent<HTMLElement>) => void;
};

export function useMindmapBranchExpand(forceOpen: boolean, enabled: boolean) {
  const [hovered, setHovered] = useState(false);
  const isOpen = !enabled || forceOpen || hovered;

  const expandProps: MindmapExpandHandlers = {
    onMouseEnter: () => {
      if (enabled) setHovered(true);
    },
    onMouseLeave: () => {
      setHovered(false);
    },
    onFocusCapture: () => {
      if (enabled) setHovered(true);
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
};

export function MindmapExpandPresence({
  open,
  children,
}: MindmapExpandPresenceProps) {
  return (
    <div className="project-nav-mindmap__expand-anchor">
      <AnimatePresence initial={false}>
        {open ? (
          <motion.div
            key="mindmap-expand"
            className="project-nav-mindmap__expand"
            initial={{ opacity: 0, x: -12 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -8 }}
            transition={{ duration: 0.24, ease: expandEase }}
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
