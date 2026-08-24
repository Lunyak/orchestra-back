import cn from "classnames";
import { MotionConfig } from "motion/react";
import { useId, useState, type ChangeEvent, type ReactNode } from "react";
import { Link, useLocation } from "react-router-dom";
import {
  getTheaterNavMap,
  type TheaterNavNode,
} from "../model/theater-nav-map";
import {
  readImageFileAsDataUrl,
  readTheaterPoster,
  removeTheaterPoster,
  storeTheaterPoster,
} from "../model/theater-poster-storage";
import {
  MindmapExpandPresence,
  MindmapMotionItem,
  useMindmapBranchExpand,
  useMindmapStackLayout,
} from "../../project/ui/mindmap-expand";
import posterPlaceholderUrl from "../assets/org-poster-theaters.jpg";
import "../../project/ui/project-nav-mindmap.css";

type TheaterNavMindmapProps = {
  theaterId: string;
  rootLabel?: string;
};

function isPathActive(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(`${href}/`);
}

function nodeHasActiveDescendant(
  node: TheaterNavNode,
  pathname: string,
): boolean {
  if (node.href && isPathActive(pathname, node.href)) return true;
  return Boolean(
    node.children?.some((child) => nodeHasActiveDescendant(child, pathname)),
  );
}

function resolveMenuDrillNodes(
  branches: ReadonlyArray<TheaterNavNode>,
  drillStack: ReadonlyArray<TheaterNavNode>,
): ReadonlyArray<TheaterNavNode> {
  if (drillStack.length === 0) return branches;
  const current = drillStack[drillStack.length - 1];
  return current.children ?? [];
}

function PosterUploadIcon() {
  return (
    <svg
      className="project-nav-mindmap__poster-icon-svg"
      viewBox="0 0 24 24"
      aria-hidden="true"
    >
      <path
        d="M4 16l4.586-4.586a2 2 0 0 1 2.828 0L16 16m-2-2l1.586-1.586a2 2 0 0 1 2.828 0L20 14M14 8h.01M6 20h12a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2z"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="square"
      />
    </svg>
  );
}

function PosterRemoveIcon() {
  return (
    <svg
      className="project-nav-mindmap__poster-icon-svg"
      viewBox="0 0 24 24"
      aria-hidden="true"
    >
      <path
        d="M3 6h18M8 6V4h8v2M6 6v14a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2V6M10 11v6M14 11v6"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="square"
      />
    </svg>
  );
}

function MindmapPosterRoot({
  theaterId,
  rootLabel,
  href,
  pathname,
  stackLayout,
  menuOpen,
  onOpenMenu,
  menuContent,
}: {
  theaterId: string;
  rootLabel: string;
  href: string;
  pathname: string;
  stackLayout: boolean;
  menuOpen: boolean;
  onOpenMenu: () => void;
  menuContent: ReactNode;
}) {
  const inputId = useId();
  const [posterSrc, setPosterSrc] = useState(() =>
    readTheaterPoster(theaterId),
  );
  const [error, setError] = useState("");
  const isActive = isPathActive(pathname, href);
  const hasPoster = Boolean(posterSrc);
  const displaySrc = posterSrc ?? posterPlaceholderUrl;
  const uploadLabel = hasPoster ? "Заменить афишу" : "Вставить изображение";

  const handleFileChange = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;

    setError("");
    try {
      const dataUrl = await readImageFileAsDataUrl(file);
      storeTheaterPoster(theaterId, dataUrl);
      setPosterSrc(dataUrl);
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Не удалось загрузить афишу";
      setError(message);
    }
  };

  const handleRemove = () => {
    removeTheaterPoster(theaterId);
    setPosterSrc(null);
    setError("");
  };

  const posterImage = (
    <img
      className="project-nav-mindmap__poster-image"
      src={displaySrc}
      alt=""
    />
  );

  return (
    <div
      className={cn(
        "project-nav-mindmap__poster",
        isActive && "project-nav-mindmap__poster--active",
        hasPoster && "project-nav-mindmap__poster--filled",
        menuOpen && "project-nav-mindmap__poster--menu-open",
      )}
    >
      <p className="project-nav-mindmap__poster-name">{rootLabel}</p>
      <div className="project-nav-mindmap__poster-frame">
        {stackLayout ? (
          <button
            type="button"
            className={cn(
              "project-nav-mindmap__poster-link",
              "project-nav-mindmap__poster-link--tap",
              !hasPoster && "project-nav-mindmap__poster-link--placeholder",
            )}
            aria-expanded={menuOpen}
            aria-haspopup="tree"
            aria-label={`${rootLabel || "Обзор театра"}. Открыть меню навигации`}
            onClick={onOpenMenu}
          >
            {posterImage}
          </button>
        ) : (
          <Link
            to={href}
            className={cn(
              "project-nav-mindmap__poster-link",
              !hasPoster && "project-nav-mindmap__poster-link--placeholder",
            )}
            aria-current={isActive ? "page" : undefined}
            aria-label={rootLabel || "Обзор театра"}
          >
            {posterImage}
          </Link>
        )}

        <div
          className={cn(
            "project-nav-mindmap__poster-actions",
            stackLayout && "project-nav-mindmap__poster-actions--icons",
          )}
        >
          <label
            htmlFor={inputId}
            className={cn(
              "project-nav-mindmap__poster-action",
              stackLayout && "project-nav-mindmap__poster-icon-btn",
            )}
            aria-label={uploadLabel}
            title={uploadLabel}
          >
            {stackLayout ? (
              <PosterUploadIcon />
            ) : hasPoster ? (
              "Заменить"
            ) : (
              "Вставить изображение"
            )}
          </label>
          <input
            id={inputId}
            className="project-nav-mindmap__poster-input"
            type="file"
            accept="image/png,image/jpeg,image/webp,image/gif"
            onChange={(event) => {
              void handleFileChange(event);
            }}
          />
          {hasPoster ? (
            <button
              type="button"
              className={cn(
                "project-nav-mindmap__poster-action",
                stackLayout && "project-nav-mindmap__poster-icon-btn",
              )}
              aria-label="Убрать афишу"
              title="Убрать афишу"
              onClick={handleRemove}
            >
              {stackLayout ? <PosterRemoveIcon /> : "Убрать"}
            </button>
          ) : null}
        </div>

        {stackLayout && menuOpen ? menuContent : null}
      </div>
      {error ? (
        <p className="project-nav-mindmap__poster-error">{error}</p>
      ) : null}
    </div>
  );
}

