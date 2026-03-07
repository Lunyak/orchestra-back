import { FC, useCallback, useEffect, useRef } from "react";
import { Link } from "react-router-dom";
import SmokeText from "../../shared/component/SmokeText/SmokeText";
import { ROUTES } from "../../shared/model/routes";
import "./style.css";

const HomePage: FC = () => {
  const audioRef = useRef<HTMLAudioElement>(null);

  const handleFirstInteraction = useCallback(() => {
    if (audioRef.current) {
      audioRef.current
        .play()
        .catch((e) => console.log("Audio play failed:", e));
      document.removeEventListener("click", handleFirstInteraction);
    }
  }, []);

  useEffect(() => {
    document.addEventListener("click", handleFirstInteraction);
    handleFirstInteraction();
    return () => {
      document.removeEventListener("click", handleFirstInteraction);
    };
  }, [handleFirstInteraction]);

  return (
    <div className="home-page">
      <SmokeText color={0xb8354a} text="Дофамин" />
      <div className="home-page__container">

        <nav>
          <Link to={ROUTES.EVENTS}>Спектакли</Link>
          <Link to={ROUTES.ABOUTUS}>Труппа</Link>
          <Link to={ROUTES.CONTACTS}>Контакты</Link>
        </nav>
      </div>
    </div>
  );
};

export const Component = HomePage;
