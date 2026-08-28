import cn from "classnames";
import { MotionConfig } from "motion/react";
import {
  useEffect,
  useId,
  useState,
  type ChangeEvent,
  type ReactNode,
} from "react";
import { Link, useLocation } from "react-router-dom";
import { readImageFileAsDataUrl } from "../model/project-poster-storage";
import {
  MindmapExpandPresence,
  MindmapMotionItem,
  useMindmapBranchExpand,
  useMindmapStackLayout,
} from "./mindmap-expand";
import "./project-nav-mindmap.css";

export type NavMindmapNode = {
  id: string;
  label: string;
  href?: string;
  children?: ReadonlyArray<NavMindmapNode>;
};

export type NavMindmapMap = {
  root: NavMindmapNode;
  branches: ReadonlyArray<NavMindmapNode>;
};

export type NavMindmapPoster = {
  read: () => string | null;
  store: (dataUrl: string) => void;
  remove: () => void;
  placeholderUrl: string;
  remoteUrl?: string | null;
};

export type NavMindmapOnboarding = {
  highlightCover?: boolean;
  highlightMap?: boolean;
  highlightNavId?: string | null;
  forcedOpenBranchIds?: ReadonlyArray<string>;
  stackDrillIds?: ReadonlyArray<string>;
  posterAttr?: string;
  canvasAttr?: string;
};

export type NavMindmapProps = {
  navMap: NavMindmapMap;
  poster: NavMindmapPoster;
  posterKey: string;
  navAriaLabel: string;
  overviewAriaLabel: string;
  menuTitle: string;
  onboarding?: NavMindmapOnboarding;
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
  const pathMatches = pathname === path || pathname.startsWith(`${path}/`);
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
  node: NavMindmapNode,
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
  branches: ReadonlyArray<NavMindmapNode>,
  drillStack: ReadonlyArray<NavMindmapNode>,
): ReadonlyArray<NavMindmapNode> {
  if (drillStack.length === 0) return branches;
  const current = drillStack[drillStack.length - 1];
  return current.children ?? [];
}

