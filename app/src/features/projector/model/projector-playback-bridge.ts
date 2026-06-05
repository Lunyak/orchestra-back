const CHANNEL_NAME = "orchestra-projector-v1";

export type ProjectorShowHold = {
  type: "show-hold";
  /** Локальный/offline URL, если нет storageKey */
  src: string | null;
  /** Ключ в хранилище — окно проектора само грузит через /files/stream */
  storageKey: string | null;
  holdId: number | null;
};
export type ProjectorShowVideo = {
  type: "show-video";
  src: string;
  storageKey: string | null;
  holdSrc: string | null;
  holdStorageKey: string | null;
  holdId: number | null;
  videoId: number;
  muted?: boolean;
};
export type ProjectorBlack = { type: "black" };
export type ProjectorReady = { type: "ready" };
export type ProjectorPauseVideo = { type: "pause-video" };
export type ProjectorResumeVideo = { type: "resume-video" };
export type ProjectorSetVideoMuted = { type: "set-video-muted"; muted: boolean };

export type ProjectorPlaybackState = {
  type: "playback-state";
  videoId: number | null;
  holdId: number | null;
  playing: boolean;
  mode: "video" | "hold" | "black";
};

/** Ошибка загрузки/воспроизведения — только для экрана репетиции, не для зала. */
export type ProjectorOutputError = {
  type: "output-error";
  scope: "hold" | "video";
  message: string;
};

export type ProjectorMessage =
  | ProjectorShowHold
  | ProjectorShowVideo
  | ProjectorBlack
  | ProjectorReady
  | ProjectorPauseVideo
  | ProjectorResumeVideo
  | ProjectorSetVideoMuted
  | ProjectorPlaybackState
  | ProjectorOutputError;

export type ProjectorCommandMessage = Exclude<
  ProjectorMessage,
  ProjectorReady | ProjectorPlaybackState
>;

let projectorWindow: Window | null = null;
let channel: BroadcastChannel | null = null;
let lastMessage: ProjectorCommandMessage | null = null;

type PlaybackListener = (state: Omit<ProjectorPlaybackState, "type">) => void;
const playbackListeners = new Set<PlaybackListener>();

type OutputErrorListener = (error: Omit<ProjectorOutputError, "type">) => void;
const outputErrorListeners = new Set<OutputErrorListener>();

function getChannel(): BroadcastChannel {
  if (!channel) channel = new BroadcastChannel(CHANNEL_NAME);
  return channel;
}

function isReplayableCommand(msg: ProjectorMessage): msg is ProjectorCommandMessage {
  return (
    msg.type === "show-hold" ||
    msg.type === "show-video" ||
    msg.type === "black" ||
    msg.type === "pause-video" ||
    msg.type === "resume-video"
  );
}

function bumpPlayback(state: Omit<ProjectorPlaybackState, "type">) {
  playbackListeners.forEach((listener) => listener(state));
}

function bumpOutputError(error: Omit<ProjectorOutputError, "type">) {
  outputErrorListeners.forEach((listener) => listener(error));
}

export function isProjectorWindowOpen(): boolean {
  return projectorWindow != null && !projectorWindow.closed;
}

function projectorOutputPath(): string {
  const base = String(import.meta.env.BASE_URL || "/").replace(/\/$/, "");
  return `${base}/projector-output`;
}

export function openProjectorWindow(): Window | null {
  if (isProjectorWindowOpen()) {
    projectorWindow?.focus();
    return projectorWindow;
  }

  const url = new URL(projectorOutputPath(), window.location.origin).toString();
  projectorWindow = window.open(
    url,
    "orchestra-projector",
    "menubar=no,toolbar=no,location=no,status=no",
  );

  return projectorWindow;
}

export function closeProjectorWindow(): void {
  if (projectorWindow && !projectorWindow.closed) {
    projectorWindow.close();
  }
  projectorWindow = null;
  bumpPlayback({ videoId: null, holdId: null, playing: false, mode: "black" });
}

export function sendProjectorMessage(msg: ProjectorMessage): void {
  if (isReplayableCommand(msg)) lastMessage = msg;
  getChannel().postMessage(msg);
}

export function replayLastProjectorMessage(): void {
  if (lastMessage) sendProjectorMessage(lastMessage);
}

export function subscribeProjectorMessages(
  handler: (msg: ProjectorMessage) => void,
): () => void {
  const ch = getChannel();
  const listener = (ev: MessageEvent) => handler(ev.data as ProjectorMessage);
  ch.addEventListener("message", listener);
  return () => ch.removeEventListener("message", listener);
}

export function subscribeProjectorPlayback(listener: PlaybackListener): () => void {
  playbackListeners.add(listener);
  return () => playbackListeners.delete(listener);
}

export function subscribeProjectorOutputErrors(listener: OutputErrorListener): () => void {
  outputErrorListeners.add(listener);
  return () => outputErrorListeners.delete(listener);
}

export function notifyProjectorReady(): () => void {
  const listener = (ev: MessageEvent) => {
    const msg = ev.data as ProjectorMessage;
    if (msg?.type === "ready") replayLastProjectorMessage();
    if (msg?.type === "playback-state") {
      bumpPlayback({
        videoId: msg.videoId,
        holdId: msg.holdId,
        playing: msg.playing,
        mode: msg.mode,
      });
    }
    if (msg?.type === "output-error") {
      bumpOutputError({ scope: msg.scope, message: msg.message });
    }
  };
  const ch = getChannel();
  ch.addEventListener("message", listener);
  return () => ch.removeEventListener("message", listener);
}

export function pauseProjectorVideo(): void {
  sendProjectorMessage({ type: "pause-video" });
}

export function resumeProjectorVideo(): void {
  sendProjectorMessage({ type: "resume-video" });
}

export function sendProjectorVideoMuted(muted: boolean): void {
  sendProjectorMessage({ type: "set-video-muted", muted });
}
