import { createAsyncThunk, createSlice, type PayloadAction } from "@reduxjs/toolkit";
import type { RootState } from "../../../shared/store/store";
import { profileApi } from "../../profile/api/profile-api";
import type { TeamProfile } from "../../../sync/api/profile";
import { projectApi } from "../../project/api/project-api";
import { troupeApi } from "../../troupe/api/troupe-api";
import {
  addProjectRoleNote,
  cleanupProjectImages,
  getProjectRoleNotes,
  type ProjectRoleInfo,
  type RoleNoteItem,
} from "../../../sync/api/projects";
import {
  encodeDirectorRefsNoteContent,
  encodeRoleWorkbookNoteContent,
  pickLatestDirectorRefsSnapshotForRole,
  pickLatestWorkbookSnapshotForActor,
  type DirectorReferenceImage,
  type RoleDirectorRefsSnapshot,
  type RoleDirectorRefsDataV1,
  type RoleWorkbookDataV1,
  type RoleWorkbookSnapshot,
} from "./roleWorkbookNote";

export type RoleWorkbookState = {
  loading: boolean;
  saving: boolean;
  savingDirectorRefs: boolean;
  cleaningImages: boolean;
  error: string | null;
  directorRefsError: string | null;
  cleanImagesError: string | null;

  projectSlug: string | null;
  roleId: string | null;
  roleInfo: ProjectRoleInfo | null;
  isProjectOwner: boolean;
  projectOwnerEmail: string | null;
  projectOwnerLoaded: boolean;
  /** Доступ к актёрским тетрадкам: назначенный актёр или режиссёр (владелец проекта). */
  canViewActorWorkbook: boolean;

  myEmail: string;
  assignedEmails: string[];
  troupeEmails: string[];
  allowedActorEmails: string[];
  profilesByEmail: Record<string, TeamProfile | null | undefined>;

  notes: RoleNoteItem[];

  selectedActorEmail: string;
  snapshot: RoleWorkbookSnapshot | null;

  draft: RoleWorkbookDataV1;
  lastSavedAtIso: string | null;

  directorRefsSnapshot: RoleDirectorRefsSnapshot | null;
  directorRefsDraft: RoleDirectorRefsDataV1;
  directorRefsLastSavedAtIso: string | null;

  lastCleanupAtIso: string | null;
};

function normalizeEmail(v: unknown): string {
  return String(v ?? "").trim().toLowerCase();
}

function storageKey(projectSlug: string, roleId: string) {
  return `roleWorkbook:selectedActor:${projectSlug}:${roleId}`;
}

function defaultDraft(actorEmail: string): RoleWorkbookDataV1 {
  return {
    v: 1,
    actorEmail: normalizeEmail(actorEmail),
    biography: "",
    superObjective: "",
    appearance: "",
    referenceImages: [],
    referenceLinksLegacy: [],
    preparation: "",
    sceneArcs: [],
  };
}

function defaultDirectorRefsDraft(roleId: string): RoleDirectorRefsDataV1 {
  return { v: 1, roleId: String(roleId ?? "").trim(), images: [] };
}

const initialState: RoleWorkbookState = {
  loading: false,
  saving: false,
  savingDirectorRefs: false,
  cleaningImages: false,
  error: null,
  directorRefsError: null,
  cleanImagesError: null,
  projectSlug: null,
  roleId: null,
  roleInfo: null,
  isProjectOwner: false,
  projectOwnerEmail: null,
  projectOwnerLoaded: false,
  canViewActorWorkbook: false,
  myEmail: "",
  assignedEmails: [],
  troupeEmails: [],
  allowedActorEmails: [],
  profilesByEmail: {},
  notes: [],
  selectedActorEmail: "",
  snapshot: null,
  draft: defaultDraft(""),
  lastSavedAtIso: null,
  directorRefsSnapshot: null,
  directorRefsDraft: defaultDirectorRefsDraft(""),
  directorRefsLastSavedAtIso: null,
  lastCleanupAtIso: null,
};

function cleanupThrottleKey(projectSlug: string) {
  return `projectImages:lastCleanup:${projectSlug}`;
}

