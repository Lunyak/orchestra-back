import { useEffect } from "react";
import { useAppDispatch } from "../../../shared/store/hooks";
import { scriptUiActions } from "./script-ui-slice";

export function ScriptUiBootstrap() {
  const dispatch = useAppDispatch();

  useEffect(() => {
    dispatch(scriptUiActions.initScriptUi());
  }, [dispatch]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const rawKey = (e as KeyboardEvent & { key?: unknown })?.key;
      if (typeof rawKey !== "string" || rawKey.length === 0) return;
      const key = rawKey.toLowerCase();
      const isToggleShortcut = key === "r" && (e.metaKey || e.ctrlKey) && !e.shiftKey;
      if (!isToggleShortcut) return;
      e.preventDefault();
      dispatch(scriptUiActions.toggleEditing());
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [dispatch]);

  return null;
}
