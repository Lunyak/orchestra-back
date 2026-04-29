import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useProject } from "../../../../features/project";
import { useScene } from "../../../../features/scene";
import { useScriptUI } from "../../../../features/script-ui";
import { useAppDispatch, useAppSelector } from "../../../store/hooks";
import {
  fetchProjectRolesThunk,
  selectProjectRoles,
} from "../../../../features/profile/model/profileRolesSlice";
import type { ProjectRoleInfo } from "../../../../sync/api/projects";
import type { SceneData, SceneRolesDataV1, SceneRoleLinkV1 } from "../../../../features/scene";
import type { ScriptStep } from "../../../types/script";

function normalize(v: string) {
  return String(v ?? "").trim().toLowerCase();
}

function extractBracketRoles(text?: string): string[] {
  if (!text) return [];
  const out: string[] = [];
  const re = /\[\[([^\]]+)\]\]/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text))) {
    const role = String(m[1] ?? "").trim();
    if (role) out.push(role);
  }
  return Array.from(new Set(out));
}

function ensureSceneRoles(prev: SceneData | null): SceneRolesDataV1 {
  const raw = (prev as any)?.sceneRoles;
  if (raw && typeof raw === "object" && (raw as any).v === 1 && (raw as any).byStepId) {
    return raw as SceneRolesDataV1;
  }
  return { v: 1, byStepId: {} };
}

function getRoleLabel(role: ProjectRoleInfo) {
  const title = String(role?.title ?? "").trim();
  const key = String(role?.key ?? "").trim();
  return title && key ? `${title} (${key})` : title || key || "Роль";
}