function shouldRunCleanup(projectSlug: string, minMinutes: number): boolean {
  if (typeof window === "undefined") return false;
  try {
    const raw = localStorage.getItem(cleanupThrottleKey(projectSlug));
    const last = raw ? +new Date(raw) : 0;
    const now = Date.now();
    return now - last > minMinutes * 60_000;
  } catch {
    return false;
  }
}

function markCleanupRun(projectSlug: string) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(cleanupThrottleKey(projectSlug), new Date().toISOString());
  } catch {}
}

export const loadRoleWorkbookThunk = createAsyncThunk<
  {
    projectSlug: string;
    roleId: string;
    roleInfo: ProjectRoleInfo | null;
    isProjectOwner: boolean;
    projectOwnerEmail: string | null;
    projectOwnerLoaded: boolean;
    canViewActorWorkbook: boolean;
    notes: RoleNoteItem[];
    myEmail: string;
    assignedEmails: string[];
    troupeEmails: string[];
    allowedActorEmails: string[];
    profiles: TeamProfile[];
    selectedActorEmail: string;
    snapshot: RoleWorkbookSnapshot | null;
    draft: RoleWorkbookDataV1;
    directorRefsSnapshot: RoleDirectorRefsSnapshot | null;
    directorRefsDraft: RoleDirectorRefsDataV1;
  },
  { accessToken: string; projectSlug: string; roleId: string },
  { state: RootState; rejectValue: string }
