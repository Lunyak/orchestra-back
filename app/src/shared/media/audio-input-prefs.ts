const STORAGE_KEY = "voiceTrainer:audioInputDeviceId";

export function readAudioInputDeviceId(): string {
  if (typeof window === "undefined") return "";
  try {
    return String(localStorage.getItem(STORAGE_KEY) ?? "").trim();
  } catch {
    return "";
  }
}

export function writeAudioInputDeviceId(deviceId: string): void {
  if (typeof window === "undefined") return;
  try {
    const id = String(deviceId ?? "").trim();
    if (!id) localStorage.removeItem(STORAGE_KEY);
    else localStorage.setItem(STORAGE_KEY, id);
  } catch {
    // ignore
  }
}

export function audioInputConstraints(deviceId: string): MediaStreamConstraints {
  const id = String(deviceId ?? "").trim();
  if (!id) return { audio: true };
  return { audio: { deviceId: { exact: id } } };
}

export function micDeviceLabel(device: MediaDeviceInfo, index: number): string {
  const label = String(device.label ?? "").trim();
  if (label) return label;
  return `Микрофон ${index + 1}`;
}
