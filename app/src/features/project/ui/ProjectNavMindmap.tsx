import cn from "classnames";
import { MotionConfig } from "motion/react";
import { useId, useState, type ChangeEvent, type ReactNode } from "react";
import { Link, useLocation } from "react-router-dom";
import {
  getProjectNavMap,
  type ProjectNavNode,
} from "../model/project-nav-map";
import {
  readImageFileAsDataUrl,
  readProjectPoster,
  removeProjectPoster,
  storeProjectPoster,
} from "../model/project-poster-storage";
import posterPlaceholderUrl from "../assets/project-poster-placeholder.png";
import {
  MindmapExpandPresence,
  MindmapMotionItem,
  useMindmapBranchExpand,
  useMindmapStackLayout,
} from "./mindmap-expand";
import "./project-nav-mindmap.css";

type ProjectNavMindmapProps = {
  projectSlug: string;
  rootLabel?: string;
};

function splitNavHref(href: string): { path: string; search: string } {
  const queryIndex = href.indexOf("?");
  if (queryIndex < 0) return { path: href, search: "" };
  return {
    path: href.slice(0, queryIndex),
    search: href.slice(queryIndex),
  };
}

function isPathActive(
  pathname: string,
  search: string,
  href: string,
  requireSearchMatch = false,
) {
  const { path, search: hrefSearch } = splitNavHref(href);
  const pathMatches =
    pathname === path || pathname.startsWith(`${path}/`);
  if (!pathMatches) return false;
  if (!hrefSearch) return true;
  if (!requireSearchMatch) return true;
  const hrefParams = new URLSearchParams(hrefSearch);
  const locationParams = new URLSearchParams(search);
  for (const [key, value] of hrefParams.entries()) {
    if (locationParams.get(key) !== value) return false;
  }
  return true;
}

function nodeHasActiveDescendant(
  node: ProjectNavNode,
  pathname: string,
  search: string,
): boolean {
  if (node.href && isPathActive(pathname, search, node.href)) return true;
  return Boolean(
    node.children?.some((child) =>
      nodeHasActiveDescendant(child, pathname, search),
    ),
  );
}

