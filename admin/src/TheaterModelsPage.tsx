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

const MODEL_EXT = /\.(glb|gltf)$/i;
const UPLOAD_CHUNK = 6;

type FsEntry = {
  isFile: boolean;
  isDirectory: boolean;
  file: (ok: (file: File) => void, err?: (error: DOMException) => void) => void;
  createReader: () => {
    readEntries: (
      ok: (entries: FsEntry[]) => void,
      err?: (error: DOMException) => void,
    ) => void;
  };
};

function formatBytes(size: number | null): string {
  if (size == null || size <= 0) return "—";
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${Math.round(size / 1024)} KB`;
  return `${(size / (1024 * 1024)).toFixed(1)} MB`;
}

function errorText(err: unknown): string {
  return err instanceof Error ? err.message : "Ошибка";
}

function isModelFile(file: File) {
  return MODEL_EXT.test(file.name);
}

function filesFromList(list: FileList | File[] | null): File[] {
  return Array.from(list ?? []).filter(isModelFile);
}

function readDirectoryEntries(reader: ReturnType<FsEntry["createReader"]>) {
  return new Promise<FsEntry[]>((resolve, reject) => {
    const all: FsEntry[] = [];
    const next = () => {
      reader.readEntries((batch) => {
        if (batch.length === 0) {
          resolve(all);
          return;
        }
        all.push(...batch);
        next();
      }, reject);
    };
    next();
  });
}

async function filesFromEntry(entry: FsEntry): Promise<File[]> {
  if (entry.isFile) {
    const file = await new Promise<File>((resolve, reject) => {
      entry.file(resolve, reject);
    });
    return isModelFile(file) ? [file] : [];
  }
  if (!entry.isDirectory) return [];
  const children = await readDirectoryEntries(entry.createReader());
  const nested = await Promise.all(children.map(filesFromEntry));
  return nested.flat();
}

async function filesFromDataTransfer(data: DataTransfer): Promise<File[]> {
  const items = Array.from(data.items ?? []);
  const fromEntries: File[] = [];
  for (const item of items) {
    const raw = item.webkitGetAsEntry?.();
    if (!raw) continue;
    fromEntries.push(...(await filesFromEntry(raw as unknown as FsEntry)));
  }
  if (fromEntries.length > 0) return fromEntries;
  return filesFromList(data.files);
}

function dropZoneClass(dragOver: boolean, busy: boolean) {
  if (busy) return "admin-theater-drop is-busy";
  if (dragOver) return "admin-theater-drop is-over";
  return "admin-theater-drop";
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
  const [progress, setProgress] = useState("");
  const [error, setError] = useState("");
  const [ok, setOk] = useState("");
  const [onlyMissing, setOnlyMissing] = useState(false);
  const [dragOver, setDragOver] = useState(false);

  const busy = busyKey != null;

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
    if (list.length === 0) {
      setError("Нет .glb/.gltf в выбранных файлах");
      return;
    }
    setError("");
    setOk("");
    setBusyKey(key ?? "batch");
    setProgress(list.length === 1 ? "1 / 1" : `0 / ${list.length}`);
    try {
      if (key && list.length === 1) {
        await uploadTheaterAsset(list[0], key);
        setOk(`Загружено: ${key}`);
      } else {
        let uploadedCount = 0;
        const failParts: string[] = [];
        for (let index = 0; index < list.length; index += UPLOAD_CHUNK) {
          const chunk = list.slice(index, index + UPLOAD_CHUNK);
          const result = await uploadTheaterAssetsMany(chunk);
          uploadedCount += result.uploaded.length;
          const done = Math.min(index + chunk.length, list.length);
          setProgress(`${done} / ${list.length}`);
          result.errors.forEach((item) => {
            failParts.push(`${item.name}: ${item.message}`);
          });
        }
        if (failParts.length > 0) setError(failParts.join("; "));
        if (uploadedCount > 0) setOk(`Залито файлов: ${uploadedCount}`);
      }
      await load();
    } catch (err) {
      setError(errorText(err));
    } finally {
      setBusyKey(null);
      setProgress("");
    }
  };

  const onDrop = async (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setDragOver(false);
    if (busy) return;
    const files = await filesFromDataTransfer(event.dataTransfer);
    void uploadFiles(files);
  };

  if (loading && slots.length === 0) {
    return <div className="admin-page">Загрузка…</div>;
  }

  return (
    <div className="admin-page">
      <h1>3D-модели театра</h1>
      <p className="admin-theater-lead">
        Залей папку целиком: локально это{" "}
        <code>web/public/theater</code>. Имена файлов должны совпадать со
        слотами (<code>stage-spotlight.glb</code> и т.д.). Сборка web должна
        смотреть на бакет через <code>VITE_THEATER_ASSETS_BASE_URL</code>.
      </p>
      <p className="admin-theater-status">
        На проде: {total - missing} / {total}
        {missing > 0 ? ` · нет ${missing}` : ""}
      </p>

      <div
        className={dropZoneClass(dragOver, busy)}
        onDragOver={(event) => {
          event.preventDefault();
          if (!busy) setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={onDrop}
      >
        <span>
          {busy
            ? `Загрузка ${progress}…`
            : "Перетащи папку theater или сразу все .glb"}
        </span>
        <div className="admin-theater-drop__actions">
          <label className="admin-theater-file">
            Выбрать файлы
            <input
              type="file"
              accept=".glb,.gltf"
              multiple
              disabled={busy}
              onChange={(event) => {
                const files = filesFromList(event.target.files);
                event.target.value = "";
                void uploadFiles(files);
              }}
            />
          </label>
          <label className="admin-theater-file">
            Выбрать папку
            <input
              type="file"
              multiple
              disabled={busy}
              {...({ webkitdirectory: "", directory: "" } as Record<
                string,
                string
              >)}
              onChange={(event) => {
                const files = filesFromList(event.target.files);
                event.target.value = "";
                void uploadFiles(files);
              }}
            />
          </label>
        </div>
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
                        {busyKey === slot.key ? "…" : "Заменить"}
                        <input
                          type="file"
                          accept=".glb,.gltf"
                          disabled={busy}
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
