import cn from "classnames";
import { useId, useState, type ChangeEvent } from "react";
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

function MindmapPosterRoot({
  theaterId,
  rootLabel,
  href,
  pathname,
}: {
  theaterId: string;
  rootLabel: string;
  href: string;
  pathname: string;
}) {
  const inputId = useId();
  const [posterSrc, setPosterSrc] = useState(() =>
    readTheaterPoster(theaterId),
  );
  const [error, setError] = useState("");
  const isActive = isPathActive(pathname, href);
  const hasPoster = Boolean(posterSrc);
  const displaySrc = posterSrc ?? posterPlaceholderUrl;

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

  return (
    <div
      className={cn(
        "project-nav-mindmap__poster",
        isActive && "project-nav-mindmap__poster--active",
        hasPoster && "project-nav-mindmap__poster--filled",
      )}
    >
      <p className="project-nav-mindmap__poster-name">{rootLabel}</p>
      <div className="project-nav-mindmap__poster-frame">
        <Link
          to={href}
          className={cn(
            "project-nav-mindmap__poster-link",
            !hasPoster && "project-nav-mindmap__poster-link--placeholder",
          )}
          aria-current={isActive ? "page" : undefined}
          aria-label={rootLabel}
        >
          <img
            className="project-nav-mindmap__poster-image"
            src={displaySrc}
            alt=""
          />
        </Link>

        <div className="project-nav-mindmap__poster-actions">
          <label
            htmlFor={inputId}
            className="project-nav-mindmap__poster-action"
          >
            {hasPoster ? "Заменить" : "Вставить изображение"}
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
              className="project-nav-mindmap__poster-action"
              onClick={handleRemove}
            >
              Убрать
            </button>
          ) : null}
        </div>
      </div>
      {error ? (
        <p className="project-nav-mindmap__poster-error">{error}</p>
      ) : null}
    </div>
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
      {nodes.map((node) => {
        const isLit = nodeHasActiveDescendant(node, pathname);
        const hasChildren = Boolean(node.children?.length);
        const resolvedVariant = (() => {
          if (!node.href && hasChildren) {
            return depth === 0 ? "group" : "section";
          }
          if (hasChildren) return "group";
          return "mode";
        })();

        return (
          <li
            key={node.id}
            className={cn(
              "project-nav-mindmap__item",
              depth === 0 && "project-nav-mindmap__branch",
              depth === 0 && !hasChildren && "project-nav-mindmap__branch--solo",
              depth > 0 && "project-nav-mindmap__leaf-item",
              isLit && "project-nav-mindmap__item--active",
              depth === 0 && isLit && "project-nav-mindmap__branch--active",
            )}
          >
            <div className="project-nav-mindmap__cluster">
              <MindmapNode
                node={node}
                pathname={pathname}
                variant={resolvedVariant}
              />
              {node.children?.length ? (
                <MindmapSubtree
                  nodes={node.children}
                  pathname={pathname}
                  depth={depth + 1}
                />
              ) : null}
            </div>
          </li>
        );
      })}
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

  return (
    <nav className="project-nav-mindmap" aria-label="Карта разделов театра">
      <div className="project-nav-mindmap__canvas">
        <div className="project-nav-mindmap__root-col">
          <MindmapPosterRoot
            key={theaterId}
            theaterId={theaterId}
            rootLabel={rootLabel}
            href={rootHref}
            pathname={pathname}
          />
        </div>
        <MindmapSubtree
          nodes={navMap.branches}
          pathname={pathname}
          depth={0}
        />
      </div>
    </nav>
  );
}
