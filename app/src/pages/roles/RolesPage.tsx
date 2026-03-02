import React, { useEffect, useMemo, useState } from "react";
import { useAuth } from "../../features/auth";
import { useProject } from "../../features/project";
import { useSearchParams } from "react-router-dom";
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
import { getProjectMembers } from "../../sync/api";
import { MiniAvatar } from "../../shared/components/mini-avatar/MiniAvatar";
import "./style.css";

function normalizeEmail(v: unknown): string {
  return String(v ?? "").trim().toLowerCase();
}

function memberLabel(m: {
  email: string;
  profile?: {
    displayName?: string | null;
    firstName?: string | null;
    lastName?: string | null;
    avatarUrl?: string | null;
  } | null;
}): string {
  const p = m.profile ?? null;
  const display = String(p?.displayName ?? "").trim();
  if (display) return `${display} (${m.email})`;
  const full = `${String(p?.firstName ?? "").trim()} ${String(p?.lastName ?? "").trim()}`.trim();
  if (full) return `${full} (${m.email})`;
  return m.email;
}

export function RolesPage() {
  const { accessToken } = useAuth();
  const { projectName } = useProject();
  const [searchParams] = useSearchParams();

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [roles, setRoles] = useState<ProjectRoleInfo[]>([]);

  const [troupeMembers, setTroupeMembers] = useState<Array<{ email: string; profile: any | null }>>([]);

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
      const [troupe, projectMembers] = await Promise.all([
        getMyTroupe(accessToken).catch(() => null),
        getProjectMembers(accessToken, projectName).catch(() => null),
      ]);

      const membersFromTroupe = (troupe?.members ?? [])
        .map((m) => ({
          email: normalizeEmail((m as any)?.email),
          profile: (m as any)?.profile ?? null,
        }))
        .filter((m) => Boolean(m.email));

      const membersFromProject = (() => {
        const out: Array<{ email: string; profile: any | null }> = [];
        const ownerEmail = normalizeEmail(projectMembers?.owner?.email ?? "");
        if (ownerEmail) {
          out.push({
            email: ownerEmail,
            profile: projectMembers?.owner?.displayName
              ? { displayName: projectMembers.owner.displayName }
              : null,
          });
        }
        for (const m of projectMembers?.members ?? []) {
          const em = normalizeEmail(m?.user?.email ?? "");
          if (!em) continue;
          out.push({
            email: em,
            profile: m?.user?.displayName ? { displayName: m.user.displayName } : null,
          });
        }
        return out;
      })();

      const uniq = new Map<string, { email: string; profile: any | null }>();
      const merged = [...membersFromTroupe, ...membersFromProject];
      for (const m of merged) {
        if (!m.email) continue;
        const prev = uniq.get(m.email);
        if (!prev) {
          uniq.set(m.email, m);
          continue;
        }
        // Prefer profile data from troupe if available.
        if (!prev.profile && m.profile) uniq.set(m.email, { ...prev, profile: m.profile });
      }
      const list = Array.from(uniq.values()).sort((a, b) =>
        memberLabel(a).localeCompare(memberLabel(b), "ru"),
      );
      setTroupeMembers(list);
    } catch (e: any) {
      setError(e?.message || "Не удалось загрузить роли");
      setRoles([]);
      setTroupeMembers([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [accessToken, projectName]);

  // Allow deep-linking to a role: /roles?roleId=...
  useEffect(() => {
    const q = String(searchParams.get("roleId") ?? "").trim();
    if (!q) return;
    if (activeRoleId === q) return;
    setActiveRoleId(q);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

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
                    {troupeMembers.map((m) => {
                      const email = m.email;
                      const checked = (activeRole.emails ?? [])
                        .map(normalizeEmail)
                        .includes(normalizeEmail(email));
                      const label = memberLabel({ email, profile: m.profile });
                      return (
                        <label key={email} className="roles-check">
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={() => toggleAssignment(activeRole.id, email)}
                          />
                          <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
                            <MiniAvatar
                              src={String(m.profile?.avatarUrl ?? "").trim() || null}
                              label={label}
                              size={20}
                            />
                            <span>{label}</span>
                          </span>
                        </label>
                      );
                    })}
                    {troupeMembers.length === 0 && (
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