function MobilePosterNavMenuList({
  nodes,
  pathname,
  onDrillIntoBranch,
  onSelectLink,
}: {
  nodes: ReadonlyArray<TheaterNavNode>;
  pathname: string;
  onDrillIntoBranch: (branch: TheaterNavNode) => void;
  onSelectLink: () => void;
}) {
  return (
    <ul className="project-nav-mindmap__poster-menu-tree project-nav-mindmap__poster-menu-tree--root">
      {nodes.map((node) => {
        const hasChildren = Boolean(node.children?.length);
        const isLit = nodeHasActiveDescendant(node, pathname);

        return (
          <li
            key={node.id}
            className={cn(
              "project-nav-mindmap__poster-menu-item",
              isLit && "project-nav-mindmap__poster-menu-item--lit",
            )}
          >
            {node.href ? (
              <Link
                to={node.href}
                className="project-nav-mindmap__poster-menu-link"
                onClick={onSelectLink}
              >
                {node.label}
              </Link>
            ) : hasChildren ? (
              <button
                type="button"
                className="project-nav-mindmap__poster-menu-drill"
                onClick={() => onDrillIntoBranch(node)}
              >
                <span className="project-nav-mindmap__poster-menu-drill-label">
                  {node.label}
                </span>
                <span
                  className="project-nav-mindmap__poster-menu-drill-arrow"
                  aria-hidden="true"
                >
                  →
                </span>
              </button>
            ) : (
              <span className="project-nav-mindmap__poster-menu-label">
                {node.label}
              </span>
            )}
          </li>
        );
      })}
    </ul>
  );
}

function MindmapNode({
  node,
  pathname,
  variant,
}: {
  node: TheaterNavNode;
  pathname: string;
  variant: "group" | "section" | "mode";
}) {
  const isExactActive = Boolean(
    node.href && isPathActive(pathname, node.href),
  );
  const isBranchLit =
    (variant === "group" || variant === "section") &&
    nodeHasActiveDescendant(node, pathname);
  const isLeafActive = variant === "mode" && isExactActive;
  const showAsCurrent = isLeafActive;

  const className = cn(
    "project-nav-mindmap__node",
    variant === "group" && "project-nav-mindmap__node--group",
    variant === "section" && "project-nav-mindmap__node--section",
    variant === "mode" && "project-nav-mindmap__node--mode",
    isBranchLit && "project-nav-mindmap__node--lit",
    isLeafActive && "project-nav-mindmap__node--active",
  );

  if (node.href) {
    return (
      <Link
        to={node.href}
        className={className}
        aria-current={showAsCurrent ? "page" : undefined}
      >
        {node.label}
      </Link>
    );
  }

  return <span className={className}>{node.label}</span>;
}

function MindmapBranch({
  node,
  pathname,
  depth,
  staggerIndex,
}: {
  node: TheaterNavNode;
  pathname: string;
  depth: number;
  staggerIndex: number;
}) {
  const isLit = nodeHasActiveDescendant(node, pathname);
  const hasChildren = Boolean(node.children?.length);
  const { isOpen, expandProps } = useMindmapBranchExpand(isLit, hasChildren);
  const isNested = depth > 0;
  const resolvedVariant = (() => {
    if (!node.href && hasChildren) {
      return depth === 0 ? "group" : "section";
    }
    if (hasChildren) return "group";
    return "mode";
  })();

  return (
    <MindmapMotionItem
      animated={isNested}
      staggerIndex={staggerIndex}
      className={cn(
        "project-nav-mindmap__item",
        depth === 0 && "project-nav-mindmap__branch",
        depth === 0 && !hasChildren && "project-nav-mindmap__branch--solo",
        depth > 0 && "project-nav-mindmap__leaf-item",
        isLit && "project-nav-mindmap__item--active",
        depth === 0 && isLit && "project-nav-mindmap__branch--active",
      )}
      {...expandProps}
    >
      <div className="project-nav-mindmap__cluster">
        <MindmapNode
          node={node}
          pathname={pathname}
          variant={resolvedVariant}
        />
        <MindmapExpandPresence open={hasChildren && isOpen}>
          {node.children?.length ? (
            <MindmapSubtree
              nodes={node.children}
              pathname={pathname}
              depth={depth + 1}
            />
          ) : null}
        </MindmapExpandPresence>
      </div>
    </MindmapMotionItem>
  );
}

