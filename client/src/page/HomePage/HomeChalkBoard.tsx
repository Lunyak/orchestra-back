import { FC, MouseEvent } from "react";
import { Link } from "react-router-dom";
import { useChalkFlipFace } from "../../shared/component/ChalkBoardFlip/chalk-flip-context";
import { ChalkPageShell } from "../../shared/component/ChalkPageShell/ChalkPageShell";
import { ROUTES } from "../../shared/model/routes";
import { HomeChalkTicTacToe } from "./HomeChalkTicTacToe";
import "./home-chalk.css";

export const HomeChalkBoard: FC = () => {
  const eventsPath = `/${ROUTES.EVENTS}`;
  const flip = useChalkFlipFace();

  const onAfishaClick = (event: MouseEvent<HTMLAnchorElement>) => {
    if (!flip.active) return;
    event.preventDefault();
    flip.turnTo(eventsPath);
  };

  return (
    <ChalkPageShell mainClassName="chalk-page__main--home" showOrkestr>
      <h1 className="chalk-page__title chalk-page__home-title">ДОФАМИН</h1>

      <HomeChalkTicTacToe />

      <div className="chalk-page__home-bottom">
        <Link to={eventsPath} className="chalk-page__afisha" onClick={onAfishaClick}>
          АФИША
        </Link>
      </div>
    </ChalkPageShell>
  );
};
