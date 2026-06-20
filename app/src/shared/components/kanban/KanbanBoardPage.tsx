import React, { useEffect, useMemo, useState } from "react";
import { useAuth } from "../../../features/auth";
import { mergeKanbanRoleAssignmentMembers } from "../../../features/kanban/model/kanban-role-members";
import { KanbanStepDetailModal } from "../../../features/kanban-step-modal/KanbanStepDetailModal";
import type { KanbanStepRolesAdminMember } from "../../../features/kanban-step-modal/KanbanStepRolesAdminPanel";
import {
  useProjectMembersQuery,
  useProjectRolesQuery,
} from "../../../features/project/api/project-api";
import { useProject } from "../../../features/project";
import { useScene } from "../../../features/scene";
import { useMyTroupeQuery } from "../../../features/troupe/api/troupe-api";
import type { ScriptStep } from "../../types/script";
import type { ProjectRoleInfo } from "../../../sync/api/projects";
import type { TroupeMemberItem } from "../../../sync/api/troupe";
import {
  loadActorStepNote,
  selectActorNote,
} from "../../../features/show-script/model/show-script-slice";
import { useAppDispatch, useAppSelector } from "../../store/hooks";
import "./style.css";
import { Button } from "@shared/core/button/Button";
import { LabeledCheckbox } from "@shared/core/labeled-checkbox/LabeledCheckbox";
import { OptionalFilterSelect } from "@shared/core/optional-filter-select/OptionalFilterSelect";
import { RehearsalPlanSectionChrome } from "../rehearsal-plan/RehearsalPlanSectionChrome";
import { STATUSES, statusOf, type KanbanStatus } from "./kanban-constants";

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

