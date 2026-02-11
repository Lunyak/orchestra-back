import { ScriptStep } from "@shared/types/script";
import { useEffect, useMemo, useState } from "react";
import "./style.css";

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

function extractRoles(markdown?: string): string[] {
  if (!markdown) return [];
  const out: string[] = [];
  const re = /\[\[([^\]]+)\]\]/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(markdown))) {
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

    // Пропускаем "режиссерские" пометки, которые у вас часто начинаются с "==" или "("
    if (line.startsWith("==") || line.startsWith("(")) continue;

    // 1) Вариант: "ЛЕОН: ..." / "ЛЕОН — ..." / "ЛЕОН - ..."
    // Берём только полностью uppercase (лат/кириллица) — так меньше ложных срабатываний.
    const m1 = line.match(
      /^([A-ZА-ЯЁ][A-ZА-ЯЁ0-9 _.\-]{1,40})\s*[:—-]\s+\S/
    );
    if (m1?.[1]) {
      const role = m1[1].replace(/\s+/g, " ").trim();
      if (role.length >= 2 && role.length <= 40) out.push(role);
      continue;
    }

    // 2) Вариант: "ЛЕОН." / "ЛЕОН," / "ЛЕОН" в начале строки (часто встречается в пьесах)
    const m2 = line.match(/^([A-ZА-ЯЁ]{2,40})([.,!?:])\s+/);
    if (m2?.[1]) {
      out.push(m2[1].trim());
      continue;
    }
  }
  return Array.from(new Set(out));
}

function extractRolesSmart(text?: string): string[] {
  const a = extractRoles(text);
  const b = extractSpeakerRolesFromLines(text);
  return Array.from(new Set([...a, ...b]));
}

type MemberInfo = { email: string; displayName?: string | null };

function normalizeEmail(v: string): string {
  return String(v ?? "").trim().toLowerCase();
}

function looksLikeEmail(v: string): boolean {
  return /.+@.+\..+/.test(v);
}

function resolveActorEmail(value: string, members: MemberInfo[]): string | null {
  const raw = String(value ?? "").trim();
  if (!raw) return null;
  if (looksLikeEmail(raw)) return normalizeEmail(raw);
  const lower = raw.toLowerCase();
  const hits = members.filter(
    (m) => (m.displayName ?? "").trim().toLowerCase() === lower
  );
  if (hits.length === 1) return normalizeEmail(hits[0].email);
  return null;
}

function formatMemberLabel(m: MemberInfo): string {
  const name = String(m.displayName ?? "").trim();
  if (!name) return m.email;
  return `${name} (${m.email})`;
}

function moveInArray<T>(arr: T[], from: number, to: number): T[] {
  if (from === to) return arr;
  if (from < 0 || to < 0) return arr;
  if (from >= arr.length || to >= arr.length) return arr;
  const next = [...arr];
  const [item] = next.splice(from, 1);
  next.splice(to, 0, item);
  return next;
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
    const stepKey = String(s.id);
    const sStatus = statusOf(s);
    if (sStatus !== status) return s;
    const desired = orderMap.get(stepKey);
    if (desired == null) {
      // если по какой-то причине в колонке появился шаг без id в списке — оставим как было
      return s;
    }
    const next: ScriptStep = {
      ...s,
      kanbanOrder: desired,
    };
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

  // 1) исходная колонка (dragged вытащили)
  const fromKeys = sortedKeysForStatus(fromStatus);

  // 2) целевая колонка (dragged вставили)
  const toKeys = sortedKeysForStatus(toStatus);
  const insertAt =
    beforeId != null ? Math.max(0, toKeys.indexOf(String(beforeId))) : toKeys.length;
  const nextToKeys = [...toKeys];
  nextToKeys.splice(insertAt < 0 ? nextToKeys.length : insertAt, 0, draggedKey);

  let next = steps;

  // Пересобираем канбан-порядок: сначала из колонки-источника, затем из целевой.
  if (fromStatus === toStatus) {
    // если перестановка в рамках одной колонки
    const current = [draggedKey, ...toKeys];
    const currentSorted = current; // current уже не нужен; idsInDesiredOrder зададим через move
    const fromIndex = currentSorted.indexOf(draggedKey);
    const toIndex =
      beforeId != null
        ? Math.max(0, currentSorted.indexOf(String(beforeId)))
        : currentSorted.length - 1;
    const desired = moveInArray(currentSorted, fromIndex, toIndex);
    next = reorderColumn(next, toStatus, desired, (s) =>
      s.id === draggedId ? { ...s, kanbanStatus: toStatus } : s
    );
    return next;
  }

  next = reorderColumn(next, fromStatus, fromKeys);
  next = reorderColumn(next, toStatus, nextToKeys, (s) =>
    s.id === draggedId ? { ...s, kanbanStatus: toStatus } : s
  );
  // ВАЖНО: шаг должен сменить статус даже если он был не в целевой колонке из-за фильтра
  next = next.map((s) => (s.id === draggedId ? { ...s, kanbanStatus: toStatus } : s));
  return next;
}

