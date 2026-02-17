import type { ScriptStep } from "../../shared/types/script";
import React, { useEffect, useMemo, useState } from "react";
import "./style.css";
import { markdownToPlainText } from "../../shared/utils/textPreview";

type KanbanStatus = NonNullable<ScriptStep["kanbanStatus"]>;

const STATUSES: Array<{ id: KanbanStatus; label: string; hint: string }> = [
  { id: "raw", label: "Сырая", hint: "черновик / в работе" },
  { id: "text-learned", label: "Выучен текст", hint: "текст готов, остальное — в процессе" },
  { id: "almost-ready", label: "Почти готова", hint: "осталось немного" },
  { id: "ready", label: "Готова", hint: "можно играть" },
];

function statusOf(step: ScriptStep): KanbanStatus {
  return (step.kanbanStatus ?? "raw") as KanbanStatus;
}

function orderOf(step: ScriptStep, fallback: number): number {
  const v = step.kanbanOrder;
  return typeof v === "number" && Number.isFinite(v) ? v : fallback;
}

function extractRolesBrackets(text?: string): string[] {
  if (!text) return [];
  const out: string[] = [];
  const re = /\[\[([^\]]+)\]\]/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text))) {
    const role = (m[1] ?? "").trim();
    if (!role) continue;
    out.push(role);
  }
  return Array.from(new Set(out));
}

function extractSpeakerRolesFromLines(text?: string): string[] {
  if (!text) return [];
  const out: string[] = [];
  const lines = text.split(/\r?\n/);
  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line) continue;
    if (line.startsWith("==") || line.startsWith("(")) continue;

    const m1 = line.match(/^([A-ZА-ЯЁ][A-ZА-ЯЁ0-9 _.\-]{1,40})\s*[:—-]\s+\S/);
    if (m1?.[1]) {
      const role = m1[1].replace(/\s+/g, " ").trim();
      if (role.length >= 2 && role.length <= 40) out.push(role);
      continue;
    }

    const m2 = line.match(/^([A-ZА-ЯЁ]{2,40})([.,!?:])\s+/);
    if (m2?.[1]) {
      out.push(m2[1].trim());
      continue;
    }
  }
  return Array.from(new Set(out));
}

function extractRolesSmart(text?: string): string[] {
  const a = extractRolesBrackets(text);
  const b = extractSpeakerRolesFromLines(text);
  return Array.from(
    new Set(
      [...a, ...b]
        .map((x) => String(x ?? "").trim())
        .filter((x) => x.length > 0),
    ),
  );
}

type MemberInfo = { email: string; displayName?: string | null };

function normalizeEmail(v: string): string {
  return String(v ?? "").trim().toLowerCase();
}

type CastValue = string | string[] | null | undefined;

function normalizeCastActors(value: CastValue): string[] {
  if (Array.isArray(value)) {
    const out = value.map((x) => String(x ?? "").trim()).filter(Boolean);
    // uniq preserve order
    return out.filter((v, i) => out.indexOf(v) === i);
  }
  const s = String(value ?? "").trim();
  return s ? [s] : [];
}

function formatCastActors(value: CastValue): string {
  return normalizeCastActors(value).join(", ");
}

function parseActorList(input: string): string[] {
  // allow: comma/semicolon/newline as separators
  const parts = String(input ?? "")
    .split(/[,\n;]+/g)
    .map((x) => x.trim())
    .filter(Boolean);
  // uniq preserve order
  return parts.filter((v, i) => parts.indexOf(v) === i);
}

function looksLikeEmail(v: string): boolean {
  return /.+@.+\..+/.test(v);
}

function extractEmailFromText(raw: string): string | null {
  const m = String(raw ?? "").match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i);
  return m?.[0] ? normalizeEmail(m[0]) : null;
}

function resolveActorEmail(value: string, members: MemberInfo[]): string | null {
  const raw = String(value ?? "").trim();
  if (!raw) return null;
  const fromText = extractEmailFromText(raw);
  if (fromText) return fromText;
  if (looksLikeEmail(raw)) return normalizeEmail(raw);
  const lower = raw.toLowerCase?.() ?? "";
  const hits = members.filter(
    (m) => (m.displayName ?? "").trim().toLowerCase() === lower,
  );
  if (hits.length === 1) return normalizeEmail(hits[0].email);
  return null;
}

