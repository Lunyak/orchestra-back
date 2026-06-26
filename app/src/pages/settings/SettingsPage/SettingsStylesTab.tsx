import { ThemeSettingsSection } from "../../../features/settings/ui/ThemeSettingsSection";
import { SettingsScriptTextSection } from "./SettingsScriptTextSection";
import "./settings-styles-form.css";

export function SettingsStylesTab() {
  return (
    <div className="settings-tab-page settings-tab-page--styles">
      <ThemeSettingsSection />
      <SettingsScriptTextSection />
    </div>
  );
}
