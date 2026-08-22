import { useEffect } from "react";
import { Navigate } from "react-router-dom";
import { PageBootLoader } from "@shared/components/page-loader/page-boot";
import { projectSettingsPath } from "../../app/router/paths";
import { useProject } from "../../features/project";

const SETTINGS_ACTIVE_TAB_KEY = "orchestra:settings.activeTab";

/** Legacy `/settings/bot` → вкладка «Бот» на странице настроек. */
export function SettingsBotPage() {
  const { projectName } = useProject();

  useEffect(() => {
    try {
      localStorage.setItem(SETTINGS_ACTIVE_TAB_KEY, "bot");
    } catch {
      // ignore
    }
  }, []);

  if (!projectName) {
    return <PageBootLoader label="Загрузка настроек…" />;
  }

  return <Navigate to={projectSettingsPath(projectName)} replace />;
}
