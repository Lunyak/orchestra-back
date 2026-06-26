import cn from "classnames";

type TocItem = { level: number; title: string; offset: number };

type ShowScriptMarkdownTocProps = {
  items: TocItem[];
  onJump: (offset: number) => void;
};

export function ShowScriptMarkdownToc({ items, onJump }: ShowScriptMarkdownTocProps) {
  return (
    <div className="script-markdown-toc" aria-label="Картины">
      <div className="script-markdown-toc__title">Картины</div>
      {items.length ? (
        <div className="script-markdown-toc__list">
          {items.map((it, idx) => (
            <button
              key={`${it.offset}-${idx}`}
              type="button"
              className={cn("script-markdown-toc__item")}
              data-level={String(it.level)}
              title={it.title}
              onClick={() => onJump(it.offset)}
            >
              {it.title}
            </button>
          ))}
        </div>
      ) : (
        <div className="script-markdown-toc__empty">Добавь заголовок `### ...`</div>
      )}
    </div>
  );
}
