import { Link } from "react-router-dom";
import { ROUTES } from "../../shared/model/routes";
import { Seo } from "../../shared/component/Seo/Seo";
import "./style.css";

const ContactsPage = () => {
  const vkGroupUrl = "https://vk.com/dofaminspb";
  const vkHowToFindVideoUrl = "https://vk.com/video-81928625_456239136";

  return (
    <div className="contacts-page">
      <Seo
        title="Контакты — Театр «Дофамин»"
        description="Контакты театра «Дофамин»: почта, Telegram, ВКонтакте и как нас найти."
        canonicalPath="/контакты"
      />
      <div className="contacts-page__background">
      </div>

      <Link to={ROUTES.HOME} className="contacts-page__back">
        Назад
      </Link>

      <div className="contacts-page__content">
        <h1 className="contacts-page__title">Контакты</h1>
        <p className="contacts-page__line">
          <span className="contacts-page__label">Почта:</span>{" "}
          <a href="mailto:sergey@lunyak.ru">sergey@lunyak.ru</a>
        </p>
        <p className="contacts-page__line">
          <span className="contacts-page__label">Телеграм:</span>{" "}
          <a href="https://t.me/dofamintheatre" target="_blank" rel="noopener noreferrer">
            @dofamintheatre
          </a>
        </p>
        <p className="contacts-page__line">
          <span className="contacts-page__label">ВКонтакте:</span>{" "}
          <a href={vkGroupUrl} target="_blank" rel="noopener noreferrer">
            vk.com/dofaminspb
          </a>
        </p>

        <hr className="contacts-page__divider" />

        <h2 className="contacts-page__subtitle">Как нас найти</h2>
        <p className="contacts-page__hint">
          Актуальный адрес и схема прохода — в нашей группе ВК:{" "}
          <a href={vkGroupUrl} target="_blank" rel="noopener noreferrer">
            vk.com/dofaminspb
          </a>
          .
        </p>

        <p className="contacts-page__hint">
          Видео «как добраться / как пройти»:{" "}
          <a href={vkHowToFindVideoUrl} target="_blank" rel="noopener noreferrer">
            открыть
          </a>
          .
        </p>
      </div>
    </div>
  );
};

export const Component = ContactsPage;