function normalizeRoleKey(v: unknown): string {
  return String(v ?? "")
    .trim()
    .toLowerCase()
    .replace(/ё/g, "е")
    .replace(/[_\-.]+/g, " ")
    .replace(/[()]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
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
  members,
}: {
  members?: MemberInfo[];
}) {
  const dispatch = useAppDispatch();
  const { accessToken } = useAuth();
  const { projectName } = useProject();
  const { sceneData, steps, setSteps } = useScene();
  const actorNoteSceneName = String(sceneData?.name ?? "script").trim() || "script";
  const [draggedId, setDraggedId] = useState<number | null>(null);
  const [openedStepId, setOpenedStepId] = useState<number | null>(null);
  const [expandedCommentStepIds, setExpandedCommentStepIds] = useState<Set<number>>(
    () => new Set(),
  );
  const [query, setQuery] = useState("");
  const [roleFilter, setRoleFilter] = useState<string>(""); // normalized role key
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
    if (normalizedSteps !== steps) setSteps(normalizedSteps);
  }, [normalizedSteps, setSteps, steps]);

  const effectiveRoleAssignmentsFallback = (sceneData?.roleAssignments ?? {}) as Record<
    string,
    string[]
  >;

  const skipRoles = !accessToken || !projectName;
  const {
    data: rolesRes,
    isLoading: rolesLoading,
    error: rolesQueryError,
  } = useProjectRolesQuery(projectName, { skip: skipRoles });
  const { data: troupeRes } = useMyTroupeQuery(
    { project: projectName },
    { skip: skipRoles },
  );
  const { data: projectMembersRes } = useProjectMembersQuery(projectName, {
    skip: skipRoles,
  });

  const projectRoles = rolesRes?.roles ?? [];
  const troupeMembers = (troupeRes?.members ?? []) as TroupeMemberItem[];

  const rolesError = rolesQueryError
    ? String(
        (rolesQueryError as { message?: string }).message ??
          "Не удалось загрузить роли/труппу",
      )
    : null;

  const roleAssignmentMembers = useMemo(
    () => mergeKanbanRoleAssignmentMembers(troupeRes, projectMembersRes),
    [troupeRes, projectMembersRes],
  );

  const troupeAsMembers = useMemo((): MemberInfo[] => {
    const list = Array.isArray(troupeMembers) ? troupeMembers : [];
    return list
      .map((m) => {
        const email = normalizeEmail(String((m as any)?.email ?? ""));
        if (!email) return null;
        const p = (m as any)?.profile ?? null;
        const displayName =
          String(p?.displayName ?? "").trim() ||
          `${String(p?.firstName ?? "").trim()} ${String(p?.lastName ?? "").trim()}`.trim() ||
          null;
        return { email, displayName };
      })
      .filter(Boolean) as MemberInfo[];
  }, [troupeMembers]);

  const allKnownMembers = useMemo(() => {
    const map = new Map<string, MemberInfo>();
    const add = (m: MemberInfo | null | undefined) => {
      const email = m?.email ? normalizeEmail(m.email) : "";
      if (!email) return;
      if (!map.has(email)) map.set(email, { email, displayName: m?.displayName ?? null });
      else {
        const prev = map.get(email)!;
        if (!prev.displayName && m?.displayName) map.set(email, { ...prev, displayName: m.displayName });
      }
    };
    (normalizedMembers ?? []).forEach(add);
    (troupeAsMembers ?? []).forEach(add);
    return Array.from(map.values()).sort((a, b) =>
      formatMemberLabel(a).localeCompare(formatMemberLabel(b), "ru"),
    );
  }, [normalizedMembers, troupeAsMembers]);

  const roleInfoByKey = useMemo(() => {
    const map = new Map<string, ProjectRoleInfo>();
    for (const r of projectRoles ?? []) {
      const key = normalizeRoleKey((r as any)?.key ?? (r as any)?.title);
      if (key) map.set(key, r);
    }
    return map;
  }, [projectRoles]);

  const roleInfoByAliasKey = useMemo(() => {
    const map = new Map<string, ProjectRoleInfo>();
    for (const r of projectRoles ?? []) {
      const aliases = Array.isArray((r as any)?.aliases) ? (r as any).aliases : [];
      for (const a of aliases) {
        const k = normalizeRoleKey(a);
        if (k && !map.has(k)) map.set(k, r);
      }
    }
    return map;
  }, [projectRoles]);

  const resolveRoleInfo = (rawRole: string): ProjectRoleInfo | null => {
    const k = normalizeRoleKey(rawRole);
    if (!k) return null;
    return roleInfoByKey.get(k) ?? roleInfoByAliasKey.get(k) ?? null;
  };

  const getFallbackRoleActors = (roleRaw: string): string[] => {
    const direct = effectiveRoleAssignmentsFallback[roleRaw] ?? [];
    const cleaned = (Array.isArray(direct) ? direct : [])
      .map((x) => String(x ?? "").trim())
      .filter(Boolean);
    if (cleaned.length) return cleaned;
    const roleKey = normalizeRoleKey(roleRaw);
    if (!roleKey) return [];
    for (const [k, v] of Object.entries(effectiveRoleAssignmentsFallback ?? {})) {
      if (normalizeRoleKey(k) === roleKey) {
        return (Array.isArray(v) ? v : []).map((x) => String(x ?? "").trim()).filter(Boolean);
      }
    }
    return [];
  };

  const getRoleActors = (step: ScriptStep, roleRaw: string): string[] => {
    const info = resolveRoleInfo(roleRaw);
    const emails = Array.isArray((info as any)?.emails) ? (info as any).emails : [];
    const cleaned = emails.map((x: any) => String(x ?? "").trim()).filter(Boolean);
    if (cleaned.length) return cleaned;
    return getFallbackRoleActors(roleRaw);
  };

  const displayRoleTitle = (roleRaw: string): string => {
    const info = resolveRoleInfo(roleRaw);
    const title = info?.title ? String(info.title).trim() : "";
    return title || roleRaw;
  };

  const formatActorList = (actors: string[]) => {
    const uniq = Array.from(new Set((actors ?? []).map((x) => String(x ?? "").trim()).filter(Boolean)));
    if (uniq.length === 0) return "—";
    return uniq
      .map((raw) => {
        const email = normalizeEmail(raw);
        const hit = allKnownMembers.find((m) => normalizeEmail(m.email) === email) ?? null;
        return hit ? formatMemberLabel(hit) : raw;
      })
      .join(", ");
  };

  const allRoleKeys = useMemo(() => {
    const set = new Set<string>();
    for (const s of normalizedSteps) {
      const text = s.playMarkdown ?? s.markdown;
      extractRolesSmart(text)
        .map((r) => normalizeRoleKey(r))
        .filter(Boolean)
        .forEach((k) => set.add(k));
    }
    return Array.from(set);
  }, [normalizedSteps]);

  const roleFilterOptions = useMemo(() => {
    return allRoleKeys
      .map((k) => {
        const info = roleInfoByKey.get(k) ?? roleInfoByAliasKey.get(k) ?? null;
        const label = info?.title ? String(info.title).trim() : "";
        return { key: k, label: label || k };
      })
      .sort((a, b) => a.label.localeCompare(b.label, "ru"));
  }, [allRoleKeys, roleInfoByAliasKey, roleInfoByKey]);

  const allActors = useMemo(() => {
    const set = new Set<string>();
    for (const s of normalizedSteps) {
      const text = s.playMarkdown ?? s.markdown;
      const roles = extractRolesSmart(text);
      for (const r of roles) {
        getRoleActors(s, r).forEach((a) => {
          const v = String(a ?? "").trim();
          if (v) set.add(v);
        });
      }
    }
    return Array.from(set).sort((a, b) => a.localeCompare(b, "ru"));
  }, [normalizedSteps, projectRoles, troupeMembers, sceneData]);

  const normalizedQuery = query.trim().toLowerCase();

  const filteredSteps = useMemo(() => {
    const matchesQuery = (s: ScriptStep, roles: string[]) => {
      if (!normalizedQuery) return true;
      const inTitle = (s.title ?? "").toLowerCase().includes(normalizedQuery);
      const inRoles = roles.some((r) =>
        String(displayRoleTitle(r) ?? "").toLowerCase().includes(normalizedQuery),
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
      if (roleFilter) {
        const has = roles.some((r) => normalizeRoleKey(r) === roleFilter);
        if (!has) return false;
      }
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
  }, [actorFilter, normalizedQuery, normalizedSteps, onlyUnassigned, roleFilter, projectRoles, troupeMembers, sceneData]);

  const actorNotesByKey = useAppSelector((s) => s.showScript.actorNotesByKey);

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

  useEffect(() => {
    if (!accessToken || !projectName) return;
    filteredSteps.forEach((step) => {
      const cacheKey = `${projectName}:${actorNoteSceneName}:${step.id}`;
      const entry = actorNotesByKey[cacheKey];
      if (entry) return;
      void dispatch(
        loadActorStepNote({
          cacheKey,
          projectSlug: projectName,
          sceneName: actorNoteSceneName,
          stepId: step.id,
        }),
      );
    });
  }, [
    accessToken,
    actorNoteSceneName,
    actorNotesByKey,
    dispatch,
    filteredSteps,
    projectName,
  ]);

  const onCardDragStart = (ev: React.DragEvent, id: number) => {
    ev.dataTransfer.setData("text/plain", String(id));
    ev.dataTransfer.effectAllowed = "move";
    setDraggedId(id);
  };

  const onDropToColumn = (ev: React.DragEvent, toStatus: KanbanStatus) => {
    ev.preventDefault();
    const id = Number(ev.dataTransfer.getData("text/plain"));
    if (!Number.isFinite(id)) return;
    setSteps(applyMove(normalizedSteps, id, toStatus));
    setDraggedId(null);
  };

  const onDropBeforeCard = (ev: React.DragEvent, toStatus: KanbanStatus, beforeId: number) => {
    ev.preventDefault();
    const id = Number(ev.dataTransfer.getData("text/plain"));
    if (!Number.isFinite(id)) return;
    setSteps(applyMove(normalizedSteps, id, toStatus, beforeId));
    setDraggedId(null);
  };

  const setStepStatus = (id: number, st: KanbanStatus) => {
    setSteps((prev) => prev.map((s) => (s.id === id ? { ...s, kanbanStatus: st } : s)));
  };

  const setStepDurationMin = (id: number, durationMin: number | undefined) => {
    setSteps((prev) =>
      prev.map((s) => (s.id === id ? { ...s, durationMin } : s))
    );
  };

  return (
    <div className="kanban-page">
      <RehearsalPlanSectionChrome activeTab="board" />

      {rolesError && (
        <div className="kanban-muted" style={{ marginBottom: 12 }}>
          {rolesError}
        </div>
      )}

      <div className="kanban-toolbar" aria-label="Фильтры доски">
        <label className="kanban-tool">
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="название / роль / исполнитель"
          />
        </label>

        <label className="kanban-tool">
          <OptionalFilterSelect
            value={roleFilter}
            onChange={setRoleFilter}
            placeholder="Роли"
            aria-label="Фильтр по роли"
          >
            {roleFilterOptions.map((r) => (
              <option key={r.key} value={r.key}>
                {r.label}
              </option>
            ))}
          </OptionalFilterSelect>
        </label>

        <label className="kanban-tool">
          <OptionalFilterSelect
            value={actorFilter}
            onChange={setActorFilter}
            placeholder="Актеры"
            aria-label="Фильтр по актеру"
          >
            {allActors.map((a) => (
              <option key={a} value={a}>
                {formatActorList([a])}
              </option>
            ))}
          </OptionalFilterSelect>
        </label>

        <LabeledCheckbox
          className="kanban-tool kanban-tool-check"
          checked={onlyUnassigned}
          onChange={setOnlyUnassigned}
        >
          без назначений
        </LabeledCheckbox>

        <Button
          type="button"
          className="primary kanban-btn-reset"
          onClick={() => {
            setQuery("");
            setRoleFilter("");
            setActorFilter("");
            setOnlyUnassigned(false);
          }}
        >
          Сбросить
        </Button>
      </div>

      <div className="kanban-board" role="region" aria-label="Доска готовности сцен">
        {STATUSES.map((st) => {
          const col = columns.get(st.id) ?? [];
          return (
            <section
              key={st.id}
              className="kanban-col"
              style={
                {
                  "--kanban-col-accent": st.headerBg,
                } as React.CSSProperties
              }
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
                  const noteCacheKey = `${projectName ?? ""}:${actorNoteSceneName}:${s.id}`;
                  const noteText = String(actorNotesByKey[noteCacheKey]?.text ?? "").trim();
                  const isCommentExpanded = expandedCommentStepIds.has(s.id);
                  return (
                    <div
                      key={s.id}
                      className={`kanban-card ${isDragging ? "dragging" : ""}`}
                      style={
                        {
                          "--kanban-card-accent": st.headerBg,
                        } as React.CSSProperties
                      }
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
                      <span className="kanban-card-meta">
                        {typeof s.durationMin === "number" &&
                          Number.isFinite(s.durationMin) &&
                          s.durationMin > 0 ? (
                            <span className="kanban-card-duration">{s.durationMin} мин</span>
                          ) : null}
                        <span className="kanban-card-id">#{s.id}</span>
                      </span>
                      <div className="kanban-card-title">{s.title}</div>
                      {roles.length > 0 && (
                        <div className="kanban-card-roles" aria-label="Роли в сцене">
                          {roles.slice(0, 6).map((r) => (
                            <span key={r} className="kanban-chip">
                              {displayRoleTitle(r)}
                            </span>
                          ))}
                          {roles.length > 6 && (
                            <span className="kanban-chip more">+{roles.length - 6}</span>
                          )}
                        </div>
                      )}
                      {noteText && isCommentExpanded ? (
                        <div
                          className="kanban-card-note"
                          data-expanded="true"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <div className="kanban-card-note__full">{noteText}</div>
                        </div>
                      ) : null}
                      {noteText ? (
                        <button
                          type="button"
                          className="kanban-card-note__toggle"
                          aria-label={
                            isCommentExpanded
                              ? "Свернуть комментарий"
                              : "Открыть комментарий"
                          }
                          aria-expanded={isCommentExpanded}
                          onClick={(e) => {
                            e.stopPropagation();
                            setExpandedCommentStepIds((prev) => {
                              const next = new Set(prev);
                              if (next.has(s.id)) {
                                next.delete(s.id);
                              } else {
                                next.add(s.id);
                              }
                              return next;
                            });
                          }}
                          onKeyDown={(e) => e.stopPropagation()}
                        >
                          <span aria-hidden="true">▾</span>
                        </button>
                      ) : null}
                    </div>
                  );
                })}
              </div>
            </section>
          );
        })}
      </div>

      {openedStep && (
        <KanbanStepDetailModal
          step={openedStep}
          onClose={() => setOpenedStepId(null)}
          setStepStatus={setStepStatus}
          setStepDurationMin={setStepDurationMin}
          rolesLoading={rolesLoading}
          openedRoles={openedRoles}
          getRoleActors={getRoleActors}
          displayRoleTitle={displayRoleTitle}
          resolveRoleInfo={resolveRoleInfo}
          projectName={projectName}
          projectRoles={projectRoles}
          roleAssignmentMembers={roleAssignmentMembers}
        />
      )}
    </div>
  );
}