>("roleWorkbook/load", async ({ accessToken, projectSlug, roleId }, { getState, rejectWithValue, dispatch }) => {
  try {
    const state = getState() as any;
    const myEmailFromState = normalizeEmail(state?.profileData?.profile?.email ?? "");

    const notesPromise = getProjectRoleNotes(accessToken, projectSlug, roleId);

    const rolesFromState =
      projectApi.endpoints.projectRoles.select(projectSlug)(state)?.data?.roles ?? null;
    const rolesPromise = rolesFromState
      ? null
      : dispatch(projectApi.endpoints.projectRoles.initiate(projectSlug))
          .unwrap()
          .catch(() => null);

    const troupeFromState =
      troupeApi.endpoints.myTroupe.select({ project: projectSlug })(state)?.data?.members ?? null;
    const troupePromise = troupeFromState
      ? null
      : dispatch(troupeApi.endpoints.myTroupe.initiate({ project: projectSlug }))
          .unwrap()
          .catch(() => null);

    const myProfilePromise = myEmailFromState
      ? null
      : dispatch(profileApi.endpoints.myProfile.initiate())
          .unwrap()
          .catch(() => null);

    const ownerLoadedFromState = Boolean(state?.roleWorkbook?.projectOwnerLoaded);
    const ownerEmailFromState = normalizeEmail(state?.roleWorkbook?.projectOwnerEmail ?? "");
    const membersFromCache = projectApi.endpoints.projectMembers.select(projectSlug)(state)?.data;
    const ownerPromise =
      ownerLoadedFromState
        ? null
        : membersFromCache
          ? { owner: membersFromCache.owner }
          : dispatch(projectApi.endpoints.projectMembers.initiate(projectSlug))
              .unwrap()
              .catch((e: { status?: number }) => {
                if (e?.status === 403) return null;
                return null;
              });

    const [notesRes, rolesRes, troupeRes, myProfile, membersRes] = await Promise.all([
      notesPromise,
      rolesPromise,
      troupePromise,
      myProfilePromise,
      ownerPromise,
    ]);

    const myEmail = myEmailFromState || normalizeEmail(myProfile?.email ?? "");

    const roles = rolesFromState ?? (rolesRes?.roles ?? []);
    const roleInfo = roles.find((r) => String(r.id) === String(roleId)) ?? null;
    const assignedEmails = (roleInfo?.emails ?? []).map(normalizeEmail).filter(Boolean);

    const troupeMembers = troupeFromState ?? (troupeRes?.members ?? []);
    const troupeEmailsBase = (troupeMembers ?? [])
      .map((m: any) => normalizeEmail(m?.email ?? ""))
      .filter(Boolean);
    const troupeEmails = Array.from(new Set([...(troupeEmailsBase ?? []), ...(myEmail ? [myEmail] : [])]));

    // Important: assignments define who owns the role notebook.
    // Do not filter by "my troupe" here: directors and cross-troupe collaborators must still see assignments.
    const allowedActorEmails = Array.from(new Set(assignedEmails));

    const projectOwnerEmail =
      ownerLoadedFromState && ownerEmailFromState
        ? ownerEmailFromState
        : normalizeEmail(membersRes?.owner?.email ?? "");
    const projectOwnerLoaded = ownerLoadedFromState || membersRes != null;
    const isProjectOwner = Boolean(myEmail && projectOwnerEmail && myEmail === projectOwnerEmail);

    const isAssignedActor = Boolean(myEmail && allowedActorEmails.includes(myEmail));
    const canViewActorWorkbook = Boolean(isAssignedActor || isProjectOwner);

    const storedSelected =
      typeof window !== "undefined" ? String(localStorage.getItem(storageKey(projectSlug, roleId)) ?? "") : "";
    const storedSelectedNorm = normalizeEmail(storedSelected);
    const selectedActorEmail = (() => {
      // Actor: only self
      if (isAssignedActor) return myEmail;
      // Director: can inspect any assigned actor
      if (isProjectOwner) {
        if (storedSelectedNorm && allowedActorEmails.includes(storedSelectedNorm)) return storedSelectedNorm;
        return allowedActorEmails[0] ?? "";
      }
      // Viewer (no actor access): keep something stable for header, but actor workbook will be hidden.
      return allowedActorEmails[0] ?? "";
    })();

    const profiles = allowedActorEmails.length
      ? await dispatch(profileApi.endpoints.profilesBatch.initiate(allowedActorEmails))
          .unwrap()
          .catch(() => [])
      : [];
    const snapshot = canViewActorWorkbook && selectedActorEmail
      ? pickLatestWorkbookSnapshotForActor(notesRes?.notes ?? [], selectedActorEmail)
      : null;

    const draft = snapshot?.data
      ? snapshot.data
      : defaultDraft(canViewActorWorkbook ? (selectedActorEmail || myEmail || "") : "");

    const directorRefsSnapshot = pickLatestDirectorRefsSnapshotForRole(notesRes?.notes ?? [], roleId);
    const directorRefsDraft = directorRefsSnapshot?.data
      ? directorRefsSnapshot.data
      : defaultDirectorRefsDraft(roleId);
    return {
      projectSlug,
      roleId,
      roleInfo,
      isProjectOwner,
      projectOwnerEmail: projectOwnerEmail || null,
      projectOwnerLoaded,
      canViewActorWorkbook,
      notes: notesRes?.notes ?? [],
      myEmail,
      assignedEmails,
      troupeEmails,
      allowedActorEmails,
      profiles,
      selectedActorEmail,
      snapshot,
      draft,
      directorRefsSnapshot,
      directorRefsDraft,
    };
  } catch (e: any) {
    return rejectWithValue(String(e?.message ?? "Не удалось загрузить страницу роли"));
  }
});

export const saveRoleWorkbookThunk = createAsyncThunk<
  { noteId: string; updatedNotes: RoleNoteItem[]; snapshot: RoleWorkbookSnapshot | null; lastSavedAtIso: string },
  { accessToken: string; projectSlug: string; roleId: string },
  { state: RootState; rejectValue: string }
