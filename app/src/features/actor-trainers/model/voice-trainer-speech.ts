import { api } from "../../../sync/api/client";

export function getSpeechRecognition(): any | null {
  if (typeof window === "undefined") return null;
  const w = window as any;
  return w.SpeechRecognition || w.webkitSpeechRecognition || null;
}

export type SpeakErrorInfo = {
  code: string;
  message: string;
};

export type BackendTtsVoice = { name: string; locale?: string };

export async function fetchBackendTtsVoices(): Promise<BackendTtsVoice[]> {
  const res = await api.get("/tts/voices");
  const data = res.data;
  if (!Array.isArray(data)) return [];
  return data
    .map((x: any) => ({
      name: String(x?.name ?? ""),
      locale: x?.locale ? String(x.locale) : undefined,
    }))
    .filter((v) => v.name);
}
