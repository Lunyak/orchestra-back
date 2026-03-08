import { Link } from "react-router-dom";
import { ROUTES } from "../../shared/model/routes";
import "./style.css";

const ContactsPage = () => {
  return (
    <div className="contacts-page">
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
          <a href="https://vk.com/dofaminspb" target="_blank" rel="noopener noreferrer">
            vk.com/dofaminspb
          </a>
        </p>
      </div>
    </div>
  );
};

export const Component = ContactsPage;
