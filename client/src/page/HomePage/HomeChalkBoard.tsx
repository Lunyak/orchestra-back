import { FC } from "react";
import { Link } from "react-router-dom";
import { ChalkPageShell } from "../../shared/component/ChalkPageShell/ChalkPageShell";
import { ROUTES } from "../../shared/model/routes";
import { HomeChalkTicTacToe } from "./HomeChalkTicTacToe";
import "./home-chalk.css";

export const HomeChalkBoard: FC = () => {
  const eventsPath = `/${ROUTES.EVENTS}`;

  return (
    <ChalkPageShell mainClassName="chalk-page__main--home">
      <HomeChalkTicTacToe />

      <div className="chalk-page__home-bottom">
        <h1 className="chalk-page__title chalk-page__home-title">ДОФАМИН</h1>

        <Link to={eventsPath} className="chalk-page__afisha">
          АФИША
        </Link>
      </div>
    </ChalkPageShell>
  );
};
