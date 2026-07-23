import cn from "classnames";
import { Capacitor } from "@capacitor/core";
import { Network } from "@capacitor/network";
import React, { useCallback, useEffect, useState } from "react";
import { usePlaybook } from "../../../features/playbook";
import { useAuth } from "../../../features/auth";
import { useProject } from "../../../features/project";
import { getDesktopApi } from "../../platform/desktop-api";
import { isOfflineNativePlatform } from "../../platform/media-url";
import { DownloadProjectorMediaButton } from "./DownloadProjectorMediaButton";
import "./OfflinePackStatus.css";

export function OfflinePackStatus() {
  const { projectName } = useProject();
  const { accessToken } = useAuth();
  const { syncFromServer } = usePlaybook();
  const [online, setOnline] = useState(true);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;
    let cancelled = false;
    void Network.getStatus().then((s) => {
      if (!cancelled) setOnline(s.connected);
    });
    const h = Network.addListener("networkStatusChange", (s) => {
      setOnline(s.connected);
    });
    return () => {
      cancelled = true;
      void h.then((l) => l.remove());
    };
  }, []);

  const downloadPack = useCallback(async () => {
    if (!projectName || !accessToken) {
      setMessage("Войдите и выберите проект");
      return;
    }
    setBusy(true);
    setMessage(null);
    try {
      await syncFromServer(accessToken, projectName);
      setMessage("Синхронизация запущена. Медиа и текстуры театра качаются в фоне.");
    } catch (e: any) {
      setMessage(e?.message ?? "Не удалось синхронизировать");
    } finally {
      setBusy(false);
    }
  }, [projectName, accessToken, syncFromServer]);

  if (!isOfflineNativePlatform()) return null;

  const hasLocalApi = Boolean(getDesktopApi()?.readProjectPlaybook);

  return (
    <div className="offline-pack-status" role="status">
      <span className={cn("offline-pack-status__dot", online ? "offline-pack-status__dot--online" : "offline-pack-status__dot--offline")} />
      <span className="offline-pack-status__text">
        {Capacitor.isNativePlatform()
          ? online
            ? "Сеть есть — можно обновить офлайн-пакет"
            : "Без сети — используется локальная копия"
          : "Офлайн-режим"}
      </span>
      {hasLocalApi ? (
        <>
          <button
            type="button"
            className="offline-pack-status__btn"
            disabled={busy || !online || !projectName}
            onClick={() => void downloadPack()}
          >
            {busy ? "Загрузка…" : "Скачать для прогона"}
          </button>
          <DownloadProjectorMediaButton
            buttonClassName="offline-pack-status__btn offline-pack-status__btn--secondary"
          />
        </>
      ) : null}
      {message ? <span className="offline-pack-status__hint">{message}</span> : null}
    </div>
  );
}
