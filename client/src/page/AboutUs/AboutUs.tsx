import { FC, useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useLocation } from "react-router-dom";
import { ChalkPageShell } from "../../shared/component/ChalkPageShell/ChalkPageShell";
import { useChalkFlipFace } from "../../shared/component/ChalkBoardFlip/chalk-flip-context";
import { Seo } from "../../shared/component/Seo/Seo";
import { cn } from "../../shared/lib/cn";
import { siteAsset } from "../../shared/model/siteAssets";
import "./style.css";

type TeamMember = {
  id: number;
  name: string;
  img: string;
  role: "актер" | "актриса" | "худ. рук";
  note: string;
};

const items: TeamMember[] = [
  { id: 1, name: "Анастасия Рябых", img: "/actors/nastya.JPG", role: "актриса", note: "Актриса театра «Дофамин»." },
  { id: 2, name: "Виктория Юркова", img: "/actors/vica-2.JPG", role: "актриса", note: "Актриса театра «Дофамин»." },
  { id: 3, name: "Алексей Филатов", img: "/actors/lesha.jpg", role: "актер", note: "Актёр театра «Дофамин»." },
  { id: 4, name: "Антон Васильев", img: "/actors/anton.jpg", role: "актер", note: "Актёр театра «Дофамин»." },
  { id: 5, name: "Ксения", img: "/actors/ksysha-2.JPG", role: "актриса", note: "Актриса театра «Дофамин»." },
  { id: 6, name: "Григорий Найдёнов", img: "/actors/grisha.jpg", role: "актер", note: "Актёр театра «Дофамин»." },
  { id: 7, name: "Алена Паршина", img: "/actors/alena.JPG", role: "актриса", note: "Актриса театра «Дофамин»." },
  { id: 8, name: "Екатерина Слыховская", img: "/actors/katya.JPG", role: "актриса", note: "Актриса театра «Дофамин»." },
  { id: 9, name: "Полина Смолкина", img: "/actors/polina.jpg", role: "актриса", note: "Актриса театра «Дофамин»." },
  { id: 10, name: "Вероника Атушева", img: "/actors/nika.JPG", role: "актриса", note: "Актриса театра «Дофамин»." },
  { id: 11, name: "Сергей Луняка", img: "/actors/ya.JPG", role: "худ. рук", note: "Художественный руководитель театра «Дофамин»." },
  { id: 12, name: "Лера Буракова", img: "/actors/lera.jpg", role: "актриса", note: "Актриса театра «Дофамин»." },
];

const AboutUs: FC = () => {
  const { pathname } = useLocation();
  const showSeo = pathname === "/команда" || pathname === "/aboutus";
  const flip = useChalkFlipFace();
  const [selectedIndex, setSelectedIndex] = useState(0);

  const moveSelection = (key: string) => {
    setSelectedIndex((current) => {
      if ((key === "ArrowUp" || key === "ArrowLeft") && current > 0) return current - 1;
      if ((key === "ArrowDown" || key === "ArrowRight") && current + 1 < items.length) return current + 1;
      return current;
    });
  };

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (!event.key.startsWith("Arrow")) return;
      event.preventDefault();
      moveSelection(event.key);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  return (
    <ChalkPageShell mainClassName="chalk-page__main--team" showHomeBack showSectionNav={false}>
      {showSeo && (
      <Seo
        title="Команда — Театр «Дофамин»"
        description="Актёры и команда театра «Дофамин»."
        canonicalPath="/команда"
      />
      )}

      <h1 className="chalk-page__title">КОМАНДА</h1>
      <div className="chalk-page__rule" aria-hidden />

      <TeamFocus member={items[selectedIndex]} />

      {!flip.turning && (
        <TeamSideIcons
          members={items}
          selectedIndex={selectedIndex}
          onSelect={setSelectedIndex}
        />
      )}
    </ChalkPageShell>
  );
};

export const Component = AboutUs;

function TeamTile({
  name,
  img,
  role,
  active,
  onSelect,
}: {
  name: string;
  img: string;
  role: TeamMember["role"];
  active: boolean;
  onSelect: () => void;
}) {
  const title = name.trim();

  return (
    <button
      type="button"
      className={cn("chalk-team-tile", active && "chalk-team-tile--active")}
      role="listitem"
      aria-label={`${title}, ${role}`}
      aria-current={active ? "true" : undefined}
      onClick={onSelect}
    >
      <img className="chalk-team-tile__img" src={siteAsset(img)} alt="" />
    </button>
  );
}

