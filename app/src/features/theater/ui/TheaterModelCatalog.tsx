import { Bounds, PerspectiveCamera } from "@react-three/drei";
import { Canvas, useThree } from "@react-three/fiber";
import cn from "classnames";
import {
  Suspense,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type RefObject,
} from "react";
import { createPortal } from "react-dom";
import {
  THEATER_MODEL_CATALOG_CATEGORIES,
  countTheaterModelCatalogCategories,
  filterTheaterModelCatalog,
  type TheaterModelCatalogCategoryId,
} from "../model/theater-model-catalog";
import { writeTheaterBuiltinTemplateDrag } from "../model/theater-builtin-template-dnd";
import {
  createBuiltinTheaterModel,
  type TheaterBuiltinTemplate,
  type TheaterBuiltinTemplateKey,
} from "../model/theater-model-builtin";
import { BuiltinModel } from "./three/BuiltinModel";
import "./theater-model-catalog.css";

type TheaterModelCatalogProps = {
  anchorRef: RefObject<HTMLDivElement | null>;
  categoriesOpen: boolean;
  value: TheaterBuiltinTemplateKey | undefined;
  onChange: (key: TheaterBuiltinTemplateKey) => void;
  onClose: () => void;
  onAdd?: () => void;
  onAddFile?: () => void;
  addDisabled?: boolean;
  dragEnabled?: boolean;
};

function PreviewSettle() {
  const invalidate = useThree((state) => state.invalidate);

  useEffect(() => {
    const started = performance.now();
    let frame = 0;
    const tick = () => {
      invalidate();
      if (performance.now() - started < 1600) {
        frame = requestAnimationFrame(tick);
      }
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [invalidate]);

  return null;
}

function CatalogThumbScene({ builtin }: { builtin: TheaterBuiltinTemplateKey }) {
  const previewModel = useMemo(() => {
    const model = createBuiltinTheaterModel(1, builtin);
    return { ...model, modelLowDetail: true };
  }, [builtin]);

  return (
    <>
      <PreviewSettle />
      <color attach="background" args={["#171717"]} />
      <ambientLight intensity={1.35} />
      <directionalLight position={[3, 5, 4]} intensity={2.1} />
      <PerspectiveCamera makeDefault position={[2.8, 2.2, 3.6]} fov={35} />
      <Suspense fallback={null}>
        <Bounds fit clip observe margin={1.35}>
          <BuiltinModel projectName="" model={previewModel} />
        </Bounds>
      </Suspense>
    </>
  );
}

function CatalogCard({
  item,
  selected,
  dragEnabled,
  scrollRoot,
  onChange,
}: {
  item: TheaterBuiltinTemplate;
  selected: boolean;
  dragEnabled: boolean;
  scrollRoot: RefObject<HTMLDivElement | null>;
  onChange: (key: TheaterBuiltinTemplateKey) => void;
}) {
  const cardRef = useRef<HTMLButtonElement>(null);
  const [inView, setInView] = useState(false);

  useEffect(() => {
    const card = cardRef.current;
    if (!card) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        setInView(entry?.isIntersecting === true);
      },
      { root: scrollRoot.current, rootMargin: "80px 0px", threshold: 0.01 },
    );
    observer.observe(card);
    return () => observer.disconnect();
  }, [scrollRoot]);

  return (
    <button
      ref={cardRef}
      type="button"
      role="option"
      aria-selected={selected}
      title={item.label}
      draggable={dragEnabled}
      className={cn(
        "theater-model-catalog__card",
        selected && "theater-model-catalog__card--active",
        dragEnabled && "theater-model-catalog__card--draggable",
      )}
      onClick={() => onChange(item.key)}
      onDragStart={(event) => {
        if (!dragEnabled) return;
        onChange(item.key);
        writeTheaterBuiltinTemplateDrag(event.dataTransfer, item.key);
      }}
    >
      <div className="theater-model-catalog__thumb">
        {inView ? (
          <Canvas
            className="theater-model-catalog__live"
            dpr={1}
            frameloop="demand"
            gl={{ alpha: true, antialias: true, premultipliedAlpha: false }}
          >
            <CatalogThumbScene builtin={item.key} />
          </Canvas>
        ) : (
          <span className="theater-model-catalog__thumb-label">{item.label}</span>
        )}
      </div>
      <span className="theater-model-catalog__name">{item.label}</span>
    </button>
  );
}

