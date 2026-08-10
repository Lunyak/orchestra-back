import type { ProjectTaskFilter } from "./project-task-labels";

type Listener = () => void;

export type ProjectTaskFilterCounts = {
  open: number;
  mine: number;
  all: number;
};

export type ProjectTaskFilterSnapshot = {
  filter: ProjectTaskFilter;
  counts: ProjectTaskFilterCounts;
};

const DEFAULT_COUNTS: ProjectTaskFilterCounts = {
  open: 0,
  mine: 0,
  all: 0,
};

let snapshot: ProjectTaskFilterSnapshot = {
  filter: "open",
  counts: DEFAULT_COUNTS,
};
const listeners = new Set<Listener>();

function emit() {
  for (const listener of listeners) {
    listener();
  }
}

export function getProjectTaskFilter(): ProjectTaskFilter {
  return snapshot.filter;
}

export function setProjectTaskFilter(next: ProjectTaskFilter): void {
  if (snapshot.filter === next) return;
  snapshot = { ...snapshot, filter: next };
  emit();
}

export function getProjectTaskFilterCounts(): ProjectTaskFilterCounts {
  return snapshot.counts;
}

export function setProjectTaskFilterCounts(next: ProjectTaskFilterCounts): void {
  const current = snapshot.counts;
  const isSame =
    current.open === next.open &&
    current.mine === next.mine &&
    current.all === next.all;
  if (isSame) return;
  snapshot = { ...snapshot, counts: next };
  emit();
}

export function subscribeProjectTaskFilter(listener: Listener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function getProjectTaskFilterSnapshot(): ProjectTaskFilterSnapshot {
  return snapshot;
}
