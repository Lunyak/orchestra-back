import { useCallback, useEffect, useMemo, useRef, useState, type ClipboardEvent } from "react";
import type { AppDispatch } from "../../../shared/store/store";
import { getPlayUrl, uploadProjectFile } from "../../../sync/api/files";
import { actorLabel } from "./roleWorkbookNote";
import {
  roleWorkbookActions,
  saveRoleWorkbookThunk,
  type RoleWorkbookState,
} from "./roleWorkbookSlice";
import {
  clipboardImageFile,
  distributeIntoColumns,
  imageFilesFromTransfer,
  referenceColumnCount,
} from "./workbook-image-transfer";

type WorkbookReferenceImage = {
  key: string;
  url?: string;
  caption?: string;
};

type CombinedReferenceImage = {
  source: "actor" | "director";
  sourceLabel: string;
  img: WorkbookReferenceImage;
  idx: number;
};

type UseRoleWorkbookReferenceImagesArgs = {
  dispatch: AppDispatch;
  accessToken: string | null;
  projectSlug: string | undefined;
  effectiveRoleId: string;
  canEdit: boolean;
  canEditDirectorRefs: boolean;
  selectedActor: string;
  draftReferenceImages: WorkbookReferenceImage[] | undefined;
  directorImages: WorkbookReferenceImage[];
  profilesByEmail: RoleWorkbookState["profilesByEmail"];
  directorRefsError: string | null;
  ensureRemoteProject: (token: string) => Promise<string | null | undefined>;
  markActorDraftDirty: () => void;
  markDirectorRefsDirty: () => void;
  saveDirectorRefsNow: () => Promise<void>;
};

