import { migrateLegacyStorageKey } from "../../../shared/utils/migrate-legacy-storage-key";

const SCENES_COLLAPSED_KEY = "isScenesCollapsed";
const LEGACY_STEPS_COLLAPSED_KEY = "isStepsCollapsed";
const SCENE_PAGE_KEY_PREFIX = "selectedScenePage:";
const LEGACY_STEP_PAGE_KEY_PREFIX = "selectedStepPage:";

let browserStorageMigrated = false;

/** Одноразовая миграция localStorage step → scene (браузер). */
export function migratePlaybookLegacyBrowserStorage(): void {
  if (browserStorageMigrated || typeof window === "undefined") return;
  browserStorageMigrated = true;

  migrateLegacyStorageKey(LEGACY_STEPS_COLLAPSED_KEY, SCENES_COLLAPSED_KEY);

  try {
    const legacyKeys: string[] = [];
    for (let i = 0; i < localStorage.length; i += 1) {
      const key = localStorage.key(i);
      if (key?.startsWith(LEGACY_STEP_PAGE_KEY_PREFIX)) {
        legacyKeys.push(key);
      }
    }
    for (const legacyKey of legacyKeys) {
      const projectName = legacyKey.slice(LEGACY_STEP_PAGE_KEY_PREFIX.length);
      migrateLegacyStorageKey(legacyKey, `${SCENE_PAGE_KEY_PREFIX}${projectName}`);
    }
  } catch {
    // ignore
  }
}
