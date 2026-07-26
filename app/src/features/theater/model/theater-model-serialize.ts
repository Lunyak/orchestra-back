import type { ScriptScene, TheaterModel } from "../../../shared/types/script";

export function mapTheaterModelFromApi(raw: unknown): TheaterModel | null {
  if (!raw || typeof raw !== "object") return null;
  const m = raw as Record<string, unknown>;
  const id = Number(m.sourceId ?? m.id ?? 0);
  if (!Number.isFinite(id) || id <= 0) return null;
  return {
    id,
    name: String(m.name ?? ""),
    type: m.type as TheaterModel["type"],
    builtin: m.builtin as TheaterModel["builtin"],
    file: typeof m.file === "string" ? m.file : undefined,
    decorSize: Array.isArray(m.decorSize)
      ? (m.decorSize as [number, number, number])
      : undefined,
    decorColor: typeof m.decorColor === "string" ? m.decorColor : undefined,
    decorTexture: typeof m.decorTexture === "string" ? m.decorTexture : undefined,
    decorTextureRepeat:
      typeof m.decorTextureRepeat === "number" ? m.decorTextureRepeat : undefined,
    decorTextureMode: m.decorTextureMode as TheaterModel["decorTextureMode"],
    decorTextureFaces: Array.isArray(m.decorTextureFaces)
      ? (m.decorTextureFaces as TheaterModel["decorTextureFaces"])
      : undefined,
    decorOneSided: Boolean(m.decorOneSided),
    decorOpacity: typeof m.decorOpacity === "number" ? m.decorOpacity : undefined,
    decorRoughness: typeof m.decorRoughness === "number" ? m.decorRoughness : undefined,
    decorMetalness: typeof m.decorMetalness === "number" ? m.decorMetalness : undefined,
    decorEmissiveColor:
      typeof m.decorEmissiveColor === "string" ? m.decorEmissiveColor : undefined,
    decorEmissiveIntensity:
      typeof m.decorEmissiveIntensity === "number" ? m.decorEmissiveIntensity : undefined,
    decorMaterialSide: m.decorMaterialSide as TheaterModel["decorMaterialSide"],
    actorPose: m.actorPose as TheaterModel["actorPose"],
    modelLowDetail: Boolean(m.modelLowDetail),
    humanSkinColor:
      typeof m.humanSkinColor === "string" ? m.humanSkinColor : undefined,
    humanTopColor:
      typeof m.humanTopColor === "string" ? m.humanTopColor : undefined,
    humanBottomColor:
      typeof m.humanBottomColor === "string" ? m.humanBottomColor : undefined,
    humanShoeColor:
      typeof m.humanShoeColor === "string" ? m.humanShoeColor : undefined,
    allowOutOfBounds: Boolean(m.allowOutOfBounds),
    ignoreCollisions: Boolean(m.ignoreCollisions),
    ...(m.hidden === true ? { hidden: true } : {}),
    ...(m.isRequisite === true ? { isRequisite: true } : {}),
    position: (m.position as TheaterModel["position"]) ?? [0, 0, 0],
    rotation: (m.rotation as TheaterModel["rotation"]) ?? [0, 0, 0],
    scale: (m.scale as TheaterModel["scale"]) ?? [1, 1, 1],
  };
}

export function mapTheaterModelsFromApiScene(scene: unknown): {
  theaterModels: TheaterModel[];
  theaterDecor?: TheaterModel[];
} {
  const st = scene as Record<string, unknown> | null;
  const theaterModels = (Array.isArray(st?.theaterModels) ? st.theaterModels : [])
    .map(mapTheaterModelFromApi)
    .filter((item): item is TheaterModel => item != null);
  const theaterDecor = (Array.isArray(st?.theaterDecor) ? st.theaterDecor : [])
    .map(mapTheaterModelFromApi)
    .filter((item): item is TheaterModel => item != null);
  return {
    theaterModels,
    theaterDecor: theaterDecor.length > 0 ? theaterDecor : undefined,
  };
}

export function mapTheaterModelToApiPayload(model: TheaterModel, kind: "prop" | "decor" = "prop") {
  return {
    id: model.id,
    name: model.name,
    type: model.type ?? "builtin",
    builtin: model.builtin ?? null,
    file: model.file ?? null,
    kind,
    allowOutOfBounds: model.allowOutOfBounds ?? false,
    ignoreCollisions: model.ignoreCollisions ?? false,
    hidden: model.hidden === true ? true : null,
    isRequisite: model.isRequisite === true ? true : null,
    position: model.position,
    rotation: model.rotation,
    scale: model.scale,
    decorSize: model.decorSize ?? null,
    decorColor: model.decorColor ?? null,
    decorTexture: model.decorTexture ?? null,
    decorTextureRepeat: model.decorTextureRepeat ?? null,
    decorTextureMode: model.decorTextureMode ?? null,
    decorTextureFaces: model.decorTextureFaces ?? null,
    decorOneSided: model.decorOneSided ?? false,
    decorOpacity: model.decorOpacity ?? null,
    decorRoughness: model.decorRoughness ?? null,
    decorMetalness: model.decorMetalness ?? null,
    decorEmissiveColor: model.decorEmissiveColor ?? null,
    decorEmissiveIntensity: model.decorEmissiveIntensity ?? null,
    decorMaterialSide: model.decorMaterialSide ?? null,
    actorPose: model.actorPose ?? null,
    modelLowDetail: model.modelLowDetail ?? false,
    humanSkinColor: model.humanSkinColor ?? null,
    humanTopColor: model.humanTopColor ?? null,
    humanBottomColor: model.humanBottomColor ?? null,
    humanShoeColor: model.humanShoeColor ?? null,
  };
}

export function resolveSceneTheaterFromApi(scene: unknown): {
  theaterModels: TheaterModel[];
  theaterDecor?: TheaterModel[];
} {
  const st = scene as Record<string, unknown> | null;
  if (Array.isArray(st?.theaterDecor) && (st.theaterDecor as unknown[]).length > 0) {
    return mapTheaterModelsFromApiScene(scene);
  }
  const theaterModels: TheaterModel[] = [];
  const theaterDecor: TheaterModel[] = [];
  for (const raw of Array.isArray(st?.theaterModels) ? st.theaterModels : []) {
    const mapped = mapTheaterModelFromApi(raw);
    if (!mapped) continue;
    const kind = (raw as Record<string, unknown>)?.kind;
    if (kind === "decor") theaterDecor.push(mapped);
    else theaterModels.push(mapped);
  }
  return {
    theaterModels,
    theaterDecor: theaterDecor.length > 0 ? theaterDecor : undefined,
  };
}

export function writeSceneTheaterModelsToApi(
  models: TheaterModel[],
  decor?: TheaterModel[],
): {
  theaterModels: ReturnType<typeof mapTheaterModelToApiPayload>[];
  theaterDecor?: ReturnType<typeof mapTheaterModelToApiPayload>[];
} {
  return {
    theaterModels: models.map((m) => mapTheaterModelToApiPayload(m, "prop")),
    theaterDecor:
      decor && decor.length > 0
        ? decor.map((m) => mapTheaterModelToApiPayload(m, "decor"))
        : undefined,
  };
}
