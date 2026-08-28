import type { KadrProjectorCue } from "../../theater/model/kadr-projector";
import { getDesktopApi } from "../../../shared/platform/desktop-api";
import { desktopAddProjectImage } from "../../../shared/platform/desktop-methods";
import { uploadProjectFile } from "../../../sync/api/files";
import { ensureProject } from "../../../sync/api/projects";
import type { CreateKadrDraft } from "./create-kadr-from-draft";

const DEFAULT_RUN_LABEL_SEC = 30;

export async function uploadKadrImageMarkdown(
  projectName: string,
  file: File,
): Promise<string | null> {
  const alt = (file.name.replace(/\.[^.]+$/, "") || "картинка").trim() || "картинка";
  const desktopApi = getDesktopApi();
  if (desktopApi) {
    const buffer = await file.arrayBuffer();
    const result = await desktopAddProjectImage(
      desktopApi,
      projectName,
      buffer,
      file.type,
      file.name,
    );
    if (!result?.markdownPath) return null;
    return `\n![${alt}](${result.markdownPath})\n`;
  }

  const accessToken =
    typeof window !== "undefined" ? window.localStorage.getItem("accessToken") : null;
  if (!accessToken) return null;

  const project = await ensureProject(accessToken, projectName, `Проект ${projectName}`);
  const { key } = await uploadProjectFile(accessToken, {
    projectId: project.id,
    type: "image",
    file,
  });
  const token = `orchestra-image:${encodeURIComponent(key)}`;
  return `\n![${alt}](${token})\n`;
}

export function parseProjectorSelectValue(
  value: string,
  previousCue: KadrProjectorCue | null = null,
): KadrProjectorCue | null {
  const preserveMuted =
    previousCue?.mode === "video" ? Boolean(previousCue.muted) : false;

  if (!value || value === "none") return null;
  if (value === "hold") return { mode: "hold" };
  if (value.startsWith("hold:")) {
    const holdId = Math.trunc(Number(value.slice(5)) || 0);
    return holdId > 0 ? { mode: "hold", holdId } : { mode: "hold" };
  }
  const videoId = Math.trunc(Number(value) || 0);
  if (videoId <= 0) return null;
  return preserveMuted
    ? { mode: "video", videoId, muted: true }
    : { mode: "video", videoId };
}

export function toggleRunLabelSec(
  prev: CreateKadrDraft,
  field: "blackoutDurationSec" | "smokeDurationSec",
): CreateKadrDraft {
  const enabled = prev[field] != null;
  return { ...prev, [field]: enabled ? null : DEFAULT_RUN_LABEL_SEC };
}

export function setRunLabelSec(
  prev: CreateKadrDraft,
  field: "blackoutDurationSec" | "smokeDurationSec",
  raw: string,
): CreateKadrDraft {
  const seconds = Math.trunc(Number(raw) || 0);
  return { ...prev, [field]: seconds > 0 ? seconds : null };
}

export function projectorSelectValue(cue: KadrProjectorCue | null): string {
  if (!cue) return "none";
  if (cue.mode === "hold") {
    return cue.holdId != null && cue.holdId > 0 ? `hold:${cue.holdId}` : "hold";
  }
  return String(cue.videoId);
}
