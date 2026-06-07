import App from "@app/App";
import { resyncDesktopProjectFromSettings } from "@app/sync/desktopResync";

const isDesktop = import.meta.env.MODE === "desktop";

export default function AppShell() {
  if (!isDesktop) {
    return <App />;
  }

  return <App onResyncProject={resyncDesktopProjectFromSettings} />;
}