function findNodePathByIds(
  branches: ReadonlyArray<NavMindmapNode>,
  ids: ReadonlyArray<string>,
): NavMindmapNode[] | null {
  const path: NavMindmapNode[] = [];
  let current = branches;
  for (const id of ids) {
    const node = current.find((item) => item.id === id);
    if (!node) return null;
    path.push(node);
    current = node.children ?? [];
  }
  return path;
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
  poster,
  href,
  pathname,
  search,
  stackLayout,
  menuContent,
  highlightCover,
  overviewAriaLabel,
  posterAttr,
}: {
  poster: NavMindmapPoster;
  href: string;
  pathname: string;
  search: string;
  stackLayout: boolean;
  menuContent: ReactNode;
  highlightCover: boolean;
  overviewAriaLabel: string;
  posterAttr?: string;
}) {
  const inputId = useId();
  const [posterSrc, setPosterSrc] = useState(() => poster.read());
  const [error, setError] = useState("");
  const isActive = Boolean(href) && isPathActive(pathname, search, href, true);
  const hasLocalPoster = Boolean(posterSrc);
  const hasPoster = Boolean(posterSrc || poster.remoteUrl);
  const displaySrc = posterSrc ?? poster.remoteUrl ?? poster.placeholderUrl;
  const uploadLabel = hasLocalPoster ? "Заменить афишу" : "Вставить афишу";

  const handleFileChange = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;

    setError("");
    try {
      const dataUrl = await readImageFileAsDataUrl(file);
      poster.store(dataUrl);
      setPosterSrc(dataUrl);
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Не удалось загрузить афишу";
      setError(message);
    }
  };

  const handleRemove = () => {
    poster.remove();
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
        highlightCover && "project-nav-mindmap__poster--onboarding",
      )}
    >
      <div
        className="project-nav-mindmap__poster-frame"
        data-project-nav={posterAttr}
      >
        {stackLayout ? (
          <div
            className={cn(
              "project-nav-mindmap__poster-link",
              !hasPoster && "project-nav-mindmap__poster-link--placeholder",
            )}
            aria-label={overviewAriaLabel}
          >
            {posterImage}
          </div>
        ) : (
          <Link
            to={href}
            className={cn(
              "project-nav-mindmap__poster-link",
              !hasPoster && "project-nav-mindmap__poster-link--placeholder",
            )}
            aria-current={isActive ? "page" : undefined}
            aria-label={overviewAriaLabel}
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
            ) : hasLocalPoster ? (
              "Заменить"
            ) : (
              "Вставить афишу"
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
          {hasLocalPoster ? (
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
      </div>
      {stackLayout ? menuContent : null}
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
  highlightNavId,
}: {
  nodes: ReadonlyArray<NavMindmapNode>;
  pathname: string;
  search: string;
  onDrillIntoBranch: (branch: NavMindmapNode) => void;
  onSelectLink: () => void;
  highlightNavId?: string | null;
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
                className={cn(
                  "project-nav-mindmap__poster-menu-link",
                  highlightNavId === node.id &&
                    "project-nav-mindmap__poster-menu-link--onboarding",
                )}
                data-project-nav-id={node.id}
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
  highlightNavId,
}: {
  node: NavMindmapNode;
  pathname: string;
  search: string;
  variant: "group" | "section" | "mode";
  shareHrefWithSibling?: boolean;
  highlightNavId?: string | null;
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
  const isOnboardingTarget = highlightNavId === node.id;

  const className = cn(
    "project-nav-mindmap__node",
    variant === "group" && "project-nav-mindmap__node--group",
    variant === "section" && "project-nav-mindmap__node--section",
    variant === "mode" && "project-nav-mindmap__node--mode",
    isBranchLit && "project-nav-mindmap__node--lit",
    isLeafActive && "project-nav-mindmap__node--active",
    isOnboardingTarget && "project-nav-mindmap__node--onboarding",
  );

  if (node.href) {
    return (
      <Link
        to={node.href}
        className={className}
        data-project-nav-id={node.id}
        aria-current={showAsCurrent ? "page" : undefined}
      >
        {node.label}
      </Link>
    );
  }

  return (
    <span className={className} data-project-nav-id={node.id}>
      {node.label}
    </span>
  );
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
  highlightNavId,
}: {
  node: NavMindmapNode;
  pathname: string;
  search: string;
  variant: "group" | "section" | "mode";
  shareHrefWithSibling?: boolean;
  hasChildren: boolean;
  isOpen: boolean;
  canToggle: boolean;
  onToggle: () => void;
  highlightNavId?: string | null;
}) {
  const nodeElement = (
    <MindmapNode
      node={node}
      pathname={pathname}
      search={search}
      variant={variant}
      shareHrefWithSibling={shareHrefWithSibling}
      highlightNavId={highlightNavId}
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
  forcedOpenBranchIds,
  highlightNavId,
}: {
  node: NavMindmapNode;
  pathname: string;
  search: string;
  depth: number;
  staggerIndex: number;
  siblingNodes: ReadonlyArray<NavMindmapNode>;
  stackLayout: boolean;
  interactiveMobile: boolean;
  openBranchIds: ReadonlySet<string>;
  onToggleBranch: (branchId: string) => void;
  forcedOpenBranchIds: ReadonlySet<string>;
  highlightNavId?: string | null;
}) {
  const isLit =
    nodeHasActiveDescendant(node, pathname, search) ||
    forcedOpenBranchIds.has(node.id);
  const hasChildren = Boolean(node.children?.length);
  const { isOpen: hoverOpen, expandProps } = useMindmapBranchExpand(
    isLit,
    hasChildren,
    false,
  );
  const mobileOpen = hasChildren && (isLit || openBranchIds.has(node.id));
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
          highlightNavId={highlightNavId}
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
              forcedOpenBranchIds={forcedOpenBranchIds}
              highlightNavId={highlightNavId}
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
  forcedOpenBranchIds,
  highlightNavId,
}: {
  nodes: ReadonlyArray<NavMindmapNode>;
  pathname: string;
  search: string;
  depth: number;
  stackLayout: boolean;
  interactiveMobile: boolean;
  openBranchIds: ReadonlySet<string>;
  onToggleBranch: (branchId: string) => void;
  forcedOpenBranchIds: ReadonlySet<string>;
  highlightNavId?: string | null;
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
          forcedOpenBranchIds={forcedOpenBranchIds}
          highlightNavId={highlightNavId}
        />
      ))}
    </ul>
  );
}

