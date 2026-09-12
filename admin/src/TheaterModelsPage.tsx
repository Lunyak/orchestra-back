import { useCallback, useEffect, useMemo, useState, type DragEvent } from "react";
import {
  getTheaterAssets,
  uploadTheaterAsset,
  uploadTheaterAssetsMany,
  type TheaterAssetSlot,
  type TheaterKitGroup,
} from "./api";

const GROUP_LABEL: Record<TheaterKitGroup, string> = {
  spotlights: "Софиты",
  rig: "Фермы",
  doors: "Двери",
  humans: "Люди",
  library: "Библиотека",
};

const GROUP_ORDER: TheaterKitGroup[] = [
  "spotlights",
  "rig",
  "doors",
  "humans",
  "library",
];

function formatBytes(size: number | null): string {
  if (size == null || size <= 0) return "—";
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${Math.round(size / 1024)} KB`;
  return `${(size / (1024 * 1024)).toFixed(1)} MB`;
}

function errorText(err: unknown): string {
  return err instanceof Error ? err.message : "Ошибка";
}

export function TheaterModelsPage() {
  const [slots, setSlots] = useState<TheaterAssetSlot[]>([]);
  const [extras, setExtras] = useState<
    Array<{ key: string; size: number; lastModified: string | null; url: string }>
  >([]);
  const [missing, setMissing] = useState(0);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [ok, setOk] = useState("");
  const [onlyMissing, setOnlyMissing] = useState(false);
  const [dragOver, setDragOver] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const data = await getTheaterAssets();
      setSlots(data.slots);
      setExtras(data.extras);
      setMissing(data.missing);
      setTotal(data.total);
    } catch (err) {
      setError(errorText(err));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load().catch(() => {});
  }, [load]);

  const grouped = useMemo(() => {
    const visible = onlyMissing ? slots.filter((slot) => !slot.present) : slots;
    return GROUP_ORDER.map((group) => ({
      group,
      items: visible.filter((slot) => slot.group === group),
    })).filter((section) => section.items.length > 0);
  }, [onlyMissing, slots]);

  const uploadFiles = async (files: File[], key?: string) => {
    const list = files.filter(Boolean);
    if (list.length === 0) return;
    setError("");
    setOk("");
    setBusyKey(key ?? "batch");
    try {
      if (key && list.length === 1) {
        await uploadTheaterAsset(list[0], key);
        setOk(`Загружено: ${key}`);
      } else {
        const result = await uploadTheaterAssetsMany(list);
        const okCount = result.uploaded.length;
        const failCount = result.errors.length;
        const failText = result.errors
          .map((item) => `${item.name}: ${item.message}`)
          .join("; ");
        if (failCount > 0) setError(failText);
        if (okCount > 0) setOk(`Залито файлов: ${okCount}`);
      }
      await load();
    } catch (err) {
      setError(errorText(err));
    } finally {
      setBusyKey(null);
    }
  };

  const onDrop = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setDragOver(false);
    const files = Array.from(event.dataTransfer.files);
    void uploadFiles(files);
  };

  const dropClass = dragOver ? "admin-theater-drop is-over" : "admin-theater-drop";

  if (loading && slots.length === 0) {
    return <div className="admin-page">Загрузка…</div>;
  }

  return (
    <div className="admin-page">
      <h1>3D-модели театра</h1>
      <p className="admin-theater-lead">
        Файлы кладутся в MinIO под <code>theater/</code>. Имя файла должно
        совпадать со слотом, например <code>stage-spotlight.glb</code>.
        Чтобы сцена их подхватила, в сборке web нужен{" "}
        <code>VITE_THEATER_ASSETS_BASE_URL</code> на бакет MinIO.
      </p>
      <p className="admin-theater-status">
        На проде: {total - missing} / {total}
        {missing > 0 ? ` · нет ${missing}` : ""}
      </p>

      <div
        className={dropClass}
        onDragOver={(event) => {
          event.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={onDrop}
      >
        <span>Перетащите .glb сюда или выберите пачку файлов</span>
        <label className="admin-theater-file">
          Выбрать файлы
          <input
            type="file"
            accept=".glb,.gltf"
            multiple
            disabled={busyKey != null}
            onChange={(event) => {
              const files = Array.from(event.target.files ?? []);
              event.target.value = "";
              void uploadFiles(files);
            }}
          />
        </label>
      </div>

      <label className="admin-theater-filter">
        <input
          type="checkbox"
          checked={onlyMissing}
          onChange={(event) => setOnlyMissing(event.target.checked)}
        />
        Только отсутствующие
      </label>

      {ok ? <p className="admin-theater-ok">{ok}</p> : null}
      {error ? <p className="admin-theater-error">{error}</p> : null}

      {grouped.map((section) => (
        <section key={section.group} className="admin-theater-section">
          <h2>{GROUP_LABEL[section.group]}</h2>
          <table>
            <thead>
              <tr>
                <th>Статус</th>
                <th>Модель</th>
                <th>Ключ</th>
                <th>Размер</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {section.items.map((slot) => {
                const statusClass = slot.present
                  ? "admin-theater-pill is-ok"
                  : "admin-theater-pill is-missing";
                return (
                  <tr key={slot.key}>
                    <td>
                      <span className={statusClass}>
                        {slot.present ? "есть" : "нет"}
                      </span>
                    </td>
                    <td>{slot.label}</td>
                    <td>
                      <code>{slot.key}</code>
                    </td>
                    <td>{formatBytes(slot.size)}</td>
                    <td>
                      <label className="admin-theater-file">
                        {busyKey === slot.key ? "…" : "Залить"}
                        <input
                          type="file"
                          accept=".glb,.gltf"
                          disabled={busyKey != null}
                          onChange={(event) => {
                            const file = event.target.files?.[0];
                            event.target.value = "";
                            if (file) void uploadFiles([file], slot.key);
                          }}
                        />
                      </label>
                      {slot.present ? (
                        <a
                          href={slot.url}
                          target="_blank"
                          rel="noreferrer"
                          className="admin-link"
                        >
                          открыть
                        </a>
                      ) : null}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </section>
      ))}

      {extras.length > 0 ? (
        <section className="admin-theater-section">
          <h2>Другие файлы в theater/</h2>
          <ul className="admin-theater-extras">
            {extras.map((item) => (
              <li key={item.key}>
                <code>{item.key}</code>
                <span>{formatBytes(item.size)}</span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}