function placeCatalogAside(anchor: HTMLElement, aside: HTMLElement) {
  const rect = anchor.getBoundingClientRect();
  aside.style.top = `${rect.top}px`;
  aside.style.height = `${rect.height}px`;
  aside.style.right = `${window.innerWidth - rect.left}px`;
}

export function TheaterModelCatalog({
  anchorRef,
  categoriesOpen,
  value,
  onChange,
  onClose,
  onAdd,
  onAddFile,
  addDisabled = false,
  dragEnabled = true,
}: TheaterModelCatalogProps) {
  const [filter, setFilter] = useState("");
  const [category, setCategory] = useState<TheaterModelCatalogCategoryId>("all");
  const gridRef = useRef<HTMLDivElement>(null);
  const onCloseRef = useRef(onClose);
  const asideRef = useRef<HTMLDivElement>(null);
  onCloseRef.current = onClose;

  const counts = countTheaterModelCatalogCategories(filter);
  const items = filterTheaterModelCatalog(filter, category);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      event.preventDefault();
      event.stopImmediatePropagation();
      onCloseRef.current();
    };
    window.addEventListener("keydown", onKeyDown, true);
    return () => window.removeEventListener("keydown", onKeyDown, true);
  }, []);

  useLayoutEffect(() => {
    const anchor = anchorRef.current;
    const aside = asideRef.current;
    if (!anchor || !aside) return;
    const place = () => placeCatalogAside(anchor, aside);
    place();
    const observer = new ResizeObserver(place);
    observer.observe(anchor);
    window.addEventListener("resize", place);
    window.addEventListener("scroll", place, true);
    return () => {
      observer.disconnect();
      window.removeEventListener("resize", place);
      window.removeEventListener("scroll", place, true);
    };
  }, [anchorRef, categoriesOpen]);

  const aside = (
    <div
      ref={asideRef}
      className="theater-model-catalog__aside"
      role="group"
      aria-label="Категории моделей"
    >
      <div className="theater-model-catalog__nav">
        {THEATER_MODEL_CATALOG_CATEGORIES.map((item) => {
          const active = category === item.id;
          return (
            <button
              key={item.id}
              type="button"
              aria-pressed={active}
              className={cn(
                "theater-model-catalog__category",
                active && "theater-model-catalog__category--active",
              )}
              onClick={() => setCategory(item.id)}
            >
              <span>{item.label}</span>
              <span className="theater-model-catalog__count">{counts[item.id]}</span>
            </button>
          );
        })}
      </div>
      <div className="theater-model-catalog__actions">
        {onAdd ? (
          <button
            type="button"
            className="theater-model-catalog__action"
            onClick={onAdd}
            disabled={addDisabled}
          >
            Добавить
          </button>
        ) : null}
        {onAddFile ? (
          <button
            type="button"
            className="theater-model-catalog__action"
            onClick={onAddFile}
            disabled={addDisabled}
          >
            Из файла
          </button>
        ) : null}
        <button
          type="button"
          className={cn(
            "theater-model-catalog__action",
            "theater-model-catalog__action--close",
          )}
          onClick={onClose}
        >
          Закрыть
        </button>
      </div>
    </div>
  );

  return (
    <div className="theater-model-catalog">
      {categoriesOpen ? createPortal(aside, document.body) : null}
      <input
        type="search"
        className="theater-builtin-template-filter native-text-input"
        placeholder="Поиск…"
        value={filter}
        onChange={(event) => setFilter(event.target.value)}
      />
      <div className="theater-model-catalog__stage">
        <div
          ref={gridRef}
          className="theater-model-catalog__grid"
          role="listbox"
          aria-label="Модели"
        >
          {items.length === 0 ? (
            <p className="theater-model-catalog__empty">Ничего не найдено</p>
          ) : (
            items.map((item) => (
              <CatalogCard
                key={item.key}
                item={item}
                selected={value === item.key}
                dragEnabled={dragEnabled}
                scrollRoot={gridRef}
                onChange={onChange}
              />
            ))
          )}
        </div>
      </div>
    </div>
  );
}