function resolveMenuDrillNodes(
  branches: ReadonlyArray<ProjectNavNode>,
  drillStack: ReadonlyArray<ProjectNavNode>,
): ReadonlyArray<ProjectNavNode> {
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
  projectSlug,
  rootLabel,
  href,
  pathname,
  search,
  stackLayout,
  menuOpen,
  onOpenMenu,
  menuContent,
}: {
  projectSlug: string;
  rootLabel: string;
  href: string;
  pathname: string;
  search: string;
  stackLayout: boolean;
  menuOpen: boolean;
  onOpenMenu: () => void;
  menuContent: ReactNode;
}) {
  const inputId = useId();
  const [posterSrc, setPosterSrc] = useState(() =>
    readProjectPoster(projectSlug),
  );
  const [error, setError] = useState("");
  const isActive = Boolean(href) && isPathActive(pathname, search, href, true);
  const hasPoster = Boolean(posterSrc);
  const displaySrc = posterSrc ?? posterPlaceholderUrl;
  const uploadLabel = hasPoster ? "Заменить афишу" : "Вставить афишу";

  const handleFileChange = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;

    setError("");
    try {
      const dataUrl = await readImageFileAsDataUrl(file);
      storeProjectPoster(projectSlug, dataUrl);
      setPosterSrc(dataUrl);
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Не удалось загрузить афишу";
      setError(message);
    }
  };

  const handleRemove = () => {
    removeProjectPoster(projectSlug);
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
            aria-label={`${rootLabel || "Обзор проекта"}. Открыть меню навигации`}
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
            aria-label={rootLabel || "Обзор проекта"}
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
            {stackLayout ? <PosterUploadIcon /> : hasPoster ? "Заменить" : "Вставить афишу"}
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
  search,
  onDrillIntoBranch,
  onSelectLink,
}: {
  nodes: ReadonlyArray<ProjectNavNode>;
  pathname: string;
  search: string;
  onDrillIntoBranch: (branch: ProjectNavNode) => void;
  onSelectLink: () => void;
}) {
  return (
    <ul className="project-nav-mindmap__poster-menu-tree project-nav-mindmap__poster-menu-tree--root">
      {nodes.map((node) => {
        const hasChildren = Boolean(node.children?.length);
        const isLit = nodeHasActiveDescendant(node, pathname, search);

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
  search,
  variant,
  shareHrefWithSibling = false,
}: {
  node: ProjectNavNode;
  pathname: string;
  search: string;
  variant: "group" | "section" | "mode";
  shareHrefWithSibling?: boolean;
}) {
  const isExactActive = Boolean(
    node.href && isPathActive(pathname, search, node.href, true),
  );
  const isBranchLit =
    (variant === "group" || variant === "section") &&
    nodeHasActiveDescendant(node, pathname, search);
  const isLeafActive =
    variant === "mode" && isExactActive && !shareHrefWithSibling;
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

function MindmapBranchHeader({
  node,
  pathname,
  search,
  variant,
  shareHrefWithSibling,
  hasChildren,
  isOpen,
  canToggle,
  onToggle,
}: {
  node: ProjectNavNode;
  pathname: string;
  search: string;
  variant: "group" | "section" | "mode";
  shareHrefWithSibling?: boolean;
  hasChildren: boolean;
  isOpen: boolean;
  canToggle: boolean;
  onToggle: () => void;
}) {
  const nodeElement = (
    <MindmapNode
      node={node}
      pathname={pathname}
      search={search}
      variant={variant}
      shareHrefWithSibling={shareHrefWithSibling}
    />
  );

  if (!canToggle || node.href) {
    return nodeElement;
  }

  return (
    <button
      type="button"
      className={cn(
        "project-nav-mindmap__branch-toggle",
        isOpen && "project-nav-mindmap__branch-toggle--open",
      )}
      aria-expanded={isOpen}
      onClick={onToggle}
    >
      {nodeElement}
      <span className="project-nav-mindmap__branch-chevron" aria-hidden="true" />
    </button>
  );
}

function MindmapBranch({
  node,
  pathname,
  search,
  depth,
  staggerIndex,
  siblingNodes,
  stackLayout,
  interactiveMobile,
  openBranchIds,
  onToggleBranch,
}: {
  node: ProjectNavNode;
  pathname: string;
  search: string;
  depth: number;
  staggerIndex: number;
  siblingNodes: ReadonlyArray<ProjectNavNode>;
  stackLayout: boolean;
  interactiveMobile: boolean;
  openBranchIds: ReadonlySet<string>;
  onToggleBranch: (branchId: string) => void;
}) {
  const isLit = nodeHasActiveDescendant(node, pathname, search);
  const hasChildren = Boolean(node.children?.length);
  const { isOpen: hoverOpen, expandProps } = useMindmapBranchExpand(
    isLit,
    hasChildren,
    false,
  );
  const mobileOpen =
    hasChildren && (isLit || openBranchIds.has(node.id));
  const isOpen = interactiveMobile ? mobileOpen : hoverOpen;
  const canMobileToggle =
    interactiveMobile && hasChildren && !node.href && !isLit;
  const isNested = depth > 0;
  const shareHrefWithSibling = Boolean(
    node.href &&
      siblingNodes.some(
        (other) => other.id !== node.id && other.href === node.href,
      ),
  );
  const resolvedVariant = (() => {
    if (!node.href && hasChildren) {
      return depth === 0 ? "group" : "section";
    }
    if (hasChildren) return "group";
    return "mode";
  })();

  return (
    <MindmapMotionItem
      animated={isNested && !interactiveMobile}
      staggerIndex={staggerIndex}
      className={cn(
        "project-nav-mindmap__item",
        depth === 0 && "project-nav-mindmap__branch",
        depth === 0 && !hasChildren && "project-nav-mindmap__branch--solo",
        depth > 0 && "project-nav-mindmap__leaf-item",
        isLit && "project-nav-mindmap__item--active",
        depth === 0 && isLit && "project-nav-mindmap__branch--active",
      )}
      {...(interactiveMobile ? {} : expandProps)}
    >
      <div className="project-nav-mindmap__cluster">
        <MindmapBranchHeader
          node={node}
          pathname={pathname}
          search={search}
          variant={resolvedVariant}
          shareHrefWithSibling={shareHrefWithSibling}
          hasChildren={hasChildren}
          isOpen={isOpen}
          canToggle={canMobileToggle}
          onToggle={() => onToggleBranch(node.id)}
        />
        <MindmapExpandPresence
          open={hasChildren && isOpen}
          stackLayout={interactiveMobile}
        >
          {node.children?.length ? (
            <MindmapSubtree
              nodes={node.children}
              pathname={pathname}
              search={search}
              depth={depth + 1}
              stackLayout={stackLayout}
              interactiveMobile={interactiveMobile}
              openBranchIds={openBranchIds}
              onToggleBranch={onToggleBranch}
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
  search,
  depth,
  stackLayout,
  interactiveMobile,
  openBranchIds,
  onToggleBranch,
}: {
  nodes: ReadonlyArray<ProjectNavNode>;
  pathname: string;
  search: string;
  depth: number;
  stackLayout: boolean;
  interactiveMobile: boolean;
  openBranchIds: ReadonlySet<string>;
  onToggleBranch: (branchId: string) => void;
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
          search={search}
          depth={depth}
          staggerIndex={index}
          siblingNodes={nodes}
          stackLayout={stackLayout}
          interactiveMobile={interactiveMobile}
          openBranchIds={openBranchIds}
          onToggleBranch={onToggleBranch}
        />
      ))}
    </ul>
  );
}

export function ProjectNavMindmap({
  projectSlug,
  rootLabel = "",
}: ProjectNavMindmapProps) {
  const { pathname, search } = useLocation();
  const navMap = getProjectNavMap(projectSlug, rootLabel);
  const rootHref = navMap.root.href ?? "";
  const stackLayout = useMindmapStackLayout();
  const [menuOpen, setMenuOpen] = useState(false);
  const [menuDrillStack, setMenuDrillStack] = useState<
    ReadonlyArray<ProjectNavNode>
  >([]);

  const menuNodes = resolveMenuDrillNodes(navMap.branches, menuDrillStack);
  const menuDrillCurrent =
    menuDrillStack.length > 0
      ? menuDrillStack[menuDrillStack.length - 1]
      : null;
  const menuTitle = menuDrillCurrent?.label ?? "Разделы проекта";
  const menuIsDrilled = menuDrillStack.length > 0;

  const handleOpenMenu = () => {
    setMenuDrillStack([]);
    setMenuOpen(true);
  };

  const handleCloseMenu = () => {
    setMenuOpen(false);
    setMenuDrillStack([]);
  };

  const handleDrillIntoBranch = (branch: ProjectNavNode) => {
    setMenuDrillStack((current) => [...current, branch]);
  };

  const handleMenuBack = () => {
    setMenuDrillStack((current) => current.slice(0, -1));
  };

  const handleSelectLink = () => {
    handleCloseMenu();
  };

  const handleMenuReset = () => {
    handleCloseMenu();
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
        search={search}
        onDrillIntoBranch={handleDrillIntoBranch}
        onSelectLink={handleSelectLink}
      />
      <div className="project-nav-mindmap__poster-menu-footer">
        {menuIsDrilled ? (
          <button
            type="button"
            className="project-nav-mindmap__poster-menu-reset"
            onClick={handleMenuReset}
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
        aria-label="Карта разделов проекта"
      >
        <div className="project-nav-mindmap__canvas">
          <div className="project-nav-mindmap__root-col">
            <MindmapPosterRoot
              key={projectSlug}
              projectSlug={projectSlug}
              rootLabel={rootLabel}
              href={rootHref}
              pathname={pathname}
              search={search}
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
              search={search}
              depth={0}
              stackLayout={false}
              interactiveMobile={false}
              openBranchIds={new Set()}
              onToggleBranch={() => undefined}
            />
          ) : null}
        </div>
      </nav>
    </MotionConfig>
  );
}
