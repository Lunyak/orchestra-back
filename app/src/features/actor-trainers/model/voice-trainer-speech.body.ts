type SpeakErrorInfo = {
  code: string;
  message: string;
};

type BackendTtsVoice = { name: string; locale?: string };

async function fetchBackendTtsVoices(): Promise<BackendTtsVoice[]> {
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