function MindmapSubtree({
  nodes,
  pathname,
  depth,
}: {
  nodes: ReadonlyArray<TheaterNavNode>;
  pathname: string;
  depth: number;
}) {
  return (
    <ul
      className={cn(
        "project-nav-mindmap__level",
        depth === 0 && "project-nav-mindmap__branches",
        depth > 0 && "project-nav-mindmap__leaves",
      )}
    >
      {nodes.map((node, index) => (
        <MindmapBranch
          key={node.id}
          node={node}
          pathname={pathname}
          depth={depth}
          staggerIndex={index}
        />
      ))}
    </ul>
  );
}

export function TheaterNavMindmap({
  theaterId,
  rootLabel = "",
}: TheaterNavMindmapProps) {
  const { pathname } = useLocation();
  const navMap = getTheaterNavMap(theaterId, rootLabel);
  const rootHref = navMap.root.href ?? "";
  const stackLayout = useMindmapStackLayout();
  const [menuOpen, setMenuOpen] = useState(false);
  const [menuDrillStack, setMenuDrillStack] = useState<
    ReadonlyArray<TheaterNavNode>
  >([]);

  const menuNodes = resolveMenuDrillNodes(navMap.branches, menuDrillStack);
  const menuDrillCurrent =
    menuDrillStack.length > 0
      ? menuDrillStack[menuDrillStack.length - 1]
      : null;
  const menuTitle = menuDrillCurrent?.label ?? "Разделы театра";
  const menuIsDrilled = menuDrillStack.length > 0;

  const handleOpenMenu = () => {
    setMenuDrillStack([]);
    setMenuOpen(true);
  };

  const handleCloseMenu = () => {
    setMenuOpen(false);
    setMenuDrillStack([]);
  };

  const handleDrillIntoBranch = (branch: TheaterNavNode) => {
    setMenuDrillStack((current) => [...current, branch]);
  };

  const handleMenuBack = () => {
    setMenuDrillStack((current) => current.slice(0, -1));
  };

  const posterMenu = (
    <div
      className={cn(
        "project-nav-mindmap__poster-menu",
        menuIsDrilled && "project-nav-mindmap__poster-menu--drilled",
      )}
    >
      <div className="project-nav-mindmap__poster-menu-head">
        {menuIsDrilled ? (
          <button
            type="button"
            className="project-nav-mindmap__poster-menu-back"
            aria-label="Назад"
            onClick={handleMenuBack}
          >
            ←
          </button>
        ) : null}
        <p className="project-nav-mindmap__poster-menu-title">{menuTitle}</p>
      </div>
      <MobilePosterNavMenuList
        key={menuDrillStack.map((node) => node.id).join("/") || "root"}
        nodes={menuNodes}
        pathname={pathname}
        onDrillIntoBranch={handleDrillIntoBranch}
        onSelectLink={handleCloseMenu}
      />
      <div className="project-nav-mindmap__poster-menu-footer">
        {menuIsDrilled ? (
          <button
            type="button"
            className="project-nav-mindmap__poster-menu-reset"
            onClick={handleCloseMenu}
          >
            Сбросить
          </button>
        ) : null}
        <button
          type="button"
          className="project-nav-mindmap__poster-menu-close"
          onClick={handleCloseMenu}
        >
          Закрыть
        </button>
      </div>
    </div>
  );

  return (
    <MotionConfig reducedMotion="user">
      <nav
        className={cn(
          "project-nav-mindmap",
          stackLayout && "project-nav-mindmap--stack",
          menuOpen && "project-nav-mindmap--stack-menu-open",
          menuIsDrilled && "project-nav-mindmap--stack-drilled",
        )}
        aria-label="Карта разделов театра"
      >
        <div className="project-nav-mindmap__canvas">
          <div className="project-nav-mindmap__root-col">
            <MindmapPosterRoot
              key={theaterId}
              theaterId={theaterId}
              rootLabel={rootLabel}
              href={rootHref}
              pathname={pathname}
              stackLayout={stackLayout}
              menuOpen={menuOpen}
              onOpenMenu={handleOpenMenu}
              menuContent={posterMenu}
            />
          </div>
          {!stackLayout ? (
            <MindmapSubtree
              nodes={navMap.branches}
              pathname={pathname}
              depth={0}
            />
          ) : null}
        </div>
      </nav>
    </MotionConfig>
  );
}
