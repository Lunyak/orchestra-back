import type { ScriptScene } from "../../../shared/types/script";

export function sceneHasMaterial(scene: ScriptScene | null | undefined): boolean {
  if (!scene) return false;
  return Boolean(
    String(scene.markdown ?? "").trim() ||
      String(scene.playMarkdown ?? "").trim() ||
      String(scene.explicationMarkdown ?? "").trim(),
  );
}

export function isScenarioWithoutMaterial(scenes: ScriptScene[]): boolean {
  if (!scenes.length) return true;
  return scenes.every((scene) => !sceneHasMaterial(scene));
}
