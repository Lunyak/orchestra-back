import { Button } from "@shared/core/button/Button";
import cn from "classnames";
import { useNavigate } from "react-router-dom";
import { DEFAULT_APP_PATH } from "./paths";
import "./route-not-found.css";

export function RouteNotFoundPage() {
  const navigate = useNavigate();

  return (
    <main className={cn("route-not-found-page")}>
      <section className={cn("route-not-found-page__panel")}>
        <h1 className={cn("route-not-found-page__title")}>
          Страница не найдена
        </h1>
        <p className={cn("route-not-found-page__description")}>
          Проверьте адрес или вернитесь на главную страницу.
        </p>
        <Button
          className={cn("secondary")}
          type="button"
          onClick={() => navigate(DEFAULT_APP_PATH, { replace: true })}
        >
          На главную
        </Button>
      </section>
    </main>
  );
}
