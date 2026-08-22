import { FC } from "react";
import { ChalkPageShell } from "../../shared/component/ChalkPageShell/ChalkPageShell";
import { Seo } from "../../shared/component/Seo/Seo";
import "./style.css";

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

const ContactsPage: FC = () => {
  return (
    <ChalkPageShell mainClassName="chalk-page__main--contacts" scrollable showHomeBack>
      <Seo
        title="Контакты — Театр «Дофамин»"
        description="Контакты театра «Дофамин»: почта, Telegram, ВКонтакте и как нас найти."
        canonicalPath="/контакты"
      />

      <h1 className="chalk-page__title">КОНТАКТЫ</h1>
      <p className="chalk-page__subtitle">связь и как нас найти</p>
      <div className="chalk-page__rule" aria-hidden />

      <div className="chalk-contacts__list" role="list" aria-label="Контакты">
        {CONTACT_ROWS.map((row) => (
          <a
            key={row.key}
            className="chalk-contacts__row"
            href={row.href}
            role="listitem"
            aria-label={`${row.title}: ${row.meta}`}
            {...(row.external ? { target: "_blank", rel: "noopener noreferrer" } : {})}
          >
            <span className="chalk-contacts__title">{row.title}</span>
            <span className="chalk-contacts__meta">{row.meta}</span>
          </a>
        ))}
      </div>
    </ChalkPageShell>
  );
};

export const Component = ContactsPage;
