import React, { useEffect, useMemo, useState } from "react";
import { useAuth } from "../../features/auth";
import { useProject } from "../../features/project";
import {
  addProjectRoleNote,
  createProjectRole,
  getMyTroupe,
  getProjectRoleNotes,
  getProjectRoles,
  setProjectRoleAssignments,
  type ProjectRoleInfo,
  type RoleNoteItem,
} from "../../sync/api";
import "./style.css";

function normalizeEmail(v: unknown): string {
  return String(v ?? "").trim().toLowerCase();
}

export function RolesPage() {
  const { accessToken } = useAuth();
  const { projectName } = useProject();

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [roles, setRoles] = useState<ProjectRoleInfo[]>([]);

  const [troupeEmails, setTroupeEmails] = useState<string[]>([]);

  const [createTitle, setCreateTitle] = useState("");
  const [createDescription, setCreateDescription] = useState("");

  const [activeRoleId, setActiveRoleId] = useState<string | null>(null);
  const activeRole = useMemo(
    () => roles.find((r) => r.id === activeRoleId) ?? null,
    [roles, activeRoleId],
  );

  const [notesLoading, setNotesLoading] = useState(false);
  const [notes, setNotes] = useState<RoleNoteItem[]>([]);
  const [noteDraft, setNoteDraft] = useState("");

  const loadAll = async () => {
    if (!accessToken) return;
    if (!projectName) return;
    setLoading(true);
    setError(null);
    try {
      const res = await getProjectRoles(accessToken, projectName);
      setRoles(res.roles ?? []);
      const troupe = await getMyTroupe(accessToken).catch(() => null);
      const emails = (troupe?.members ?? [])
        .map((m) => normalizeEmail(m.email))
        .filter(Boolean);
      setTroupeEmails(Array.from(new Set(emails)).sort());
    } catch (e: any) {
      setError(e?.message || "Не удалось загрузить роли");
      setRoles([]);
      setTroupeEmails([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [accessToken, projectName]);

  useEffect(() => {
    if (!accessToken || !projectName || !activeRoleId) return;
    let cancelled = false;
    setNotesLoading(true);
    getProjectRoleNotes(accessToken, projectName, activeRoleId)
      .then((res) => {
        if (!cancelled) setNotes(res?.notes ?? []);
      })
      .catch(() => {
        if (!cancelled) setNotes([]);
      })
      .finally(() => {
        if (!cancelled) setNotesLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [accessToken, projectName, activeRoleId]);

  const createRole = async () => {
    if (!accessToken || !projectName) return;
    const title = createTitle.trim();
    if (!title) return;
    try {
      await createProjectRole(accessToken, projectName, {
        title,
        description: createDescription.trim() || undefined,
        aliases: [],
      });
      setCreateTitle("");
      setCreateDescription("");
      await loadAll();
    } catch (e) {
      console.error("createRole failed:", e);
    }
  };

  const toggleAssignment = async (roleId: string, email: string) => {
    if (!accessToken || !projectName) return;
    const role = roles.find((r) => r.id === roleId);
    if (!role) return;
    const cur = new Set((role.emails ?? []).map(normalizeEmail).filter(Boolean));
    const e = normalizeEmail(email);
    if (!e) return;
    if (cur.has(e)) cur.delete(e);
    else cur.add(e);
    const next = Array.from(cur).sort();
    setRoles((prev) =>
      prev.map((r) => (r.id === roleId ? { ...r, emails: next } : r)),
    );
    try {
      await setProjectRoleAssignments(accessToken, projectName, roleId, next);
    } catch (err) {
      console.error("setAssignments failed:", err);
      await loadAll();
    }
  };

  const addNote = async () => {
    if (!accessToken || !projectName || !activeRoleId) return;
    const text = noteDraft.trim();
    if (!text) return;
    try {
      await addProjectRoleNote(accessToken, projectName, activeRoleId, text);
      setNoteDraft("");
      const res = await getProjectRoleNotes(accessToken, projectName, activeRoleId);
      setNotes(res?.notes ?? []);
    } catch (e) {
      console.error("addNote failed:", e);
    }
  };

  const rolesSorted = useMemo(() => {
    return [...(roles ?? [])].sort((a, b) => a.title.localeCompare(b.title, "ru"));
  }, [roles]);

  return (
    <div className="roles-page">
      <div className="roles-header">
        <div>
          <div className="roles-title">Роли</div>
          <div className="roles-subtitle">
            Проект: <b>{projectName || "—"}</b>
          </div>
        </div>
      </div>

      {error && <div className="roles-error">{error}</div>}
      {loading && <div className="roles-muted">Загрузка…</div>}

      {!accessToken ? (
        <div className="roles-error">Нужен логин (accessToken)</div>
      ) : (
        <div className="roles-grid">
          <div className="roles-col">
            <div className="roles-card">
              <div className="roles-card-title">Создать роль</div>
              <div className="roles-form">
                <input
                  value={createTitle}
                  onChange={(e) => setCreateTitle(e.target.value)}
                  placeholder="Название роли"
                />
                <textarea
                  value={createDescription}
                  onChange={(e) => setCreateDescription(e.target.value)}
                  placeholder="Описание (опционально)"
                  rows={3}
                />
                <button type="button" onClick={createRole}>
                  Создать
                </button>
              </div>
            </div>

            <div className="roles-card">
              <div className="roles-card-title">Список ролей</div>
              <div className="roles-list">
                {rolesSorted.map((r) => {
                  const isActive = r.id === activeRoleId;
                  return (
                    <button
                      key={r.id}
                      type="button"
                      className={`roles-list-item ${isActive ? "active" : ""}`}
                      onClick={() => setActiveRoleId(r.id)}
                    >
                      <div className="roles-list-title">{r.title}</div>
                      <div className="roles-list-meta">
                        назначено: {(r.emails ?? []).length}
                      </div>
                    </button>
                  );
                })}
                {rolesSorted.length === 0 && (
                  <div className="roles-muted">Ролей пока нет</div>
                )}
              </div>
            </div>
          </div>

          <div className="roles-col">
            {!activeRole ? (
              <div className="roles-card">
                <div className="roles-muted">Выберите роль слева</div>
              </div>
            ) : (
              <>
                <div className="roles-card">
                  <div className="roles-card-title">{activeRole.title}</div>
                  {activeRole.description && (
                    <div className="roles-desc">{activeRole.description}</div>
                  )}
                  <div className="roles-section-title">Назначения (труппа)</div>
                  <div className="roles-assignments">
                    {troupeEmails.map((email) => {
                      const checked = (activeRole.emails ?? [])
                        .map(normalizeEmail)
                        .includes(normalizeEmail(email));
                      return (
                        <label key={email} className="roles-check">
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={() => toggleAssignment(activeRole.id, email)}
                          />
                          <span>{email}</span>
                        </label>
                      );
                    })}
                    {troupeEmails.length === 0 && (
                      <div className="roles-muted">
                        Труппа пустая — добавь людей в разделе “Труппа”
                      </div>
                    )}
                  </div>
                </div>

                <div className="roles-card">
                  <div className="roles-card-title">Страница роли (заметки)</div>
                  <div className="roles-form">
                    <textarea
                      value={noteDraft}
                      onChange={(e) => setNoteDraft(e.target.value)}
                      placeholder="Написать заметку по роли…"
                      rows={4}
                    />
                    <button type="button" onClick={addNote}>
                      Добавить заметку
                    </button>
                  </div>

                  {notesLoading ? (
                    <div className="roles-muted">Загрузка заметок…</div>
                  ) : (
                    <div className="roles-notes">
                      {notes.map((n) => (
                        <div key={n.id} className="roles-note">
                          <div className="roles-note-meta">
                            <span>{n.authorEmail || "—"}</span>
                            <span>
                              {new Date(n.updatedAt).toLocaleString("ru-RU")}
                            </span>
                          </div>
                          <div className="roles-note-body">{n.content}</div>
                        </div>
                      ))}
                      {notes.length === 0 && (
                        <div className="roles-muted">Заметок пока нет</div>
                      )}
                    </div>
                  )}
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

