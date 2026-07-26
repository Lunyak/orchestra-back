import { Link } from "react-router-dom";
import { Seo } from "../../shared/component/Seo/Seo";
import { ROUTES } from "../../shared/model/routes";
import { GlitchHero } from "../HomePage/GlitchHero";
import "../../shared/styles/site-bands-page.css";

const VK_GROUP_URL = "https://vk.com/dofaminspb";
const VK_HOW_TO_FIND_VIDEO_URL = "https://vk.com/video-81928625_456239136";

type ContactRow = {
  key: string;
  title: string;
  meta: string;
  href: string;
  external?: boolean;
};

const CONTACT_ROWS: ContactRow[] = [
  {
    key: "mail",
    title: "Почта",
    meta: "sergey@lunyak.ru",
    href: "mailto:sergey@lunyak.ru",
  },
  {
    key: "telegram",
    title: "Телеграм",
    meta: "@dofamintheatre",
    href: "https://t.me/dofamintheatre",
    external: true,
  },
  {
    key: "vk",
    title: "ВКонтакте",
    meta: "vk.com/dofaminspb",
    href: VK_GROUP_URL,
    external: true,
  },
  {
    key: "find",
    title: "Как нас найти",
    meta: "видео и схема в VK",
    href: VK_HOW_TO_FIND_VIDEO_URL,
    external: true,
  },
];

const ContactsPage = () => {
  return (
    <div className="contacts-page site-bands-page">
      <div className="site-bands-page__grain" aria-hidden />
      <Seo
        title="Контакты — Театр «Дофамин»"
        description="Контакты театра «Дофамин»: почта, Telegram, ВКонтакте и как нас найти."
        canonicalPath="/контакты"
      />

      <Link to={ROUTES.HOME} className="site-bands-page__back">
        Назад
      </Link>

      <div className="site-bands-page__content">
        <header className="site-bands-page__hero">
          <GlitchHero
            as="h1"
            text="Контакты"
            className="home-page__glitch-hero--page"
          />
          <p className="site-bands-page__tagline">связь и как нас найти</p>
        </header>

        <div className="site-bands-list" role="list" aria-label="Контакты">
          {CONTACT_ROWS.map((row) => (
            <a
              key={row.key}
              className="site-bands-row"
              href={row.href}
              role="listitem"
              {...(row.external
                ? { target: "_blank", rel: "noopener noreferrer" }
                : {})}
            >
              <div className="site-bands-row__main">
                <span className="site-bands-row__title">{row.title}</span>
              </div>
              <span className="site-bands-row__meta">{row.meta}</span>
            </a>
          ))}
        </div>
      </div>
    </div>
  );
};

export const Component = ContactsPage;
