import type { ReactNode } from "react";
import { AdminSectionChrome } from "../admin/AdminSectionChrome";

export type RehearsalPlanTab = "board" | "sessions";

type RehearsalPlanSectionChromeProps = {
  activeTab: RehearsalPlanTab | "tasks";
  children?: ReactNode;
};

export function RehearsalPlanSectionChrome({
  activeTab,
  children,
}: RehearsalPlanSectionChromeProps) {
  const activeSection = activeTab === "tasks" ? "tasks" : "plan";

  return (
    <AdminSectionChrome activeSection={activeSection}>
      {children}
    </AdminSectionChrome>
  );
}