function formatMemberLabel(m: MemberInfo): string {
  const name = String(m.displayName ?? "").trim();
  if (!name) return m.email;
  return `${name} (${m.email})`;
}

function normalizeMissingOrders(steps: ScriptStep[]): ScriptStep[] {
  let changed = false;
  const next = steps.map((s, idx) => {
    if (typeof s.kanbanOrder === "number" && Number.isFinite(s.kanbanOrder)) return s;
    changed = true;
    return { ...s, kanbanOrder: idx + 1 };
  });
  return changed ? next : steps;
}

function reorderColumn(
  steps: ScriptStep[],
  status: KanbanStatus,
  idsInDesiredOrder: string[],
  mutateDragged?: (s: ScriptStep) => ScriptStep
): ScriptStep[] {
  const orderMap = new Map<string, number>();
  idsInDesiredOrder.forEach((id, idx) => orderMap.set(id, idx + 1));
  return steps.map((s) => {
    if (statusOf(s) !== status) return s;
    const desired = orderMap.get(String(s.id));
    if (desired == null) return s;
    const next: ScriptStep = { ...s, kanbanOrder: desired };
    return mutateDragged ? mutateDragged(next) : next;
  });
}

function applyMove(
  steps: ScriptStep[],
  draggedId: number,
  toStatus: KanbanStatus,
  beforeId?: number
): ScriptStep[] {
  const dragged = steps.find((s) => s.id === draggedId);
  if (!dragged) return steps;

  const fromStatus = statusOf(dragged);
  const draggedKey = String(draggedId);

  const sortedKeysForStatus = (status: KanbanStatus) =>
    steps
      .map((s, idx) => ({
        key: String(s.id),
        id: s.id,
        status: statusOf(s),
        order: orderOf(s, idx + 1),
      }))
      .filter((x) => x.status === status && x.id !== draggedId)
      .sort((a, b) => a.order - b.order)
      .map((x) => x.key);

  const fromKeys = sortedKeysForStatus(fromStatus);
  const toKeys = sortedKeysForStatus(toStatus);

  const insertAt =
    beforeId != null ? Math.max(0, toKeys.indexOf(String(beforeId))) : toKeys.length;
  const nextToKeys = [...toKeys];
  nextToKeys.splice(insertAt < 0 ? nextToKeys.length : insertAt, 0, draggedKey);

  let next = steps;
  if (fromStatus === toStatus) {
    const current = [draggedKey, ...toKeys];
    const fromIndex = current.indexOf(draggedKey);
    const toIndex =
      beforeId != null ? Math.max(0, current.indexOf(String(beforeId))) : current.length - 1;
    const desired = [...current];
    const [item] = desired.splice(fromIndex, 1);
    desired.splice(toIndex, 0, item);
    next = reorderColumn(next, toStatus, desired, (s) =>
      s.id === draggedId ? { ...s, kanbanStatus: toStatus } : s
    );
    return next;
  }

  next = reorderColumn(next, fromStatus, fromKeys);
  next = reorderColumn(next, toStatus, nextToKeys, (s) =>
    s.id === draggedId ? { ...s, kanbanStatus: toStatus } : s
  );
  next = next.map((s) => (s.id === draggedId ? { ...s, kanbanStatus: toStatus } : s));
  return next;
}