export function useRoleWorkbookReferenceImages(args: UseRoleWorkbookReferenceImagesArgs) {
  const {
    dispatch,
    accessToken,
    projectSlug,
    effectiveRoleId,
    canEdit,
    canEditDirectorRefs,
    selectedActor,
    draftReferenceImages,
    directorImages,
    profilesByEmail,
    directorRefsError,
    ensureRemoteProject,
    markActorDraftDirty,
    markDirectorRefsDirty,
    saveDirectorRefsNow,
  } = args;

  const actorImages = useMemo(() => draftReferenceImages ?? [], [draftReferenceImages]);
  const [uploading, setUploading] = useState(false);
  const [lightboxIdx, setLightboxIdx] = useState<number | null>(null);
  const directorFileInputRef = useRef<HTMLInputElement | null>(null);
  const directorRefsSectionRef = useRef<HTMLDivElement | null>(null);
  const [actorUploading, setActorUploading] = useState(false);
  const [actorLightboxIdx, setActorLightboxIdx] = useState<number | null>(null);
  const actorFileInputRef = useRef<HTMLInputElement | null>(null);
  const urlCacheRef = useRef<Map<string, string>>(new Map());
  const [urlTick, setUrlTick] = useState(0);

  const ensureImageUrl = useCallback(
    async (key: string) => {
      const k = String(key ?? "").trim();
      if (!k) return null;
      const cached = urlCacheRef.current.get(k);
      if (cached) return cached;
      if (!accessToken) return null;
      try {
        const { url } = await getPlayUrl(accessToken, k);
        if (url) {
          urlCacheRef.current.set(k, url);
          setUrlTick((x) => x + 1);
        }
        return url ?? null;
      } catch {
        return null;
      }
    },
    [accessToken],
  );

  const uploadDirectorClipboardImage = useCallback(
    async (file: File | null) => {
      if (!canEditDirectorRefs || !file) return;
      if (!accessToken || !projectSlug) return;
      const projectId = await ensureRemoteProject(accessToken);
      if (!projectId) return;

      setUploading(true);
      try {
        const { key, url } = await uploadProjectFile(accessToken, { projectId, type: "image", file });
        if (!key) return;
        dispatch(roleWorkbookActions.addDirectorRefImages({ images: [{ key, url }] as any }));
        markDirectorRefsDirty();
      } finally {
        setUploading(false);
      }
    },
    [
      accessToken,
      canEditDirectorRefs,
      dispatch,
      ensureRemoteProject,
      markDirectorRefsDirty,
      projectSlug,
    ],
  );

  const onDirectorRefsPaste = useCallback(
    async (e: ClipboardEvent<HTMLDivElement>) => {
      if (!canEditDirectorRefs) return;
      const file = clipboardImageFile(e.clipboardData);
      if (!file) return;
      e.preventDefault();
      e.stopPropagation();
      await uploadDirectorClipboardImage(file);
    },
    [canEditDirectorRefs, uploadDirectorClipboardImage],
  );

  useEffect(() => {
    if (!canEditDirectorRefs) return;
    const onPaste = (e: globalThis.ClipboardEvent) => {
      const file = clipboardImageFile(e.clipboardData);
      if (!file) return;

      const section = directorRefsSectionRef.current;
      const target = e.target;
      const targetNode = target instanceof Node ? target : null;
      const pastedInsideRefs = Boolean(section && targetNode && section.contains(targetNode));
      const active = document.activeElement;
      const pastedWithoutFocusedField =
        active === document.body || active == null || active === document.documentElement;
      if (!pastedInsideRefs && !pastedWithoutFocusedField) return;

      e.preventDefault();
      void uploadDirectorClipboardImage(file);
    };
    document.addEventListener("paste", onPaste);
    return () => document.removeEventListener("paste", onPaste);
  }, [canEditDirectorRefs, uploadDirectorClipboardImage]);

  const uploadActorImages = useCallback(
    async (files: File[] | FileList | null) => {
      if (!canEdit) return;
      if (!files || files.length === 0) return;
      if (!accessToken || !projectSlug) return;
      const selected = Array.from(files).slice(0, 20);
      if (selected.length === 0) return;
      const projectId = await ensureRemoteProject(accessToken);
      if (!projectId) return;
      setActorUploading(true);
      try {
        const uploaded: Array<{ key: string; url?: string }> = [];
        for (const f of selected) {
          const { key, url } = await uploadProjectFile(accessToken, { projectId, type: "image", file: f });
          if (key) {
            if (url) urlCacheRef.current.set(key, url);
            uploaded.push({ key, url });
          }
        }
        if (uploaded.length > 0) {
          setUrlTick((x) => x + 1);
          dispatch(roleWorkbookActions.addActorRefImages({ images: uploaded as any }));
          markActorDraftDirty();
          if (effectiveRoleId) {
            await dispatch(
              saveRoleWorkbookThunk({ accessToken, projectSlug, roleId: effectiveRoleId }),
            );
          }
        }
      } finally {
        setActorUploading(false);
      }
    },
    [
      accessToken,
      canEdit,
      dispatch,
      ensureRemoteProject,
      markActorDraftDirty,
      projectSlug,
      effectiveRoleId,
    ],
  );

  const canAddReferenceImages = Boolean(canEdit || canEditDirectorRefs);
  const referenceUploading = Boolean(actorUploading || uploading);

  const referenceAuthorLabel = canEdit
    ? `актёра ${actorLabel(profilesByEmail?.[selectedActor] ?? null, selectedActor)}`
    : "режиссёра";

  const combinedReferenceImages = useMemo((): CombinedReferenceImage[] => {
    const actorName = actorLabel(profilesByEmail?.[selectedActor] ?? null, selectedActor);
    return [
      ...actorImages.map((img, idx) => ({
        source: "actor" as const,
        sourceLabel: `от актёра ${actorName}`,
        img,
        idx,
      })),
      ...directorImages.map((img, idx) => ({
        source: "director" as const,
        sourceLabel: "от режиссёра",
        img,
        idx,
      })),
    ];
  }, [actorImages, directorImages, profilesByEmail, selectedActor]);

  const referenceColumns = useMemo(() => {
    return distributeIntoColumns(
      combinedReferenceImages,
      referenceColumnCount(combinedReferenceImages.length),
    );
  }, [combinedReferenceImages]);

  const uploadDirectorImages = useCallback(
    async (files: File[] | FileList | null) => {
      const selected = Array.from(files ?? [])
        .filter((file) => String(file?.type ?? "").startsWith("image/"))
        .slice(0, 20);
      if (selected.length === 0) return;
      if (!accessToken || !projectSlug) return;
      if (!effectiveRoleId) return;
      const projectId = await ensureRemoteProject(accessToken);
      if (!projectId) return;
      setUploading(true);
      try {
        const uploaded: Array<{ key: string; url?: string }> = [];
        for (const f of selected) {
          const { key, url } = await uploadProjectFile(accessToken, { projectId, type: "image", file: f });
          if (key) {
            if (url) urlCacheRef.current.set(key, url);
            uploaded.push({ key, url });
          }
        }
        if (uploaded.length > 0) {
          setUrlTick((x) => x + 1);
          dispatch(roleWorkbookActions.addDirectorRefImages({ images: uploaded as any }));
          markDirectorRefsDirty();
          await saveDirectorRefsNow();
        }
      } finally {
        setUploading(false);
      }
    },
    [
      accessToken,
      dispatch,
      ensureRemoteProject,
      effectiveRoleId,
      markDirectorRefsDirty,
      projectSlug,
      saveDirectorRefsNow,
    ],
  );

  const uploadReferenceImages = useCallback(
    async (files: File[] | FileList | null) => {
      if (canEdit) {
        await uploadActorImages(files);
        return;
      }
      if (canEditDirectorRefs) {
        await uploadDirectorImages(files);
      }
    },
    [canEdit, canEditDirectorRefs, uploadActorImages, uploadDirectorImages],
  );

  const onReferenceRefsPaste = useCallback(
    async (e: ClipboardEvent<HTMLDivElement>) => {
      if (!canAddReferenceImages) return;
      const file = clipboardImageFile(e.clipboardData);
      if (!file) return;
      e.preventDefault();
      e.stopPropagation();
      await uploadReferenceImages([file]);
    },
    [canAddReferenceImages, uploadReferenceImages],
  );

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const list = actorImages.slice(0, 200);
      for (const img of list) {
        if (cancelled) return;
        if (!img?.key) continue;
        if (!urlCacheRef.current.get(img.key)) await ensureImageUrl(img.key);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [actorImages, ensureImageUrl]);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const list = directorImages.slice(0, 200);
      for (const img of list) {
        if (cancelled) return;
        if (!img?.key) continue;
        if (!urlCacheRef.current.get(img.key)) await ensureImageUrl(img.key);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [directorImages, ensureImageUrl]);

  useEffect(() => {
    if (lightboxIdx == null) return;
    const img = directorImages[lightboxIdx];
    if (!img?.key) return;
    if (!urlCacheRef.current.get(img.key)) void ensureImageUrl(img.key);
  }, [directorImages, ensureImageUrl, lightboxIdx]);

  useEffect(() => {
    if (actorLightboxIdx == null) return;
    const img = actorImages[actorLightboxIdx];
    if (!img?.key) return;
    if (!urlCacheRef.current.get(img.key)) void ensureImageUrl(img.key);
  }, [actorImages, actorLightboxIdx, ensureImageUrl]);

  return {
    actorImages,
    directorImages,
    actorFileInputRef,
    directorFileInputRef,
    directorRefsSectionRef,
    uploadActorImages,
    uploadDirectorImages,
    uploadReferenceImages,
    onReferenceRefsPaste,
    onDirectorRefsPaste,
    canAddReferenceImages,
    referenceUploading,
    referenceAuthorLabel,
    combinedReferenceImages,
    referenceColumns,
    directorRefsError,
    urlCacheRef,
    ensureImageUrl,
    lightboxIdx,
    setLightboxIdx,
    actorLightboxIdx,
    setActorLightboxIdx,
    imageFilesFromTransfer,
    urlTick,
  };
}
