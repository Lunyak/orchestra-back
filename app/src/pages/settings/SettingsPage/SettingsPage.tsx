import cn from "classnames";
import { Button } from "@shared/core/button/Button";
import { useState } from "react";
import { useAuth } from "../../../features/auth";
import { useProject } from "../../../features/project";
import { SettingsGeneralTab } from "./SettingsGeneralTab";
import { SettingsStylesTab } from "./SettingsStylesTab";
import "./style.css";

const SETTINGS_ACTIVE_TAB_KEY = "orchestra:settings.activeTab";

export type SettingsTabId = "general" | "styles";

function readSettingsActiveTab(): SettingsTabId {
  if (typeof window === "undefined") return "general";
  try {
    const stored = localStorage.getItem(SETTINGS_ACTIVE_TAB_KEY);
    if (stored === "styles" || stored === "general") return stored;
  } catch {
    // ignore
  }
  return "general";
}

function writeSettingsActiveTab(tab: SettingsTabId): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(SETTINGS_ACTIVE_TAB_KEY, tab);
  } catch {
    // ignore
  }
}

export function SettingsPage() {
  const { logout } = useAuth();
  const { currentProjectDisplayName } = useProject();
  const [activeTab, setActiveTabState] = useState<SettingsTabId>(() => readSettingsActiveTab());

  const setActiveTab = (tab: SettingsTabId) => {
    setActiveTabState(tab);
    writeSettingsActiveTab(tab);
  };

  return (
    <div className="app-layout settings-layout">
      <div className="app-content">
        <main className="main-content main-content-settings">
          <div className="settings-view">
            <div className="settings-view-header">
              <div>
                <h2 className="settings-page-title">Настройки</h2>
                <p className="settings-view-subtitle">
                  Проект: <b>{currentProjectDisplayName || "не выбран"}</b>
                </p>
              </div>
              <Button type="button" className="danger" onClick={logout}>
                Выйти из аккаунта
              </Button>
            </div>

            <div className="settings-tabs" role="tablist" aria-label="Разделы настроек">
              <button
                type="button"
                className={cn("settings-tab-btn", activeTab === "general" && "settings-tab-btn--active")}
                onClick={() => setActiveTab("general")}
                role="tab"
                aria-selected={activeTab === "general"}
              >
                Основные
              </button>
              <button
                type="button"
                className={cn("settings-tab-btn", activeTab === "styles" && "settings-tab-btn--active")}
                onClick={() => setActiveTab("styles")}
                role="tab"
                aria-selected={activeTab === "styles"}
              >
                Стили
              </button>
            </div>

            <div className="settings-tab-content" role="tabpanel">
              {activeTab === "general" ? <SettingsGeneralTab /> : <SettingsStylesTab />}
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
