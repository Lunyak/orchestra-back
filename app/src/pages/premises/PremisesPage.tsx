import { Navigate } from "react-router-dom";

export function PremisesPage() {
  return <Navigate to="/troupe" replace state={{ tab: "premises" }} />;
}