function normalizeMissingOrders(steps: ScriptStep[]): ScriptStep[] {
  // Чтобы сортировка по колонкам всегда была стабильной, проставим order тем, у кого его нет.
  // Это НЕ меняет порядок шагов в сценарии, только добавляет метаданные для доски.
  let changed = false;
  const next = steps.map((s, idx) => {
    if (typeof s.kanbanOrder === "number" && Number.isFinite(s.kanbanOrder)) return s;
    changed = true;
    return { ...s, kanbanOrder: idx + 1 };
  });
  return changed ? next : steps;
}

export function KanbanBoardPage({
  steps,
  onStepsChange,
  members,
}: {
  steps: ScriptStep[];
  onStepsChange: (next: ScriptStep[]) => void;
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
      const email = normalizeEmail(m.email);
      if (!email) continue;
      uniq.set(email, { email, displayName: m.displayName ?? null });
    }
    return Array.from(uniq.values()).sort((a, b) =>
      formatMemberLabel(a).localeCompare(formatMemberLabel(b), "ru")
    );
  }, [members]);

  const normalizedSteps = useMemo(() => normalizeMissingOrders(steps), [steps]);

  // Если нормализация добавила поля, зафиксируем это в состоянии, чтобы оно синкнулось.
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

  const allActors = useMemo(() => {
    const actors = new Set<string>();
    for (const s of normalizedSteps) {
      const cast = s.cast ?? {};
      Object.values(cast).forEach((v) => {
        const val = String(v ?? "").trim();
        if (val) actors.add(val);
      });
    }
    return Array.from(actors).sort((a, b) => a.localeCompare(b, "ru"));
  }, [normalizedSteps]);

  const normalizedQuery = query.trim().toLowerCase();

  const filteredSteps = useMemo(() => {
    const matchesQuery = (s: ScriptStep, roles: string[]) => {
      if (!normalizedQuery) return true;
      const inTitle = (s.title ?? "").toLowerCase().includes(normalizedQuery);
      const inRoles = roles.some((r) => r.toLowerCase().includes(normalizedQuery));
      const inActors = Object.values(s.cast ?? {}).some((v) =>
        String(v ?? "").toLowerCase().includes(normalizedQuery)
      );
      return inTitle || inRoles || inActors;
    };

    return normalizedSteps.filter((s) => {
      const text = s.playMarkdown ?? s.markdown;
      const roles = extractRolesSmart(text);

      if (!matchesQuery(s, roles)) return false;
      if (roleFilter && !roles.includes(roleFilter)) return false;
      if (actorFilter) {
        const hasActor = Object.values(s.cast ?? {}).some(
          (v) => String(v ?? "").trim() === actorFilter
        );
        if (!hasActor) return false;
      }
      if (onlyUnassigned) {
        if (roles.length === 0) return true;
        const cast = s.cast ?? {};
        const hasMissing = roles.some((r) => !(cast[r] && String(cast[r]).trim()));
        if (!hasMissing) return false;
      }
      return true;
    });
  }, [actorFilter, normalizedQuery, normalizedSteps, onlyUnassigned, query, roleFilter]);

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
  }, [normalizedSteps]);

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

  const onCardDragEnd = () => setDraggedId(null);

  const onDropToColumn = (ev: React.DragEvent, toStatus: KanbanStatus) => {
    ev.preventDefault();
    const raw = ev.dataTransfer.getData("text/plain");
    const id = Number(raw);
    if (!Number.isFinite(id)) return;
    onStepsChange(applyMove(normalizedSteps, id, toStatus));
    setDraggedId(null);
  };

  const onDropBeforeCard = (
    ev: React.DragEvent,
    toStatus: KanbanStatus,
    beforeId: number
  ) => {
    ev.preventDefault();
    const raw = ev.dataTransfer.getData("text/plain");
    const id = Number(raw);
    if (!Number.isFinite(id)) return;
    onStepsChange(applyMove(normalizedSteps, id, toStatus, beforeId));
    setDraggedId(null);
  };

  const setStepStatus = (id: number, st: KanbanStatus) => {
    onStepsChange(
      normalizedSteps.map((s) =>
        s.id === id ? { ...s, kanbanStatus: st } : s
      )
    );
  };

  const setRoleActor = (id: number, role: string, actor: string) => {
    onStepsChange(
      normalizedSteps.map((s) => {
        if (s.id !== id) return s;
        const cast = { ...(s.cast ?? {}) };
        const v = actor.trim();
        if (!v) {
          delete cast[role];
        } else {
          cast[role] = v;
        }
        return { ...s, cast };
      })
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
                    const v = s.cast?.[r];
                    return v != null && String(v).trim().length > 0;
                  }).length;
                  return (
                    <div
                      key={s.id}
                      className={`kanban-card ${isDragging ? "dragging" : ""}`}
                      draggable
                      onDragStart={(e) => onCardDragStart(e, s.id)}
                      onDragEnd={onCardDragEnd}
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
                        <span className="kanban-card-id">#{s.id}</span>
                        {roles.length > 0 && (
                          <span className="kanban-card-assign">
                            {assignedCount}/{roles.length}
                          </span>
                        )}
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
        <div
          className="kanban-modal-backdrop"
          role="presentation"
          onClick={() => setOpenedStepId(null)}
        >
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
              <button
                type="button"
                className="kanban-modal-close"
                onClick={() => setOpenedStepId(null)}
                aria-label="Закрыть"
              >
                ×
              </button>
            </div>

            <div className="kanban-modal-body">
              <label className="kanban-field">
                <span className="kanban-field-label">Статус готовности</span>
                <select
                  value={statusOf(openedStep)}
                  onChange={(e) =>
                    setStepStatus(openedStep.id, e.target.value as KanbanStatus)
                  }
                >
                  {STATUSES.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.label}
                    </option>
                  ))}
                </select>
              </label>

              <div className="kanban-section">
                <div className="kanban-section-title">Роли и кто играет</div>
                {openedRoles.length === 0 ? (
                  <div className="kanban-muted">
                    Роли не найдены. Сейчас мы вытаскиваем роли из текста по паттерну <code>[[Роль]]</code>,
                    а также пытаемся распознать говорящего (например <code>ЛЕОН: ...</code>).
                  </div>
                ) : (
                  <div className="kanban-roles-grid">
                    {openedRoles.map((role) => (
                      <label key={role} className="kanban-role-row">
                        <span className="kanban-role-name">{role}</span>
                        <div className="kanban-role-input-wrap">
                          <input
                            value={(openedStep.cast?.[role] ?? "") as string}
                            onChange={(e) =>
                              setRoleActor(openedStep.id, role, e.target.value)
                            }
                            placeholder="исполнитель (лучше email)"
                            list={
                              normalizedMembers.length ? "kanban-members" : undefined
                            }
                          />
                          {(() => {
                            const raw = String(openedStep.cast?.[role] ?? "").trim();
                            if (!raw) return null;
                            const email = resolveActorEmail(raw, normalizedMembers);
                            if (!email) return (
                              <div className="kanban-role-hint warn">
                                Не удалось сопоставить с участником проекта
                              </div>
                            );
                            const m = normalizedMembers.find(
                              (x) => normalizeEmail(x.email) === email
                            );
                            if (!m) return null;
                            return (
                              <div className="kanban-role-hint">
                                {formatMemberLabel(m)}
                              </div>
                            );
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
                  {(openedStep.playMarkdown ?? openedStep.markdown ?? "").trim()}
                </pre>
              </details>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

