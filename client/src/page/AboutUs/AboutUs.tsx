import { FC, useEffect, useRef, useState, type TouchEvent } from "react";
import { ChalkPageShell } from "../../shared/component/ChalkPageShell/ChalkPageShell";
import { Seo } from "../../shared/component/Seo/Seo";
import { siteAsset } from "../../shared/model/siteAssets";
import "./style.css";

type TeamMember = {
  id: number;
  name: string;
  img: string;
  role: "актер" | "актриса" | "худ. рук";
};

type ExpandedPhoto = {
  index: number;
};

const items: TeamMember[] = [
  { id: 1, name: "Анастасия Рябых", img: "/actors/nastya.JPG", role: "актриса" },
  { id: 2, name: "Виктория Юркова", img: "/actors/vica-2.JPG", role: "актриса" },
  { id: 3, name: "Алексей Филатов", img: "/actors/lesha.jpg", role: "актер" },
  { id: 4, name: "Антон Васильев", img: "/actors/anton.jpg", role: "актер" },
  { id: 5, name: "Ксения", img: "/actors/ksysha-2.JPG", role: "актриса" },
  { id: 6, name: "Григорий Найдёнов", img: "/actors/grisha.jpg", role: "актер" },
  { id: 7, name: "Алена Паршина", img: "/actors/alena.JPG", role: "актриса" },
  { id: 8, name: "Екатерина Слыххановская", img: "/actors/katya.JPG", role: "актриса" },
  { id: 9, name: "Полина Смолкина", img: "/actors/polina.jpg", role: "актриса" },
  { id: 10, name: "Вероника Атушева", img: "/actors/nika.JPG", role: "актриса" },
  { id: 11, name: "Сергей Луняка", img: "/actors/ya.JPG", role: "худ. рук" },
  { id: 12, name: "Лера Буракова", img: "/actors/lera.jpg", role: "актриса" },
];

const AboutUs: FC = () => {
  const [expandedPhoto, setExpandedPhoto] = useState<ExpandedPhoto | null>(null);

  return (
    <ChalkPageShell mainClassName="chalk-page__main--team" scrollable showHomeBack>
      <Seo
        title="Команда — Театр «Дофамин»"
        description="Актёры и команда театра «Дофамин»."
        canonicalPath="/команда"
      />

      <h1 className="chalk-page__title">КОМАНДА</h1>
      <p className="chalk-page__subtitle">актеры и худ. рук</p>
      <div className="chalk-page__rule" aria-hidden />

      <div className="chalk-team__list" role="list" aria-label="Команда">
        {items.map((member, index) => (
          <TeamRow
            key={member.id}
            name={member.name}
            img={member.img}
            role={member.role}
            onPhotoClick={() => setExpandedPhoto({ index })}
          />
        ))}
      </div>

      {expandedPhoto !== null && (
        <TeamPhotoLightbox
          members={items}
          index={expandedPhoto.index}
          onIndexChange={(nextIndex) => setExpandedPhoto({ index: nextIndex })}
          onClose={() => setExpandedPhoto(null)}
        />
      )}
    </ChalkPageShell>
  );
};

export const Component = AboutUs;

function TeamRow({
  name,
  img,
  role,
  onPhotoClick,
}: {
  name: string;
  img: string;
  role: TeamMember["role"];
  onPhotoClick: () => void;
}) {
  const [isLoaded, setIsLoaded] = useState(false);
  const title = name.trim();

  return (
    <div className="chalk-team__row" role="listitem" aria-label={`${title}, ${role}`}>
      <div className="chalk-team__main">
        <button
          type="button"
          className="chalk-team__avatar-btn"
          onClick={onPhotoClick}
          disabled={!isLoaded}
          aria-label={`Увеличить фото: ${title}`}
        >
          <span className="chalk-team__avatar-wrap">
            {!isLoaded && <span className="chalk-team__avatar-ph" aria-hidden />}
            <img
              className="chalk-team__avatar"
              data-loading={isLoaded ? undefined : "true"}
              src={siteAsset(img)}
              alt=""
              loading="lazy"
              decoding="async"
              onLoad={() => setIsLoaded(true)}
              onError={() => setIsLoaded(true)}
            />
          </span>
        </button>
        <span className="chalk-team__name">{title}</span>
      </div>
      <span className="chalk-team__role">{role}</span>
    </div>
  );
}

function TeamPhotoLightbox({
  members,
  index,
  onIndexChange,
  onClose,
}: {
  members: TeamMember[];
  index: number;
  onIndexChange: (index: number) => void;
  onClose: () => void;
}) {
  const member = members[index];
  const name = member.name.trim();
  const role = member.role;
  const src = siteAsset(member.img);
  const hasPrev = index > 0;
  const hasNext = index < members.length - 1;
  const touchStartXRef = useRef<number | null>(null);

  const goPrev = () => {
    if (hasPrev) onIndexChange(index - 1);
  };

  const goNext = () => {
    if (hasNext) onIndexChange(index + 1);
  };

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
        return;
      }
      if (event.key === "ArrowLeft" && index > 0) {
        onIndexChange(index - 1);
        return;
      }
      if (event.key === "ArrowRight" && index < members.length - 1) {
        onIndexChange(index + 1);
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [index, members.length, onClose, onIndexChange]);

  const onTouchStart = (event: TouchEvent) => {
    touchStartXRef.current = event.touches[0]?.clientX ?? null;
  };

  const onTouchEnd = (event: TouchEvent) => {
    const startX = touchStartXRef.current;
    if (startX === null) return;

    const endX = event.changedTouches[0]?.clientX ?? startX;
    const deltaX = endX - startX;
    const swipeThreshold = 48;

    if (deltaX > swipeThreshold && index > 0) onIndexChange(index - 1);
    if (deltaX < -swipeThreshold && index < members.length - 1) onIndexChange(index + 1);

    touchStartXRef.current = null;
  };

  return (
    <div
      className="chalk-team-lightbox"
      role="dialog"
      aria-modal="true"
      aria-label={`Фото: ${name}`}
    >
      <button
        type="button"
        className="chalk-team-lightbox__backdrop"
        onClick={onClose}
        aria-label="Закрыть"
      />

      {hasPrev && (
        <button
          type="button"
          className="chalk-team-lightbox__nav chalk-team-lightbox__nav--prev"
          onClick={goPrev}
          aria-label="Предыдущий актёр"
        >
          <span className="chalk-team-lightbox__nav-mark" aria-hidden>←</span>
        </button>
      )}

      {hasNext && (
        <button
          type="button"
          className="chalk-team-lightbox__nav chalk-team-lightbox__nav--next"
          onClick={goNext}
          aria-label="Следующий актёр"
        >
          <span className="chalk-team-lightbox__nav-mark" aria-hidden>→</span>
        </button>
      )}

      <figure
        className="chalk-team-lightbox__figure"
        onTouchStart={onTouchStart}
        onTouchEnd={onTouchEnd}
      >
        <img className="chalk-team-lightbox__img" src={src} alt={name} key={member.id} />
        <figcaption className="chalk-team-lightbox__caption">
          <span className="chalk-team-lightbox__caption-name">{name}</span>
          <span className="chalk-team-lightbox__caption-role">{role}</span>
        </figcaption>
      </figure>
    </div>
  );
}
