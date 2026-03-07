import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import dayjs from "dayjs";
import "dayjs/locale/ru";
import { useAuth } from "../../features/auth";
import {
  loadDirectorSessions,
  type DirectorRehearsalSession,
  type DirectorSessionSlot,
} from "../../features/director-sessions/directorSessionsSync";

dayjs.locale("ru");

function getSessionStartLocalMinutes(startsAtIso: string): number {
  const d = new Date(startsAtIso);
  if (!Number.isFinite(d.getTime())) return 0;
  return d.getHours() * 60 + d.getMinutes();
}

function formatTimeHHMM(totalMin: number): string {
  const m = ((Math.floor(totalMin) % (24 * 60)) + 24 * 60) % (24 * 60);
  const hh = String(Math.floor(m / 60)).padStart(2, "0");
  const mm = String(m % 60).padStart(2, "0");
  return `${hh}:${mm}`;
}

function formatSlotTime(startsAtIso: string, offsetMin: number): string {
  const base = getSessionStartLocalMinutes(startsAtIso);
  return formatTimeHHMM(base + Math.max(0, Math.floor(offsetMin)));
}

export function DirectorSessionPage() {
  const { accessToken } = useAuth();
  const { sessionId } = useParams();
  const id = String(sessionId ?? "").trim();

  const [session, setSession] = useState<DirectorRehearsalSession | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!accessToken || !id) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    loadDirectorSessions(accessToken)
      .then((res) => {
        if (cancelled) return;
        const found = (res.sessions ?? []).find((s) => s.id === id) ?? null;
        setSession(found);
        if (!found) setError("Сессия не найдена");
      })
      .catch((e: any) => {
        if (cancelled) return;
        setError(e?.message ?? "Не удалось загрузить сессию");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [accessToken, id]);

  const headerTimeLabel = useMemo(() => {
    if (!session?.startsAt) return "";
    const start = dayjs(session.startsAt);
    return start.format("D MMMM YYYY, HH:mm");
  }, [session?.startsAt]);

  const slotsSorted = useMemo(() => {
    const list = [...(session?.slots ?? [])];
    list.sort((a, b) => (a.offsetMin ?? 0) - (b.offsetMin ?? 0));
    return list;
  }, [session?.slots]);

  if (!accessToken) return <div style={{ padding: 12 }}>Нужно войти, чтобы открыть сессию.</div>;
  if (!id) return <div style={{ padding: 12 }}>Некорректный URL сессии.</div>;

  return (
    <div style={{ padding: "12px 12px 40px", maxWidth: 980, margin: "0 auto" }}>
      <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
        <Link to={`/sessions?sessionId=${encodeURIComponent(id)}`} style={{ textDecoration: "none", color: "inherit", opacity: 0.85 }}>
          ← К списку
        </Link>
        <div style={{ fontWeight: 800, fontSize: 16 }}>Сессия</div>
        <div style={{ fontSize: 12, opacity: 0.75 }}>{headerTimeLabel}</div>
        <div style={{ flex: 1 }} />
        <Link
          to={`/sessions/${encodeURIComponent(id)}/attendance`}
          style={{ fontSize: 12, textDecoration: "none", color: "inherit", opacity: 0.85 }}
          title="Страница явки / комментария"
        >
          Явка и заметки ↗
        </Link>
      </div>

      {loading ? <div style={{ marginTop: 10, opacity: 0.75 }}>Загрузка…</div> : null}
      {error ? (
        <div className="settings-invite-error" style={{ marginTop: 10 }}>
          {error}
        </div>
      ) : null}

      {session && !loading && !error && (
        <div style={{ marginTop: 12, display: "grid", gap: 10 }}>
          <div
            style={{
              border: "1px solid rgba(255,255,255,0.12)",
              borderRadius: 12,
              padding: 12,
              background: "rgba(255,255,255,0.04)",
            }}
          >
            <div style={{ fontWeight: 900, fontSize: 14 }}>{session.title}</div>
            <div style={{ marginTop: 4, fontSize: 12, opacity: 0.8 }}>
              ID: <span style={{ opacity: 0.9 }}>{session.id}</span>
            </div>
            <div style={{ marginTop: 10, fontWeight: 900, fontSize: 13 }}>Слоты</div>
            {(slotsSorted ?? []).length === 0 ? (
              <div style={{ marginTop: 6, fontSize: 12, opacity: 0.75 }}>В этой сессии пока нет слотов.</div>
            ) : (
              <div style={{ marginTop: 8, display: "grid", gap: 8 }}>
                {slotsSorted.map((sl: DirectorSessionSlot) => {
                  const refLabel = sl.ref ? `${sl.ref.projectSlug} · шаг #${sl.ref.stepId}` : "Материал не выбран";
                  return (
                    <div
                      key={sl.id}
                      style={{
                        borderRadius: 12,
                        border: "1px solid rgba(255,255,255,0.10)",
                        background: "rgba(0,0,0,0.10)",
                        padding: 10,
                        display: "flex",
                        alignItems: "center",
                        gap: 10,
                        justifyContent: "space-between",
                        flexWrap: "wrap",
                      }}
                    >
                      <div style={{ minWidth: 0 }}>
                        <div style={{ fontWeight: 900, fontSize: 13 }}>
                          {formatSlotTime(session.startsAt, sl.offsetMin)} · {sl.durationMin} мин
                        </div>
                        <div style={{ fontSize: 12, opacity: 0.75, marginTop: 4, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                          {refLabel}
                        </div>
                      </div>
                      <Link
                        to={`/sessions/${encodeURIComponent(session.id)}/slots/${encodeURIComponent(sl.id)}`}
                        style={{
                          display: "inline-flex",
                          alignItems: "center",
                          justifyContent: "center",
                          padding: "0 12px",
                          height: 34,
                          borderRadius: 10,
                          background: "rgba(96,165,250,0.16)",
                          border: "1px solid rgba(96,165,250,0.30)",
                          color: "inherit",
                          textDecoration: "none",
                          fontWeight: 800,
                          fontSize: 12,
                          whiteSpace: "nowrap",
                        }}
                        title="Открыть слот и выбрать материал"
                      >
                        Открыть слот →
                      </Link>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

