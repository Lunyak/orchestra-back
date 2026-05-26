import { Button } from "@shared/core/button/Button";
import { useMemo } from "react";
import type { ProjectRoleInfo } from "../../../sync/api/projects";
import { RolePlayingCard } from "../../role-card/RolePlayingCard";
import type { RoleRelationshipEntry } from "../model/roleWorkbookNote";

export type WorkbookRelationshipsSectionProps = {
  sectionNum: number;
  currentRoleId: string;
  projectRoles: ProjectRoleInfo[];
  entries: RoleRelationshipEntry[];
  legacyNotes: string;
  accessToken: string;
  canEdit: boolean;
  onChangeEntries: (next: RoleRelationshipEntry[]) => void;
  onChangeLegacyNotes: (value: string) => void;
};

export function WorkbookRelationshipsSection({
  sectionNum,
  currentRoleId,
  projectRoles,
  entries,
  legacyNotes,
  accessToken,
  canEdit,
  onChangeEntries,
  onChangeLegacyNotes,
}: WorkbookRelationshipsSectionProps) {
  const otherRoles = useMemo(() => {
    const rid = String(currentRoleId ?? "").trim();
    return (projectRoles ?? [])
      .filter((r) => String(r.id) !== rid)
      .slice()
      .sort((a, b) => a.title.localeCompare(b.title, "ru"));
  }, [currentRoleId, projectRoles]);

  const roleById = useMemo(() => {
    const map = new Map<string, ProjectRoleInfo>();
    for (const r of projectRoles ?? []) map.set(String(r.id), r);
    return map;
  }, [projectRoles]);

  const usedIds = new Set(entries.map((e) => e.targetRoleId));

  const addEntry = () => {
    const free = otherRoles.find((r) => !usedIds.has(r.id));
    if (!free) return;
    onChangeEntries([...entries, { targetRoleId: free.id, text: "" }]);
  };

  const updateEntry = (idx: number, patch: Partial<RoleRelationshipEntry>) => {
    const next = entries.slice();
    const cur = next[idx];
    if (!cur) return;
    next[idx] = { ...cur, ...patch };
    onChangeEntries(next);
  };

  const removeEntry = (idx: number) => {
    onChangeEntries(entries.filter((_, i) => i !== idx));
  };

  return (
    <div className="rolewb-card rolewb-section" id="rolewb-section-relationships">
      <div className="rolewb-section-head">
        <span className="rolewb-section-num">{sectionNum}</span>
        <div className="rolewb-card-title">Отношения с персонажами</div>
      </div>
      <div className="rolewb-hint">
        Выбери персонажа из пьесы и опиши отношение с ним: близость, власть, конфликт, тайна, цель в контакте.
      </div>

      {otherRoles.length === 0 ? (
        <div className="rolewb-hint">В проекте пока нет других ролей для выбора.</div>
      ) : null}

      <div className="rolewb-rel-list">
        {entries.map((entry, idx) => {
          const target = roleById.get(entry.targetRoleId) ?? null;
          return (
            <div key={`rel-${entry.targetRoleId}-${idx}`} className="rolewb-rel-row">
              <RolePlayingCard
                role={target ?? { title: "?", avatarKey: null }}
                accessToken={accessToken}
                size="sm"
              />
              <div className="rolewb-rel-fields">
                <select
                  className="settings-invite-input"
                  value={entry.targetRoleId}
                  disabled={!canEdit}
                  onChange={(e) => updateEntry(idx, { targetRoleId: e.target.value })}
                  style={{ maxWidth: "unset", width: "100%" }}
                >
                  {otherRoles.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.title}
                    </option>
                  ))}
                </select>
                <textarea
                  className="settings-invite-input"
                  rows={3}
                  value={entry.text}
                  disabled={!canEdit}
                  onChange={(e) => updateEntry(idx, { text: e.target.value })}
                  style={{ maxWidth: "unset", width: "100%" }}
                  placeholder="Как связаны? Что хочешь от него/неё? Что скрываешь?"
                />
                {canEdit ? (
                  <Button className="danger" type="button" onClick={() => removeEntry(idx)}>
                    Удалить
                  </Button>
                ) : null}
              </div>
            </div>
          );
        })}
      </div>

      {canEdit && otherRoles.length > entries.length ? (
        <Button className="secondary" type="button" onClick={addEntry}>
          + Добавить персонажа
        </Button>
      ) : null}

      <div className="rolewb-hint" style={{ marginTop: 8 }}>
        Общие заметки (если нужно — без привязки к одному персонажу):
      </div>
      <textarea
        className="settings-invite-input"
        rows={3}
        value={legacyNotes}
        disabled={!canEdit}
        onChange={(e) => onChangeLegacyNotes(e.target.value)}
        style={{ maxWidth: "unset", width: "100%" }}
        placeholder="Прочие связи, группы, прошлое с несколькими героями…"
      />
    </div>
  );
}