export function NavMindmap({
  navMap,
  poster,
  posterKey,
  navAriaLabel,
  overviewAriaLabel,
  menuTitle,
  onboarding,
}: NavMindmapProps) {
  const { pathname, search } = useLocation();
  const rootHref = navMap.root.href ?? "";
  const stackLayout = useMindmapStackLayout();
  const [menuDrillStack, setMenuDrillStack] = useState<
    ReadonlyArray<NavMindmapNode>
  >([]);
  const highlightCover = Boolean(onboarding?.highlightCover);
  const highlightMap = Boolean(onboarding?.highlightMap);
  const highlightNavId = onboarding?.highlightNavId ?? null;
  const forcedOpenBranchIds = new Set(onboarding?.forcedOpenBranchIds ?? []);
  const stackDrillIds = onboarding?.stackDrillIds;

  const menuNodes = resolveMenuDrillNodes(navMap.branches, menuDrillStack);
  const menuDrillCurrent =
    menuDrillStack.length > 0
      ? menuDrillStack[menuDrillStack.length - 1]
      : null;
  const resolvedMenuTitle = menuDrillCurrent?.label ?? menuTitle;
  const menuIsDrilled = menuDrillStack.length > 0;

  const handleDrillIntoBranch = (branch: NavMindmapNode) => {
    setMenuDrillStack((current) => [...current, branch]);
  };

  const handleMenuBack = () => {
    setMenuDrillStack((current) => current.slice(0, -1));
  };

  const handleSelectLink = () => {
    setMenuDrillStack([]);
  };

  const handleMenuReset = () => {
    setMenuDrillStack([]);
  };

  useEffect(() => {
    if (!stackLayout || !stackDrillIds?.length) return;
    const path = findNodePathByIds(navMap.branches, stackDrillIds);
    if (!path) return;
    setMenuDrillStack(path);
  }, [navMap.branches, stackDrillIds, stackLayout]);

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
        <p className="project-nav-mindmap__poster-menu-title">
          {resolvedMenuTitle}
        </p>
      </div>
      <MobilePosterNavMenuList
        key={menuDrillStack.map((node) => node.id).join("/") || "root"}
        nodes={menuNodes}
        pathname={pathname}
        search={search}
        onDrillIntoBranch={handleDrillIntoBranch}
        onSelectLink={handleSelectLink}
        highlightNavId={highlightNavId}
      />
      {menuIsDrilled ? (
        <div className="project-nav-mindmap__poster-menu-footer">
          <button
            type="button"
            className="project-nav-mindmap__poster-menu-reset"
            onClick={handleMenuReset}
          >
            К разделам
          </button>
        </div>
      ) : null}
    </div>
  );

  return (
    <MotionConfig reducedMotion="user">
      <nav
        className={cn(
          "project-nav-mindmap",
          stackLayout && "project-nav-mindmap--stack",
          menuIsDrilled && "project-nav-mindmap--stack-drilled",
          highlightMap && "project-nav-mindmap--onboarding-nav",
        )}
        aria-label={navAriaLabel}
      >
        <div
          className="project-nav-mindmap__canvas"
          data-project-nav={onboarding?.canvasAttr}
        >
          <div className="project-nav-mindmap__root-col">
            <MindmapPosterRoot
              key={posterKey}
              poster={poster}
              href={rootHref}
              pathname={pathname}
              search={search}
              stackLayout={stackLayout}
              menuContent={posterMenu}
              highlightCover={highlightCover}
              overviewAriaLabel={overviewAriaLabel}
              posterAttr={onboarding?.posterAttr}
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
              forcedOpenBranchIds={forcedOpenBranchIds}
              highlightNavId={highlightNavId}
            />
          ) : null}
        </div>
      </nav>
    </MotionConfig>
  );
}
