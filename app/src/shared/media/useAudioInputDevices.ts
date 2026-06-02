import { useCallback, useEffect, useState } from "react";
import {
  audioInputConstraints,
  micDeviceLabel,
  readAudioInputDeviceId,
  writeAudioInputDeviceId,
} from "./audio-input-prefs";

export function useAudioInputDevices() {
  const [devices, setDevices] = useState<MediaDeviceInfo[]>([]);
  const [selectedDeviceId, setSelectedDeviceIdState] = useState(readAudioInputDeviceId);
  const [labelsReady, setLabelsReady] = useState(false);

  const refreshDevices = useCallback(async () => {
    if (typeof navigator === "undefined" || !navigator.mediaDevices?.enumerateDevices) {
      setDevices([]);
      return;
    }
    try {
      const list = await navigator.mediaDevices.enumerateDevices();
      const inputs = list.filter((d) => d.kind === "audioinput");
      setDevices(inputs);
      setLabelsReady(inputs.some((d) => Boolean(String(d.label ?? "").trim())));
    } catch {
      setDevices([]);
    }
  }, []);

  useEffect(() => {
    void refreshDevices();
    const md = navigator.mediaDevices;
    if (!md?.addEventListener) return;
    const onChange = () => {
      void refreshDevices();
    };
    md.addEventListener("devicechange", onChange);
    return () => md.removeEventListener("devicechange", onChange);
  }, [refreshDevices]);

  const setSelectedDeviceId = useCallback((deviceId: string) => {
    const id = String(deviceId ?? "").trim();
    setSelectedDeviceIdState(id);
    writeAudioInputDeviceId(id);
  }, []);

  const deviceOptions = devices.map((d, i) => ({
    value: d.deviceId,
    label: micDeviceLabel(d, i),
  }));

  const selectOptions = [{ value: "", label: "По умолчанию (системный)" }, ...deviceOptions];

  const getConstraints = useCallback(
    () => audioInputConstraints(selectedDeviceId),
    [selectedDeviceId],
  );

  return {
    devices,
    deviceOptions,
    selectOptions,
    selectedDeviceId,
    setSelectedDeviceId,
    refreshDevices,
    labelsReady,
    getConstraints,
  };
}
