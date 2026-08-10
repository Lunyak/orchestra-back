import { useEffect, type ReactNode } from "react";
import {
  type AdminSection,
  writeAdminSection,
} from "../../settings/adminSection";
import "./style.css";

type AdminSectionChromeProps = {
  activeSection: AdminSection;
  children?: ReactNode;
};

export function AdminSectionChrome({
  activeSection,
  children,
}: AdminSectionChromeProps) {
  useEffect(() => {
    writeAdminSection(activeSection);
  }, [activeSection]);

  return (
    <div className="admin-chrome-layout">
      {children != null ? (
        <div className="admin-chrome-layout__main">{children}</div>
      ) : null}
    </div>
  );
}