export function StepRolesPanel({ step }: { step: ScriptStep }) {
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const { projectName } = useProject();
  const accessToken = useAppSelector((s) => (s as any).auth?.accessToken ?? null) as string | null;
  const roles = useAppSelector(selectProjectRoles);
  const { isEditing } = useScriptUI();

  const { sceneData, setSceneData } = useScene();

  const stepId = step.id;
  const collapseKey = `stepRolesPanel:collapsed:${projectName || "unknown"}`;
  const [collapsed, setCollapsed] = useState<boolean>(() => {
    try {
      return (typeof window !== "undefined" ? localStorage.getItem(collapseKey) : null) === "1";
    } catch {
      return false;
    }
  });

  useEffect(() => {
    try {
      if (typeof window === "undefined") return;
      localStorage.setItem(collapseKey, collapsed ? "1" : "0");
    } catch {
      // ignore
    }
  }, [collapseKey, collapsed]);

  useEffect(() => {
    if (!accessToken || !projectName) return;
    void dispatch(fetchProjectRolesThunk({ accessToken, projectName }));
  }, [accessToken, projectName, dispatch]);

  const attachedByRoleId: Record<string, SceneRoleLinkV1> = useMemo(() => {
    const raw = (sceneData as any)?.sceneRoles as SceneRolesDataV1 | undefined;
    if (!raw || raw.v !== 1) return {};
    const stepMap = raw.byStepId?.[String(stepId)];
    if (!stepMap || typeof stepMap !== "object") return {};
    const out: Record<string, SceneRoleLinkV1> = {};
    Object.keys(stepMap).forEach((roleId) => {
      const it = stepMap[roleId];
      if (it && typeof it === "object") out[roleId] = it as SceneRoleLinkV1;
    });
    return out;
  }, [sceneData, stepId]);

  const attachedList = useMemo(() => {
    const list = Object.values(attachedByRoleId);
    const titleById = new Map(roles.map((r) => [String(r.id), String(r.title ?? "")]));
    return list.sort((a, b) => {
      const at = titleById.get(String(a.roleId)) || a.roleTitle || a.roleKey || "";
      const bt = titleById.get(String(b.roleId)) || b.roleTitle || b.roleKey || "";
      return String(at).localeCompare(String(bt), "ru");
    });
  }, [attachedByRoleId, roles]);

  const [query, setQuery] = useState("");
  const [selectedRoleId, setSelectedRoleId] = useState<string>("");
  const [autopickInfo, setAutopickInfo] = useState<string | null>(null);

  const filteredRoles = useMemo(() => {
    const q = normalize(query);
    const attached = new Set(Object.keys(attachedByRoleId));
    const base = (roles ?? []).filter((r) => !attached.has(String(r.id)));
    if (!q) return base.slice(0, 50);
    return base
      .filter((r) => {
        const title = normalize(String(r.title ?? ""));
        const key = normalize(String(r.key ?? ""));
        const aliases = Array.isArray(r.aliases) ? r.aliases.map((a) => normalize(String(a))) : [];
        return title.includes(q) || key.includes(q) || aliases.some((a) => a.includes(q));
      })
      .slice(0, 50);
  }, [roles, query, attachedByRoleId]);

  const attachRole = (roleId: string) => {
    const rid = String(roleId ?? "").trim();
    if (!rid) return;
    const role = roles.find((r) => String(r.id) === rid) ?? null;
    const now = new Date().toISOString();
    setSceneData((prev) => {
      const nextRoles = ensureSceneRoles(prev);
      const stepKey = String(stepId);
      const stepMap = { ...(nextRoles.byStepId?.[stepKey] ?? {}) };
      const existing = stepMap[rid];
      if (existing) {
        // Idempotent: do not wipe note / timestamps on re-attach.
        const needsPatch =
          (!existing.roleKey && role?.key) || (!existing.roleTitle && role?.title);
        if (!needsPatch) return prev;
        stepMap[rid] = {
          ...(existing as any),
          roleKey: existing.roleKey ?? role?.key ?? undefined,
          roleTitle: existing.roleTitle ?? role?.title ?? undefined,
        };
      } else {
        stepMap[rid] = {
          roleId: rid,
          roleKey: role?.key ?? undefined,
          roleTitle: role?.title ?? undefined,
          note: "",
          createdAtIso: now,
          updatedAtIso: now,
        };
      }
      return {
        ...(prev ?? {}),
        sceneRoles: {
          v: 1,
          byStepId: {
            ...(nextRoles.byStepId ?? {}),
            [stepKey]: stepMap,
          },
        },
      };
    });
  };

  const tryResolveRoleIdFromToken = (token: string): string | null => {
    const t = normalize(token);
    if (!t) return null;
    const exactTitle = roles.find((r) => normalize(String(r.title ?? "")) === t) ?? null;
    if (exactTitle) return String(exactTitle.id);
    const exactKey = roles.find((r) => normalize(String(r.key ?? "")) === t) ?? null;
    if (exactKey) return String(exactKey.id);
    const byAlias =
      roles.find((r) =>
        (Array.isArray(r.aliases) ? r.aliases : []).some((a) => normalize(String(a)) === t),
      ) ?? null;
    if (byAlias) return String(byAlias.id);
    const fuzzy =
      roles.find((r) => {
        const title = normalize(String(r.title ?? ""));
        const key = normalize(String(r.key ?? ""));
        const aliases = Array.isArray(r.aliases) ? r.aliases.map((a) => normalize(String(a))) : [];
        return title.includes(t) || key.includes(t) || aliases.some((a) => a.includes(t));
      }) ?? null;
    return fuzzy ? String(fuzzy.id) : null;
  };

  const autopickFromBrackets = () => {
    const tokens = extractBracketRoles(`${step.markdown ?? ""}\n${step.playMarkdown ?? ""}`);
    if (tokens.length === 0) {
      setAutopickInfo("Не нашёл упоминаний в [[...]] в этом шаге");
      return;
    }
    const already = new Set(Object.keys(attachedByRoleId));
    const resolved: string[] = [];
    const resolvedSet = new Set<string>();
    const missing: string[] = [];
    let alreadyCount = 0;
    for (const t of tokens) {
      const id = tryResolveRoleIdFromToken(t);
      if (!id) {
        missing.push(t);
        continue;
      }
      if (already.has(id)) {
        alreadyCount += 1;
        continue;
      }
      if (resolvedSet.has(id)) continue;
      resolvedSet.add(id);
      resolved.push(id);
    }
    resolved.forEach((id) => attachRole(id));
    const parts: string[] = [];
    if (resolved.length) {
      const addedLabels = resolved
        .map((id) => roles.find((r) => String(r.id) === String(id)) ?? null)
        .map((r, idx) => (r ? String(r.title ?? r.key ?? resolved[idx] ?? "").trim() : String(resolved[idx] ?? "")))
        .filter(Boolean);
      const preview = addedLabels.slice(0, 6).join(", ");
      parts.push(
        `Добавлено ролей: ${resolved.length}${preview ? ` (${preview}${addedLabels.length > 6 ? "…" : ""})` : ""}`,
      );
    }
    if (alreadyCount) parts.push(`Уже были: ${alreadyCount}`);
    if (missing.length) parts.push(`Не найдены: ${missing.slice(0, 5).join(", ")}${missing.length > 5 ? "…" : ""}`);
    setAutopickInfo(parts.length ? parts.join(" · ") : "Все роли уже привязаны");
  };

  const detachRole = (roleId: string) => {
    const rid = String(roleId ?? "").trim();
    if (!rid) return;
    setSceneData((prev) => {
      const nextRoles = ensureSceneRoles(prev);
      const stepKey = String(stepId);
      const prevStep = { ...(nextRoles.byStepId?.[stepKey] ?? {}) };
      if (!Object.prototype.hasOwnProperty.call(prevStep, rid)) return prev;
      delete prevStep[rid];
      const nextByStep = { ...(nextRoles.byStepId ?? {}) };
      nextByStep[stepKey] = prevStep;
      return { ...(prev ?? {}), sceneRoles: { v: 1, byStepId: nextByStep } };
    });
  };

  const setRoleNote = (roleId: string, note: string) => {
    const rid = String(roleId ?? "").trim();
    setSceneData((prev) => {
      const nextRoles = ensureSceneRoles(prev);
      const stepKey = String(stepId);
      const stepMap = { ...(nextRoles.byStepId?.[stepKey] ?? {}) };
      const existing = stepMap[rid];
      if (!existing) return prev;
      const now = new Date().toISOString();
      stepMap[rid] = { ...(existing as any), note, updatedAtIso: now };
      return {
        ...(prev ?? {}),
        sceneRoles: {
          v: 1,
          byStepId: {
            ...(nextRoles.byStepId ?? {}),
            [stepKey]: stepMap,
          },
        },
      };
    });
  };

  if (!projectName) return null;

  return (
    <aside className="step-roles-panel" data-collapsed={collapsed ? "true" : "false"}>
      <div className="step-roles-header">
        <div className="step-roles-header-left">
          <span>Роли в сцене</span>
          <span className="step-roles-count">{attachedList.length}</span>
        </div>
        <button
          type="button"
          className="step-roles-toggle"
          onClick={() => setCollapsed((v) => !v)}
          title={collapsed ? "Развернуть панель ролей" : "Свернуть панель ролей"}
          aria-label={collapsed ? "Развернуть панель ролей" : "Свернуть панель ролей"}
        >
          {collapsed ? "⟩" : "⟨"}
        </button>
        {isEditing ? (
          <button
            type="button"
            className="step-roles-autopick-btn"
            onClick={autopickFromBrackets}
            disabled={!roles.length}
            title="Добавить роли, которые упомянуты в [[...]] в тексте шага"
          >
            Подхватить [[...]]
          </button>
        ) : null}
      </div>

      {isEditing && autopickInfo ? <div className="step-roles-hint">{autopickInfo}</div> : null}

      {isEditing ? (
        <div className="step-roles-add">
          <input
            className="step-roles-search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Поиск роли…"
          />
          <select
            className="step-roles-select"
            value={selectedRoleId}
            onChange={(e) => setSelectedRoleId(e.target.value)}
          >
            <option value="">Выбрать роль…</option>
            {filteredRoles.map((r) => (
              <option key={r.id} value={r.id}>
                {getRoleLabel(r)}
              </option>
            ))}
          </select>
          <button
            type="button"
            className="step-roles-add-btn"
            onClick={() => {
              if (!selectedRoleId) return;
              attachRole(selectedRoleId);
              setSelectedRoleId("");
              setQuery("");
              setAutopickInfo(null);
            }}
            disabled={!selectedRoleId}
          >
            +
          </button>
        </div>
      ) : null}

      <div className="step-roles-list">
        {attachedList.length === 0 ? (
          <div className="step-roles-empty">Пока нет привязанных ролей</div>
        ) : (
          attachedList.map((link) => {
            const role =
              roles.find((r) => String(r.id) === String(link.roleId)) ?? null;
            const title =
              role?.title ??
              link.roleTitle ??
              role?.key ??
              link.roleKey ??
              "Роль";
            return (
              <div key={link.roleId} className="step-role-item">
                <div className="step-role-top">
                  <button
                    type="button"
                    className="step-role-title-link"
                    onClick={() => navigate(`/role-workbook/${encodeURIComponent(String(link.roleId))}`)}
                    title="Открыть страницу роли"
                  >
                    {title}
                  </button>
                  {isEditing ? (
                    <button
                      type="button"
                      className="step-role-remove"
                      onClick={() => detachRole(link.roleId)}
                      title="Отвязать роль от сцены"
                    >
                      ×
                    </button>
                  ) : null}
                </div>
                {isEditing ? (
                  <textarea
                    className="step-role-note"
                    value={String(link.note ?? "")}
                    onChange={(e) => setRoleNote(link.roleId, e.target.value)}
                    placeholder="Заметка по роли в этой сцене…"
                    rows={3}
                  />
                ) : String(link.note ?? "").trim() ? (
                  <div className="step-role-note-readonly">{String(link.note ?? "").trim()}</div>
                ) : null}
              </div>
            );
          })
        )}
      </div>
    </aside>
  );
}

