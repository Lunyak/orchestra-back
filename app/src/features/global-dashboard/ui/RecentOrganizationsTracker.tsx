import { useEffect } from "react";
import { useLocation } from "react-router-dom";
import { rememberOrganizationFromPath } from "../model/recent-organizations-storage";

export function RecentOrganizationsTracker() {
  const { pathname } = useLocation();

  useEffect(() => {
    rememberOrganizationFromPath(pathname);
  }, [pathname]);

  return null;
}