>("roleWorkbook/save", async ({ accessToken, projectSlug, roleId }, { dispatch, getState, rejectWithValue }) => {
  try {
    const s = (getState() as any).roleWorkbook as RoleWorkbookState | undefined;
    const draft = s?.draft;
    const myEmail = normalizeEmail(s?.myEmail ?? "");
    const allowed = new Set((s?.allowedActorEmails ?? []).map(normalizeEmail).filter(Boolean));
    if (!draft) return rejectWithValue("Нет данных для сохранения");
    if (!myEmail) return rejectWithValue("Профиль не загружен");
    if (!allowed.has(myEmail)) return rejectWithValue("Нет доступа: вы не в труппе или не назначены на роль");
    if (normalizeEmail(draft.actorEmail) !== myEmail) {
      return rejectWithValue("Нельзя сохранять страницу за другого актёра");
    }

    const content = encodeRoleWorkbookNoteContent({
      ...draft,
      v: 1,
      actorEmail: myEmail,
      savedAtIso: new Date().toISOString(),
      referenceImages: (draft as any)?.referenceImages?.map((x: any) => ({
        key: String(x?.key ?? "").trim(),
        url: typeof x?.url === "string" ? String(x.url).trim() || undefined : undefined,
        token: `orchestra-image:${encodeURIComponent(String(x?.key ?? "").trim())}`,
        caption: String(x?.caption ?? "").trim() || undefined,
      })) ?? [],
    });
    const res = await addProjectRoleNote(accessToken, projectSlug, roleId, content);
    const notesRes = await getProjectRoleNotes(accessToken, projectSlug, roleId);
    const notes = notesRes?.notes ?? [];
    const snapshot = myEmail ? pickLatestWorkbookSnapshotForActor(notes, myEmail) : null;

    // Opportunistic cleanup (throttled) after saves.
    if (shouldRunCleanup(projectSlug, 10)) {
      try {
        await dispatch(cleanupProjectImagesThunk({ accessToken, projectSlug })).unwrap();
      } catch {
        // ignore
      }
    }

    return {
      noteId: String(res.noteId ?? ""),
      updatedNotes: notes,
      snapshot,
      lastSavedAtIso: new Date().toISOString(),
    };
  } catch (e: any) {
    return rejectWithValue(String(e?.message ?? "Не удалось сохранить страницу роли"));
  }
});

export const saveDirectorRefsThunk = createAsyncThunk<
  { updatedNotes: RoleNoteItem[]; snapshot: RoleDirectorRefsSnapshot | null; lastSavedAtIso: string },
  { accessToken: string; projectSlug: string; roleId: string },
  { state: RootState; rejectValue: string }
>("roleWorkbook/saveDirectorRefs", async ({ accessToken, projectSlug, roleId }, { dispatch, getState, rejectWithValue }) => {
  try {
    const s = (getState() as any).roleWorkbook as RoleWorkbookState | undefined;
    const myEmail = normalizeEmail(s?.myEmail ?? "");
    let ownerEmail = normalizeEmail(s?.projectOwnerEmail ?? "");
    if (!s?.projectOwnerLoaded) {
      const members = await dispatch(projectApi.endpoints.projectMembers.initiate(projectSlug))
        .unwrap()
        .catch((e: { status?: number }) => {
          if (e?.status === 403) return null;
          return null;
        });
      ownerEmail = normalizeEmail(members?.owner?.email ?? "");
      dispatch(roleWorkbookActions.setProjectOwner({ ownerEmail: ownerEmail || null }));
    }
    if (!myEmail || !ownerEmail || myEmail !== ownerEmail) {
      return rejectWithValue("Только режиссёр (владелец проекта) может сохранять референсы");
    }
    const draft = s?.directorRefsDraft;
    const clean: RoleDirectorRefsDataV1 = {
      v: 1,
      savedAtIso: new Date().toISOString(),
      roleId: String(roleId ?? "").trim(),
      images: (draft?.images ?? [])
        .map((x) => ({
          key: String(x?.key ?? "").trim(),
          url: typeof (x as any)?.url === "string" ? String((x as any).url).trim() || undefined : undefined,
          token: `orchestra-image:${encodeURIComponent(String((x as any)?.key ?? "").trim())}`,
          caption: String(x?.caption ?? "").trim() || undefined,
        }))
        .filter((x) => Boolean(x.key))
        .slice(0, 200),
    };
    const content = encodeDirectorRefsNoteContent(clean);
    await addProjectRoleNote(accessToken, projectSlug, roleId, content);
    const notesRes = await getProjectRoleNotes(accessToken, projectSlug, roleId);
    const notes = notesRes?.notes ?? [];
    const snapshot = pickLatestDirectorRefsSnapshotForRole(notes, roleId);

    if (shouldRunCleanup(projectSlug, 10)) {
      try {
        await dispatch(cleanupProjectImagesThunk({ accessToken, projectSlug })).unwrap();
      } catch {
        // ignore
      }
    }

    return { updatedNotes: notes, snapshot, lastSavedAtIso: new Date().toISOString() };
  } catch (e: any) {
    return rejectWithValue(String(e?.message ?? "Не удалось сохранить референсы режиссёра"));
  }
});