function TeamFocus({ member }: { member: TeamMember }) {
  const name = member.name.trim();
  const nameRef = useFitName(name);

  return (
    <div className="chalk-team-focus">
      <div className="chalk-team-focus__photo">
        <img className="chalk-team-focus__img" src={siteAsset(member.img)} alt={name} />
      </div>
      <div className="chalk-team-focus__note">
        <p className="chalk-team-focus__kicker">{member.role}</p>
        <h2 className="chalk-team-focus__name" ref={nameRef}>
          <TeamName name={name} />
        </h2>
        <div className="chalk-page__rule" aria-hidden />
        <p className="chalk-team-focus__text">{member.note}</p>
      </div>
    </div>
  );
}

function useFitName(name: string) {
  const ref = useRef<HTMLHeadingElement>(null);

  useLayoutEffect(() => {
    const node = ref.current;
    if (!node) return;

    const fit = () => fitNameToWidth(node);
    fit();
    const observer = new ResizeObserver(fit);
    const box = node.parentElement ?? node;
    observer.observe(box);
    return () => observer.disconnect();
  }, [name]);

  return ref;
}

function fitNameToWidth(name: HTMLElement) {
  const surname = name.querySelector(".chalk-team-focus__surname");
  const line = surname instanceof HTMLElement ? surname : name;
  name.style.fontSize = "";
  let size = Number.parseFloat(getComputedStyle(name).fontSize);
  const fits = () => line.scrollWidth <= name.clientWidth + 1;

  while (size > 14 && !fits()) {
    size -= 0.5;
    name.style.fontSize = `${size}px`;
  }
}

function TeamName({ name }: { name: string }) {
  const parts = name.trim().split(/\s+/);
  const surname = parts.length > 1 ? parts[parts.length - 1] : "";
  const given = parts.length > 1 ? parts.slice(0, -1).join(" ") : name;

  return (
    <>
      {given}
      {surname && (
        <>
          <br />
          <span className="chalk-team-focus__surname">{surname}</span>
        </>
      )}
    </>
  );
}

function TeamSideIcons({
  members,
  selectedIndex,
  onSelect,
}: {
  members: TeamMember[];
  selectedIndex: number;
  onSelect: (index: number) => void;
}) {
  const listRef = useRef<HTMLDivElement>(null);
  const [horizontal, setHorizontal] = useState(
    () => window.matchMedia("(max-width: 899px)").matches,
  );
  const [canUp, setCanUp] = useState(false);
  const [canDown, setCanDown] = useState(false);

  const syncArrows = () => {
    const list = listRef.current;
    if (!list) return;
    const along = horizontal ? list.scrollLeft : list.scrollTop;
    const view = horizontal ? list.clientWidth : list.clientHeight;
    const full = horizontal ? list.scrollWidth : list.scrollHeight;
    setCanUp(along > 1);
    setCanDown(along + view < full - 1);
  };

  useEffect(() => {
    const query = window.matchMedia("(max-width: 899px)");
    const onChange = () => setHorizontal(query.matches);
    query.addEventListener("change", onChange);
    return () => query.removeEventListener("change", onChange);
  }, []);

  useEffect(() => {
    const list = listRef.current;
    const selected = list?.querySelector(".chalk-team-tile--active");
    if (selected instanceof HTMLElement) {
      selected.scrollIntoView({ block: "nearest", inline: "nearest" });
    }
    syncArrows();
    window.addEventListener("resize", syncArrows);
    return () => window.removeEventListener("resize", syncArrows);
  }, [selectedIndex, members.length, horizontal]);

  const scrollByTile = (direction: -1 | 1) => {
    const distance = direction * 50;
    if (horizontal) {
      listRef.current?.scrollBy({ left: distance, behavior: "smooth" });
      return;
    }
    listRef.current?.scrollBy({ top: distance, behavior: "smooth" });
  };

  return createPortal(
    <div className="chalk-team-sides">
      <div className="chalk-team-sides__col">
        {canUp && (
          <button
            type="button"
            className="chalk-team-sides__arrow"
            onClick={() => scrollByTile(-1)}
            aria-label={horizontal ? "Участники левее" : "Участники выше"}
          >
            {horizontal ? "←" : "↑"}
          </button>
        )}
        <div className="chalk-team-sides__list" role="list" ref={listRef} onScroll={syncArrows}>
          {members.map((member, index) => (
            <TeamTile
              key={member.id}
              name={member.name}
              img={member.img}
              role={member.role}
              active={selectedIndex === index}
              onSelect={() => onSelect(index)}
            />
          ))}
        </div>
        {canDown && (
          <button
            type="button"
            className="chalk-team-sides__arrow"
            onClick={() => scrollByTile(1)}
            aria-label={horizontal ? "Участники правее" : "Участники ниже"}
          >
            {horizontal ? "→" : "↓"}
          </button>
        )}
      </div>
    </div>,
    document.body
  );
}