export function KanbanBoardPage({
  steps,
  onStepsChange,
  roleAssignments,
  onRoleAssignmentsChange,
  members,
}: {
  steps: ScriptStep[];
  onStepsChange: React.Dispatch<React.SetStateAction<ScriptStep[]>>;
  roleAssignments?: Record<string, string[]>;
  onRoleAssignmentsChange?: (next: Record<string, string[]>) => void;
  members?: MemberInfo[];
}) {
  const [draggedId, setDraggedId] = useState<number | null>(null);
  const [openedStepId, setOpenedStepId] = useState<number | null>(null);
  const [query, setQuery] = useState("");
  const [roleFilter, setRoleFilter] = useState<string>("");
  const [actorFilter, setActorFilter] = useState<string>("");
  const [onlyUnassigned, setOnlyUnassigned] = useState(false);

  const normalizedMembers: MemberInfo[] = useMemo(() => {
    const ms = Array.isArray(members) ? members : [];
    const uniq = new Map<string, MemberInfo>();
    for (const m of ms) {
      if (!m || typeof (m as any).email !== "string") continue;
      const email = normalizeEmail((m as any).email);
      if (!email) continue;
      const displayName =
        (m as any).displayName != null ? String((m as any).displayName) : null;
      uniq.set(email, { email, displayName });
    }
    return Array.from(uniq.values()).sort((a, b) =>
      formatMemberLabel(a).localeCompare(formatMemberLabel(b), "ru"),
    );
  }, [members]);

  const normalizedSteps = useMemo(() => normalizeMissingOrders(steps), [steps]);

  useEffect(() => {
    if (normalizedSteps !== steps) onStepsChange(normalizedSteps);
  }, [normalizedSteps, onStepsChange, steps]);

  const allRoles = useMemo(() => {
    const roles = new Set<string>();
    for (const s of normalizedSteps) {
      const text = s.playMarkdown ?? s.markdown;
      extractRolesSmart(text).forEach((r) => roles.add(r));
    }
    return Array.from(roles).sort((a, b) => a.localeCompare(b, "ru"));
  }, [normalizedSteps]);

  const effectiveRoleAssignments = roleAssignments ?? {};

  const getRoleActors = (step: ScriptStep, role: string): string[] => {
    const fromStep = normalizeCastActors((step.cast as any)?.[role]);
    if (fromStep.length) return fromStep;
    const fromGlobal = effectiveRoleAssignments[role] ?? [];
    return Array.isArray(fromGlobal)
      ? fromGlobal.map((x) => String(x ?? "").trim()).filter(Boolean)
      : [];
  };

  const [roleAddDraftByRole, setRoleAddDraftByRole] = useState<Record<string, string>>({});
  const addActorToRoleDirect = (role: string, actor: string) => {
    if (!onRoleAssignmentsChange) return;
    const prev = effectiveRoleAssignments[role] ?? [];
    const nextList = Array.from(new Set([...(prev ?? []), actor]));
    onRoleAssignmentsChange({ ...effectiveRoleAssignments, [role]: nextList });
  };
  const addActorToRole = (role: string) => {
    const draft = String(roleAddDraftByRole[role] ?? "").trim();
    if (!draft) return;
    addActorToRoleDirect(role, draft);
    setRoleAddDraftByRole((p) => ({ ...p, [role]: "" }));
  };
  const removeActorFromRole = (role: string, actor: string) => {
    if (!onRoleAssignmentsChange) return;
    const prev = effectiveRoleAssignments[role] ?? [];
    const nextList = (prev ?? []).filter((x) => x !== actor);
    const next = { ...effectiveRoleAssignments };
    if (nextList.length === 0) delete (next as any)[role];
    else (next as any)[role] = nextList;
    onRoleAssignmentsChange(next);
  };

  // Пикер участников проекта для быстрого добавления в роль
  const [openRolePicker, setOpenRolePicker] = useState<string | null>(null);
  const closePickerTimerRef = React.useRef<number | null>(null);
  useEffect(() => {
    return () => {
      if (closePickerTimerRef.current != null) {
        window.clearTimeout(closePickerTimerRef.current);
      }
    };
  }, []);

  const scheduleClosePicker = () => {
    if (closePickerTimerRef.current != null) {
      window.clearTimeout(closePickerTimerRef.current);
    }
    closePickerTimerRef.current = window.setTimeout(() => {
      setOpenRolePicker(null);
      closePickerTimerRef.current = null;
    }, 120);
  };

  const allActors = useMemo(() => {
    const actors = new Set<string>();
    for (const s of normalizedSteps) {
      const cast = s.cast ?? {};
      Object.values(cast).forEach((v) => {
        normalizeCastActors(v as any).forEach((val) => {
          if (val) actors.add(val);
        });
      });
    }
    // Добавляем актёров из глобального распределения
    Object.values(effectiveRoleAssignments).forEach((list) => {
      (list ?? []).forEach((x) => {
        const v = String(x ?? "").trim();
        if (v) actors.add(v);
      });
    });
    return Array.from(actors).sort((a, b) => a.localeCompare(b, "ru"));
  }, [normalizedSteps, effectiveRoleAssignments]);

  const normalizedQuery = query.trim().toLowerCase();

  const filteredSteps = useMemo(() => {
    const matchesQuery = (s: ScriptStep, roles: string[]) => {
      if (!normalizedQuery) return true;
      const inTitle = (s.title ?? "").toLowerCase().includes(normalizedQuery);
      const inRoles = roles.some((r) =>
        String(r ?? "").toLowerCase().includes(normalizedQuery),
      );
      const inActors = roles.some((role) =>
        getRoleActors(s, role).some((a) =>
          String(a ?? "").toLowerCase().includes(normalizedQuery),
        ),
      );
      return inTitle || inRoles || inActors;
    };

    return normalizedSteps.filter((s) => {
      const text = s.playMarkdown ?? s.markdown;
      const roles = extractRolesSmart(text);
      if (!matchesQuery(s, roles)) return false;
      if (roleFilter && !roles.includes(roleFilter)) return false;
      if (actorFilter) {
        const hasActor = roles.some((role) =>
          getRoleActors(s, role).some((a) => a === actorFilter),
        );
        if (!hasActor) return false;
      }
      if (onlyUnassigned) {
        if (roles.length === 0) return true;
        const hasMissing = roles.some((r) => getRoleActors(s, r).length === 0);
        if (!hasMissing) return false;
      }
      return true;
    });
  }, [actorFilter, normalizedQuery, normalizedSteps, onlyUnassigned, roleFilter]);

  const columns = useMemo(() => {
    const byStatus = new Map<KanbanStatus, ScriptStep[]>();
    STATUSES.forEach((s) => byStatus.set(s.id, []));
    filteredSteps.forEach((s) => {
      const st = statusOf(s);
      const col = byStatus.get(st) ?? [];
      col.push(s);
      byStatus.set(st, col);
    });
    for (const [st, col] of byStatus.entries()) {
      col.sort((a, b) => orderOf(a, 0) - orderOf(b, 0));
      byStatus.set(st, col);
    }
    return byStatus;
  }, [filteredSteps]);

  const openedStep = useMemo(
    () => (openedStepId != null ? normalizedSteps.find((s) => s.id === openedStepId) ?? null : null),
    [openedStepId, normalizedSteps]
  );

  const openedRoles = useMemo(() => {
    if (!openedStep) return [];
    const text = openedStep.playMarkdown ?? openedStep.markdown;
    return extractRolesSmart(text);
  }, [openedStep]);

  const onCardDragStart = (ev: React.DragEvent, id: number) => {
    ev.dataTransfer.setData("text/plain", String(id));
    ev.dataTransfer.effectAllowed = "move";
    setDraggedId(id);
  };

  const onDropToColumn = (ev: React.DragEvent, toStatus: KanbanStatus) => {
    ev.preventDefault();
    const id = Number(ev.dataTransfer.getData("text/plain"));
    if (!Number.isFinite(id)) return;
    onStepsChange(applyMove(normalizedSteps, id, toStatus));
    setDraggedId(null);
  };

  const onDropBeforeCard = (ev: React.DragEvent, toStatus: KanbanStatus, beforeId: number) => {
    ev.preventDefault();
    const id = Number(ev.dataTransfer.getData("text/plain"));
    if (!Number.isFinite(id)) return;
    onStepsChange(applyMove(normalizedSteps, id, toStatus, beforeId));
    setDraggedId(null);
  };

  const setStepStatus = (id: number, st: KanbanStatus) => {
    onStepsChange((prev) => prev.map((s) => (s.id === id ? { ...s, kanbanStatus: st } : s)));
  };

  // Редактирование назначений в сцене больше не используем:
  // истина — в global roleAssignments.

  const setStepDurationMin = (id: number, durationMin: number | undefined) => {
    onStepsChange((prev) =>
      prev.map((s) => (s.id === id ? { ...s, durationMin } : s))
    );
  };

  return (
    <div className="kanban-page">
      <div className="kanban-header">
        <h2 className="kanban-title">Доска готовности</h2>
        <p className="kanban-subtitle">
          Перетаскивайте “сцены” (шаги) между колонками. Клик по карточке — детали, роли и назначения.
        </p>
      </div>

      {onRoleAssignmentsChange && allRoles.length > 0 && (
        <details className="kanban-details" style={{ marginBottom: 12 }}>
          <summary>Распределение ролей (истина)</summary>
          <div className="kanban-muted" style={{ marginTop: 6 }}>
            Здесь назначается состав на роль один раз. В сценах назначения подтягиваются отсюда, если в самой сцене не задано.
          </div>
          <div style={{ display: "grid", gap: 10, marginTop: 10 }}>
            {allRoles.map((role) => {
              const list = effectiveRoleAssignments[role] ?? [];
              const draft = roleAddDraftByRole[role] ?? "";
              const q = draft.trim().toLowerCase();
              const pickerItems = normalizedMembers
                .map((m) => ({
                  key: m.email,
                  value: m.email,
                  label: formatMemberLabel(m),
                  search: `${m.email} ${m.displayName ?? ""}`.toLowerCase(),
                }))
                .filter((x) => (q ? x.search.includes(q) : true))
                .slice(0, 12);
              return (
                <div key={`ra-${role}`} style={{ padding: 10, border: "1px solid #e5e7eb", borderRadius: 10 }}>
                  <div style={{ fontWeight: 600, marginBottom: 6 }}>{role}</div>
                  <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap", position: "relative" }}>
                    <input
                      value={draft}
                      onChange={(e) =>
                        setRoleAddDraftByRole((p) => ({ ...p, [role]: e.target.value }))
                      }
                      onFocus={() => {
                        if (closePickerTimerRef.current != null) {
                          window.clearTimeout(closePickerTimerRef.current);
                          closePickerTimerRef.current = null;
                        }
                        setOpenRolePicker(role);
                      }}
                      onBlur={() => scheduleClosePicker()}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          addActorToRole(role);
                        }
                      }}
                      placeholder="добавить актёра (email/имя)"
                      list={normalizedMembers.length ? "kanban-members" : undefined}
                      style={{ minWidth: 260 }}
                    />
                    <button type="button" className="btn btn-secondary" onClick={() => addActorToRole(role)}>
                      Добавить
                    </button>

                    {openRolePicker === role && pickerItems.length > 0 && (
                      <div
                        role="listbox"
                        style={{
                          position: "absolute",
                          left: 0,
                          top: "calc(100% + 6px)",
                          zIndex: 20,
                          minWidth: 420,
                          maxWidth: 520,
                          background: "white",
                          border: "1px solid #e5e7eb",
                          borderRadius: 10,
                          boxShadow: "0 10px 25px rgba(0,0,0,0.12)",
                          padding: 6,
                        }}
                        onMouseDown={(e) => {
                          // чтобы клик по элементам не закрывал поповер из-за blur
                          e.preventDefault();
                        }}
                      >
                        {pickerItems.map((it) => {
                          const already = (list ?? []).includes(it.value);
                          return (
                            <button
                              key={it.key}
                              type="button"
                              disabled={already}
                              onMouseDown={(e) => {
                                e.preventDefault();
                                if (already) return;
                                addActorToRoleDirect(role, it.value);
                              }}
                              style={{
                                width: "100%",
                                textAlign: "left",
                                padding: "8px 10px",
                                borderRadius: 8,
                                border: "none",
                                background: already ? "#f3f4f6" : "transparent",
                                cursor: already ? "not-allowed" : "pointer",
                              }}
                            >
                              {it.label}
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>

                  {list.length > 0 ? (
                    <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 8 }}>
                      {list.map((a) => (
                        <button
                          key={`${role}:${a}`}
                          type="button"
                          className="kanban-chip"
                          title="Удалить"
                          onClick={() => removeActorFromRole(role, a)}
                          style={{ cursor: "pointer" }}
                        >
                          {a} ×
                        </button>
                      ))}
                    </div>
                  ) : (
                    <div className="kanban-muted" style={{ marginTop: 8 }}>
                      Пока никто не назначен
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </details>
      )}

      <div className="kanban-toolbar" aria-label="Фильтры доски">
        <label className="kanban-tool">
          <span className="kanban-tool-label">Поиск</span>
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="название / роль / исполнитель"
          />
        </label>

        <label className="kanban-tool">
          <span className="kanban-tool-label">Роль</span>
          <select value={roleFilter} onChange={(e) => setRoleFilter(e.target.value)}>
            <option value="">Все</option>
            {allRoles.map((r) => (
              <option key={r} value={r}>
                {r}
              </option>
            ))}
          </select>
        </label>

        <label className="kanban-tool">
          <span className="kanban-tool-label">Исполнитель</span>
          <select value={actorFilter} onChange={(e) => setActorFilter(e.target.value)}>
            <option value="">Все</option>
            {allActors.map((a) => (
              <option key={a} value={a}>
                {a}
              </option>
            ))}
          </select>
        </label>

        <label className="kanban-tool kanban-tool-check">
          <input
            type="checkbox"
            checked={onlyUnassigned}
            onChange={(e) => setOnlyUnassigned(e.target.checked)}
          />
          <span>Только без назначений</span>
        </label>

        <button
          type="button"
          className="kanban-tool-reset"
          onClick={() => {
            setQuery("");
            setRoleFilter("");
            setActorFilter("");
            setOnlyUnassigned(false);
          }}
        >
          Сбросить
        </button>
      </div>

      <div className="kanban-board" role="region" aria-label="Доска готовности сцен">
        {STATUSES.map((st) => {
          const col = columns.get(st.id) ?? [];
          return (
            <section
              key={st.id}
              className="kanban-col"
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => onDropToColumn(e, st.id)}
              aria-label={st.label}
            >
              <div className="kanban-col-head">
                <div className="kanban-col-title-row">
                  <h3 className="kanban-col-title">{st.label}</h3>
                  <span className="kanban-col-count">{col.length}</span>
                </div>
                <div className="kanban-col-hint">{st.hint}</div>
              </div>

              <div className="kanban-col-body">
                {col.map((s) => {
                  const text = s.playMarkdown ?? s.markdown;
                  const roles = extractRolesSmart(text);
                  const isDragging = draggedId === s.id;
                  const assignedCount = roles.filter((r) => {
                    return getRoleActors(s, r).length > 0;
                  }).length;

                  return (
                    <div
                      key={s.id}
                      className={`kanban-card ${isDragging ? "dragging" : ""}`}
                      draggable
                      onDragStart={(e) => onCardDragStart(e, s.id)}
                      onDragEnd={() => setDraggedId(null)}
                      onDragOver={(e) => e.preventDefault()}
                      onDrop={(e) => onDropBeforeCard(e, st.id, s.id)}
                      onClick={() => setOpenedStepId(s.id)}
                      role="button"
                      tabIndex={0}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") setOpenedStepId(s.id);
                      }}
                      aria-label={`Сцена: ${s.title}`}
                    >
                      <div className="kanban-card-title">{s.title}</div>
                      {roles.length > 0 && (
                        <div className="kanban-card-roles" aria-label="Роли в сцене">
                          {roles.slice(0, 6).map((r) => (
                            <span key={r} className="kanban-chip">
                              {r}
                            </span>
                          ))}
                          {roles.length > 6 && (
                            <span className="kanban-chip more">+{roles.length - 6}</span>
                          )}
                        </div>
                      )}
                      <div className="kanban-card-footer">
                        <div className="kanban-card-footer-left">
                          <span className="kanban-card-id">#{s.id}</span>
                          {typeof s.durationMin === "number" &&
                            Number.isFinite(s.durationMin) &&
                            s.durationMin > 0 && (
                              <span className="kanban-card-duration" title="Длительность шага">
                                {s.durationMin} мин
                              </span>
                            )}
                          {roles.length > 0 && (
                            <span className="kanban-card-assign">
                              {assignedCount}/{roles.length}
                            </span>
                          )}
                        </div>
                        <span className="kanban-card-action">Подробнее</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>
          );
        })}
      </div>

      {openedStep && (
        <div className="kanban-modal-backdrop" role="presentation" onClick={() => setOpenedStepId(null)}>
          <div
            className="kanban-modal"
            role="dialog"
            aria-modal="true"
            aria-label={`Сцена: ${openedStep.title}`}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="kanban-modal-head">
              <div>
                <div className="kanban-modal-title">{openedStep.title}</div>
                <div className="kanban-modal-meta">Шаг #{openedStep.id}</div>
              </div>
              <button type="button" className="kanban-modal-close" onClick={() => setOpenedStepId(null)} aria-label="Закрыть">
                ×
              </button>
            </div>

            <div className="kanban-modal-body">
              <label className="kanban-field">
                <span className="kanban-field-label">Статус готовности</span>
                <select value={statusOf(openedStep)} onChange={(e) => setStepStatus(openedStep.id, e.target.value as KanbanStatus)}>
                  {STATUSES.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.label}
                    </option>
                  ))}
                </select>
              </label>

              <label className="kanban-field">
                <span className="kanban-field-label">Длительность (мин)</span>
                <input
                  type="number"
                  min={0}
                  step={1}
                  value={openedStep.durationMin ?? ""}
                  onChange={(e) => {
                    const raw = e.target.value;
                    if (raw === "") {
                      setStepDurationMin(openedStep.id, undefined);
                      return;
                    }
                    const num = Number(raw);
                    if (!Number.isFinite(num) || num < 0) return;
                    setStepDurationMin(openedStep.id, num);
                  }}
                  placeholder="не указано"
                />
              </label>

              <div className="kanban-section">
                <div className="kanban-section-title">Роли и кто играет</div>
                {openedRoles.length === 0 ? (
                  <div className="kanban-muted">
                    Роли не найдены. Вытаскиваем роли из <code>[[Роль]]</code> и пробуем распознать говорящего (например <code>ЛЕОН: ...</code>).
                  </div>
                ) : (
                  <div className="kanban-roles-grid">
                    {openedRoles.map((role) => (
                      <label key={role} className="kanban-role-row">
                        <span className="kanban-role-name">{role}</span>
                        <div className="kanban-role-input-wrap">
                          <div className="kanban-muted" style={{ marginBottom: 6 }}>
                            Назначения подтягиваются из блока «Распределение ролей (истина)».
                          </div>
                          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                            {getRoleActors(openedStep, role).length > 0 ? (
                              getRoleActors(openedStep, role).map((a) => (
                                <span key={`${role}:${a}`} className="kanban-chip">
                                  {a}
                                </span>
                              ))
                            ) : (
                              <span className="kanban-muted">—</span>
                            )}
                          </div>
                          {(() => {
                            const list = getRoleActors(openedStep, role);
                            if (list.length === 0) return null;
                            const resolved = list
                              .map((x) => ({ raw: x, email: resolveActorEmail(x, normalizedMembers) }))
                              .filter((x) => Boolean(x.email)) as Array<{ raw: string; email: string }>;
                            if (resolved.length === 0) {
                              return (
                                <div className="kanban-role-hint warn">
                                  Не удалось сопоставить с участником проекта
                                </div>
                              );
                            }
                            const labels = resolved
                              .map((x) => {
                                const m = normalizedMembers.find((mm) => normalizeEmail(mm.email) === x.email);
                                return m ? formatMemberLabel(m) : x.email;
                              })
                              .filter(Boolean);
                            return <div className="kanban-role-hint">{labels.join(", ")}</div>;
                          })()}
                        </div>
                      </label>
                    ))}
                  </div>
                )}
              </div>

              {normalizedMembers.length > 0 && (
                <datalist id="kanban-members">
                  {normalizedMembers.map((m) => (
                    <option key={m.email} value={m.email}>
                      {formatMemberLabel(m)}
                    </option>
                  ))}
                </datalist>
              )}

              <details className="kanban-details">
                <summary>Текст сцены</summary>
                <pre className="kanban-text">
                  {markdownToPlainText(String(openedStep.playMarkdown ?? openedStep.markdown ?? ""))}
                </pre>
              </details>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