export const cleanupProjectImagesThunk = createAsyncThunk<
  { referencedCount: number; deletedCount: number; skipped?: boolean },
  { accessToken: string; projectSlug: string },
  { state: RootState; rejectValue: string }
>("roleWorkbook/cleanupImages", async ({ accessToken, projectSlug }, { rejectWithValue }) => {
  try {
    const res = await cleanupProjectImages(accessToken, projectSlug);
    if (!res?.ok) return rejectWithValue("cleanup failed");
    return { referencedCount: res.referencedCount, deletedCount: res.deletedCount, skipped: res.skipped };
  } catch (e: any) {
    return rejectWithValue(String(e?.message ?? "Не удалось очистить изображения"));
  }
});

export const roleWorkbookSlice = createSlice({
  name: "roleWorkbook",
  initialState,
  reducers: {
    setProjectOwner(state, action: PayloadAction<{ ownerEmail: string | null }>) {
      state.projectOwnerEmail = action.payload.ownerEmail;
      state.projectOwnerLoaded = true;
      const me = normalizeEmail(state.myEmail);
      const owner = normalizeEmail(action.payload.ownerEmail);
      state.isProjectOwner = Boolean(me && owner && me === owner);
    },
    setSelectedActorEmail(state, action: PayloadAction<{ value: string }>) {
      const email = normalizeEmail(action.payload.value);
      const allowed = new Set((state.allowedActorEmails ?? []).map(normalizeEmail).filter(Boolean));
      const nextEmail = email && allowed.has(email) ? email : state.myEmail && allowed.has(normalizeEmail(state.myEmail)) ? normalizeEmail(state.myEmail) : (state.allowedActorEmails?.[0] ?? "");
      state.selectedActorEmail = nextEmail;
      if (state.projectSlug && state.roleId && typeof window !== "undefined") {
        try {
          localStorage.setItem(storageKey(state.projectSlug, state.roleId), nextEmail);
        } catch {}
      }
      state.snapshot = nextEmail ? pickLatestWorkbookSnapshotForActor(state.notes, nextEmail) : null;
      state.draft = state.snapshot?.data ? state.snapshot.data : defaultDraft(nextEmail || state.myEmail || "");
      state.lastSavedAtIso = null;
    },
    setDraftField(
      state,
      action: PayloadAction<{ key: keyof Omit<RoleWorkbookDataV1, "v" | "actorEmail">; value: any }>,
    ) {
      (state.draft as any)[action.payload.key] = action.payload.value;
    },
    setDraftReferences(state, action: PayloadAction<{ value: string[] }>) {
      // legacy: keep, but not used in UI anymore
      state.draft.referenceLinksLegacy = (action.payload.value ?? [])
        .map((x) => String(x ?? "").trim())
        .filter(Boolean);
    },
    addActorRefImages(state, action: PayloadAction<{ images: DirectorReferenceImage[] }>) {
      const incoming = (action.payload.images ?? [])
        .map((x) => ({
          key: String(x?.key ?? "").trim(),
          url: typeof x?.url === "string" ? String(x.url).trim() || undefined : undefined,
          caption: String(x?.caption ?? "").trim() || undefined,
        }))
        .filter((x) => Boolean(x.key));
      const existing = state.draft.referenceImages ?? [];
      const seen = new Set(existing.map((x) => x.key));
      const merged = [...existing];
      for (const it of incoming) {
        if (seen.has(it.key)) continue;
        merged.push(it);
        seen.add(it.key);
      }
      state.draft.referenceImages = merged.slice(0, 200);
    },
    setActorRefCaption(state, action: PayloadAction<{ key: string; caption: string }>) {
      const k = String(action.payload.key ?? "").trim();
      if (!k) return;
      const cap = String(action.payload.caption ?? "").trim();
      state.draft.referenceImages = (state.draft.referenceImages ?? []).map((x) =>
        x.key === k ? { ...x, caption: cap || undefined } : x,
      );
    },
    removeActorRefImage(state, action: PayloadAction<{ key: string }>) {
      const k = String(action.payload.key ?? "").trim();
      if (!k) return;
      state.draft.referenceImages = (state.draft.referenceImages ?? []).filter((x) => x.key !== k);
    },
    setDraftSceneArcs(state, action: PayloadAction<{ value: any[] }>) {
      const raw = Array.isArray(action.payload.value) ? action.payload.value : [];
      state.draft.sceneArcs = raw
        .map((x) => ({
          stepId: x?.stepId == null ? undefined : Number(x.stepId),
          stepTitle: typeof x?.stepTitle === "string" ? x.stepTitle : undefined,
          text: String(x?.text ?? ""),
        }))
        // Keep items even with empty text when stepId is present:
        // the arc list is a structural "scene list" bound to script steps.
        .filter((x) => (x.stepId != null && Number.isFinite(Number(x.stepId))) || Boolean(String(x.text ?? "").trim()))
        .slice(0, 200);
    },
    resetDraftFromSnapshot(state) {
      const email = state.selectedActorEmail || state.myEmail || "";
      state.snapshot = email ? pickLatestWorkbookSnapshotForActor(state.notes, email) : null;
      state.draft = state.snapshot?.data ? state.snapshot.data : defaultDraft(email);
      state.lastSavedAtIso = null;
      state.error = null;
    },
    addDirectorRefImages(state, action: PayloadAction<{ images: DirectorReferenceImage[] }>) {
      const incoming = (action.payload.images ?? [])
        .map((x) => ({
          key: String(x?.key ?? "").trim(),
          url: typeof x?.url === "string" ? String(x.url).trim() || undefined : undefined,
          caption: String(x?.caption ?? "").trim() || undefined,
        }))
        .filter((x) => Boolean(x.key));
      const existing = state.directorRefsDraft?.images ?? [];
      const seen = new Set(existing.map((x) => x.key));
      const merged = [...existing];
      for (const it of incoming) {
        if (seen.has(it.key)) continue;
        merged.push(it);
        seen.add(it.key);
      }
      state.directorRefsDraft = {
        ...(state.directorRefsDraft ?? defaultDirectorRefsDraft(state.roleId ?? "")),
        roleId: String(state.roleId ?? ""),
        images: merged.slice(0, 200),
      };
      state.directorRefsLastSavedAtIso = null;
      state.directorRefsError = null;
    },
    setDirectorRefCaption(state, action: PayloadAction<{ key: string; caption: string }>) {
      const k = String(action.payload.key ?? "").trim();
      if (!k) return;
      const cap = String(action.payload.caption ?? "").trim();
      const list = state.directorRefsDraft?.images ?? [];
      state.directorRefsDraft = {
        ...(state.directorRefsDraft ?? defaultDirectorRefsDraft(state.roleId ?? "")),
        roleId: String(state.roleId ?? ""),
        images: list.map((x) => (x.key === k ? { ...x, caption: cap || undefined } : x)),
      };
      state.directorRefsLastSavedAtIso = null;
    },
    removeDirectorRefImage(state, action: PayloadAction<{ key: string }>) {
      const k = String(action.payload.key ?? "").trim();
      if (!k) return;
      const list = state.directorRefsDraft?.images ?? [];
      state.directorRefsDraft = {
        ...(state.directorRefsDraft ?? defaultDirectorRefsDraft(state.roleId ?? "")),
        roleId: String(state.roleId ?? ""),
        images: list.filter((x) => x.key !== k),
      };
      state.directorRefsLastSavedAtIso = null;
    },
    resetDirectorRefsFromSnapshot(state) {
      state.directorRefsSnapshot = state.roleId
        ? pickLatestDirectorRefsSnapshotForRole(state.notes, state.roleId)
        : null;
      state.directorRefsDraft = state.directorRefsSnapshot?.data
        ? state.directorRefsSnapshot.data
        : defaultDirectorRefsDraft(state.roleId ?? "");
      state.directorRefsLastSavedAtIso = null;
      state.directorRefsError = null;
    },
  },
  extraReducers: (b) => {
    b.addCase(loadRoleWorkbookThunk.pending, (state) => {
      state.loading = true;
      state.error = null;
      state.directorRefsError = null;
    });
    b.addCase(loadRoleWorkbookThunk.fulfilled, (state, action) => {
      state.loading = false;
      state.error = null;
      state.projectSlug = action.payload.projectSlug;
      state.roleId = action.payload.roleId;
      state.roleInfo = action.payload.roleInfo;
      state.isProjectOwner = action.payload.isProjectOwner;
      state.projectOwnerEmail = action.payload.projectOwnerEmail;
      state.projectOwnerLoaded = action.payload.projectOwnerLoaded;
      state.canViewActorWorkbook = Boolean(action.payload.canViewActorWorkbook);
      state.notes = action.payload.notes;
      state.myEmail = action.payload.myEmail;
      state.assignedEmails = action.payload.assignedEmails;
      state.troupeEmails = action.payload.troupeEmails;
      state.allowedActorEmails = action.payload.allowedActorEmails;
      const map: Record<string, TeamProfile | null> = {};
      for (const em of action.payload.allowedActorEmails) map[em] = null;
      for (const p of action.payload.profiles ?? []) {
        const em = normalizeEmail(p?.email ?? "");
        if (!em) continue;
        map[em] = p;
      }
      state.profilesByEmail = map;
      state.selectedActorEmail = action.payload.selectedActorEmail;
      state.snapshot = action.payload.snapshot;
      state.draft = action.payload.draft;
      state.lastSavedAtIso = null;

      state.directorRefsSnapshot = action.payload.directorRefsSnapshot;
      state.directorRefsDraft = action.payload.directorRefsDraft;
      state.directorRefsLastSavedAtIso = null;
    });
    b.addCase(loadRoleWorkbookThunk.rejected, (state, action) => {
      state.loading = false;
      state.error = action.payload ?? "Не удалось загрузить страницу роли";
    });

    b.addCase(saveRoleWorkbookThunk.pending, (state) => {
      state.saving = true;
      state.error = null;
    });
    b.addCase(saveRoleWorkbookThunk.fulfilled, (state, action) => {
      state.saving = false;
      state.error = null;
      state.notes = action.payload.updatedNotes;
      const myEmail = normalizeEmail(state.myEmail);
      if (myEmail) state.snapshot = pickLatestWorkbookSnapshotForActor(state.notes, myEmail);
      state.lastSavedAtIso = action.payload.lastSavedAtIso;
    });
    b.addCase(saveRoleWorkbookThunk.rejected, (state, action) => {
      state.saving = false;
      state.error = action.payload ?? "Не удалось сохранить страницу роли";
    });

    b.addCase(saveDirectorRefsThunk.pending, (state) => {
      state.savingDirectorRefs = true;
      state.directorRefsError = null;
    });
    b.addCase(saveDirectorRefsThunk.fulfilled, (state, action) => {
      state.savingDirectorRefs = false;
      state.directorRefsError = null;
      state.notes = action.payload.updatedNotes;
      state.directorRefsSnapshot = action.payload.snapshot;
      state.directorRefsLastSavedAtIso = action.payload.lastSavedAtIso;
    });
    b.addCase(saveDirectorRefsThunk.rejected, (state, action) => {
      state.savingDirectorRefs = false;
      state.directorRefsError = action.payload ?? "Не удалось сохранить референсы режиссёра";
    });

    b.addCase(cleanupProjectImagesThunk.pending, (state) => {
      state.cleaningImages = true;
      state.cleanImagesError = null;
    });
    b.addCase(cleanupProjectImagesThunk.fulfilled, (state, action) => {
      state.cleaningImages = false;
      state.cleanImagesError = null;
      state.lastCleanupAtIso = new Date().toISOString();
      if (state.projectSlug) markCleanupRun(state.projectSlug);
    });
    b.addCase(cleanupProjectImagesThunk.rejected, (state, action) => {
      state.cleaningImages = false;
      state.cleanImagesError = action.payload ?? "Не удалось очистить изображения";
    });
  },
});

export const roleWorkbookActions = roleWorkbookSlice.actions;
export const roleWorkbookReducer = roleWorkbookSlice.reducer;

export function selectRoleWorkbook(state: RootState) {
  return (state as any).roleWorkbook as RoleWorkbookState;
}

