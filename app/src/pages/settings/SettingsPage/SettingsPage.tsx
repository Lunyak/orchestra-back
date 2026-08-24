import cn from "classnames";
import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { SettingsBotTab } from "./SettingsBotTab";
import { SettingsGeneralTab } from "./SettingsGeneralTab";
import { SettingsMediaTab } from "./SettingsMediaTab";
import { SettingsRightsTab } from "./SettingsRightsTab";
import { SettingsStylesTab } from "./SettingsStylesTab";
import "./style.css";

export const SETTINGS_ACTIVE_TAB_KEY = "orchestra:settings.activeTab";

export type SettingsTabId =
  | "general"
  | "rights"
  | "media"
  | "bot"
  | "styles";

const SETTINGS_TAB_IDS: SettingsTabId[] = [
  "general",
  "rights",
  "media",
  "bot",
  "styles",
];

function isSettingsTabId(value: string | null): value is SettingsTabId {
  return SETTINGS_TAB_IDS.includes(value as SettingsTabId);
}

function readSettingsActiveTab(): SettingsTabId {
  if (typeof window === "undefined") return "general";
  try {
    const stored = localStorage.getItem(SETTINGS_ACTIVE_TAB_KEY);
    if (isSettingsTabId(stored)) return stored;
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

const SETTINGS_TABS: Array<{ id: SettingsTabId; label: string }> = [
  { id: "general", label: "Основные" },
  { id: "rights", label: "Права" },
  { id: "media", label: "Медиа" },
  { id: "bot", label: "Бот" },
  { id: "styles", label: "Стили" },
];

function renderSettingsTab(tab: SettingsTabId) {
  if (tab === "general") return <SettingsGeneralTab />;
  if (tab === "rights") return <SettingsRightsTab />;
  if (tab === "media") return <SettingsMediaTab />;
  if (tab === "bot") return <SettingsBotTab />;
  return <SettingsStylesTab />;
}

export function SettingsPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const tabFromUrl = searchParams.get("tab");
  const [activeTab, setActiveTabState] = useState<SettingsTabId>(() =>
    isSettingsTabId(tabFromUrl) ? tabFromUrl : readSettingsActiveTab(),
  );

  useEffect(() => {
    if (!isSettingsTabId(tabFromUrl)) return;
    setActiveTabState(tabFromUrl);
    writeSettingsActiveTab(tabFromUrl);
  }, [tabFromUrl]);

  useEffect(() => {
    if (isSettingsTabId(tabFromUrl)) return;
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        next.set("tab", activeTab);
        return next;
      },
      { replace: true },
    );
  }, [activeTab, setSearchParams, tabFromUrl]);

  const setActiveTab = (tab: SettingsTabId) => {
    setActiveTabState(tab);
    writeSettingsActiveTab(tab);
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        next.set("tab", tab);
        return next;
      },
      { replace: true },
    );
  };

  return (
    <div className="app-layout settings-layout">
      <div className="app-content">
        <main className="main-content main-content-settings">
          <div className="settings-view">
            <div
              className="settings-tabs"
              role="tablist"
              aria-label="Разделы настроек"
            >
              {SETTINGS_TABS.map((tab) => {
                const isActive = activeTab === tab.id;
                return (
                  <button
                    key={tab.id}
                    type="button"
                    className={cn(
                      "settings-tab-btn",
                      isActive && "settings-tab-btn--active",
                    )}
                    onClick={() => setActiveTab(tab.id)}
                    role="tab"
                    aria-selected={isActive}
                  >
                    {tab.label}
                  </button>
                );
              })}
            </div>

            <div className="settings-tab-content" role="tabpanel">
              {renderSettingsTab(activeTab)}
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
