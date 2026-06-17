import { normalizeCastRoleName } from "./role-name-utils";

export type RoleMarkerEntry = {
  id: string;
  name: string;
  aliases: string[];
  enabled: boolean;
  isCustom: boolean;
};

export type RoleMarkerSpec = {
  name: string;
  aliases: string[];
};

export function normalizeRoleMarkerKey(name: string): string {
  return String(name ?? "")
    .trim()
    .replace(/\s+/g, " ")
    .toLowerCase()
    .replace(/ё/g, "е");
}

export function parseAliasesInput(raw: string): string[] {
  return Array.from(
    new Set(
      String(raw ?? "")
        .split(/[,;]+/)
        .map((part) => part.trim().replace(/\.\s*$/, ""))
        .filter(Boolean),
    ),
  );
}

export function formatAliasesInput(aliases: string[]): string {
  return aliases.join(", ");
}

export function createRoleMarkerEntry(
  name: string,
  options?: { enabled?: boolean; isCustom?: boolean; aliases?: string[] },
): RoleMarkerEntry | null {
  const trimmed = String(name ?? "").trim().replace(/\.\s*$/, "");
  if (!trimmed) return null;
  const id = normalizeRoleMarkerKey(trimmed);
  if (!id) return null;
  const aliases = (options?.aliases ?? []).filter(
    (alias) => normalizeRoleMarkerKey(alias) !== id,
  );
  return {
    id,
    name: trimmed,
    aliases,
    enabled: options?.enabled ?? true,
    isCustom: options?.isCustom ?? false,
  };
}

export function roleEntriesToMarkerLines(entries: RoleMarkerEntry[]): string[] {
  return entries.filter((entry) => entry.enabled).map((entry) => entry.name);
}

export function roleEntriesToMarkerSpecs(entries: RoleMarkerEntry[]): RoleMarkerSpec[] {
  return entries
    .filter((entry) => entry.enabled)
    .map((entry) => ({
      name: entry.name,
      aliases: entry.aliases.filter(Boolean),
    }));
}

export function mergeDetectedRoleEntries(
  detectedNames: string[],
  prev: RoleMarkerEntry[],
): RoleMarkerEntry[] {
  const prevById = new Map(prev.map((entry) => [entry.id, entry]));
  const seen = new Set<string>();
  const next: RoleMarkerEntry[] = [];

  for (const rawName of detectedNames) {
    const entry = createRoleMarkerEntry(rawName, { isCustom: false });
    if (!entry || seen.has(entry.id)) continue;
    seen.add(entry.id);
    const existing = prevById.get(entry.id);
    next.push(
      existing
        ? {
            ...existing,
            name: entry.name,
            isCustom: existing.isCustom,
          }
        : entry,
    );
  }

  for (const entry of prev) {
    if (!entry.isCustom || seen.has(entry.id)) continue;
    seen.add(entry.id);
    next.push(entry);
  }

  return next;
}

export function entriesFromDetectedNames(names: string[]): RoleMarkerEntry[] {
  return mergeDetectedRoleEntries(names, []);
}

export function renameRoleMarkerEntry(
  entry: RoleMarkerEntry,
  nextName: string,
): RoleMarkerEntry | null {
  const trimmed = normalizeCastRoleName(nextName);
  if (!trimmed) return null;
  const nextId = normalizeRoleMarkerKey(trimmed);
  if (!nextId) return null;
  const aliases = entry.aliases.filter((alias) => normalizeRoleMarkerKey(alias) !== nextId);
  return {
    ...entry,
    id: nextId,
    name: trimmed,
    aliases,
  };
}

export function normalizeMarkerLookupKey(name: string): string {
  return normalizeRoleMarkerKey(normalizeCastRoleName(name));
}

/** Все варианты имени для поиска в тексте → каноническое имя в [[…]]. */
export function buildRoleMarkerLookup(
  specs: RoleMarkerSpec[],
): Map<string, string> {
  const lookup = new Map<string, string>();
  for (const spec of specs) {
    const canonical = normalizeCastRoleName(spec.name);
    if (!canonical) continue;
    const keys = [canonical, ...spec.aliases.map((alias) => normalizeCastRoleName(alias))].filter(
      Boolean,
    );
    for (const key of keys) {
      lookup.set(normalizeMarkerLookupKey(key), canonical);
    }
  }
  return lookup;
}

export function expandRoleMarkersForMatch(specs: RoleMarkerSpec[]): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const spec of specs) {
    for (const raw of [spec.name, ...spec.aliases]) {
      const name = normalizeCastRoleName(raw);
      const key = normalizeMarkerLookupKey(name);
      if (!name || seen.has(key)) continue;
      seen.add(key);
      out.push(name);
    }
  }
  return out.sort((a, b) => b.length - a.length);
}

export function canonicalRoleFromLookup(lookup: Map<string, string>, matched: string): string {
  const key = normalizeMarkerLookupKey(matched);
  return lookup.get(key) ?? normalizeCastRoleName(matched);
}
