import { Navigate } from "react-router-dom";
import { ROUTES } from "../../shared/model/routes";

export const Component = () => <Navigate to={ROUTES.HOME} replace />;
