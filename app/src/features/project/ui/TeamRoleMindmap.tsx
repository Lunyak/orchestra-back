import cn from "classnames";
import { Link } from "react-router-dom";
import { RolePlayingCard } from "../../role-card/RolePlayingCard";
import "./project-nav-mindmap.css";
import "./team-role-mindmap.css";

export type TeamRoleMindmapNode = {
  id: string;
  title: string;
  parentId: string | null;
  description?: string;
  avatarKey?: string | null;
  assignmentCount: number;
  href?: string;
};

type TeamRoleMindmapProps = {
  rootLabel: string;
  roles: ReadonlyArray<TeamRoleMindmapNode>;
  accessToken?: string | null;
  readonly?: boolean;
  onAddClick?: () => void;
  addLabel?: string;
};

function buildChildrenMap(roles: ReadonlyArray<TeamRoleMindmapNode>) {
  const byParent = new Map<string, TeamRoleMindmapNode[]>();
  for (const role of roles) {
    const key = role.parentId ?? "root";
    byParent.set(key, [...(byParent.get(key) ?? []), role]);
  }
  return byParent;
}

function RoleNode({
  role,
  accessToken,
  readonly,
}: {
  role: TeamRoleMindmapNode;
  accessToken?: string | null;
  readonly?: boolean;
}) {
  const card = (
    <RolePlayingCard
      role={{ title: role.title, avatarKey: role.avatarKey }}
      accessToken={accessToken}
      size="md"
      variant="plain"
      className="team-role-mindmap__card"
      title={
        role.assignmentCount > 0
          ? `${role.title} · ${role.assignmentCount}`
          : role.title
      }
    />
  );

  if (role.href && !readonly) {
    return (
      <Link
        to={role.href}
        className="team-role-mindmap__card-link"
        aria-label={role.title}
      >
        {card}
      </Link>
    );
  }

  return <div className="team-role-mindmap__card-wrap">{card}</div>;
}

function RoleSubtree({
  byParent,
  parentId,
  depth,
  accessToken,
  readonly,
}: {
  byParent: Map<string, TeamRoleMindmapNode[]>;
  parentId: string | null;
  depth: number;
  accessToken?: string | null;
  readonly?: boolean;
}) {
  const nodes = byParent.get(parentId ?? "root") ?? [];
  if (nodes.length === 0) return null;

  return (
    <ul
      className={cn(
        "project-nav-mindmap__level",
        depth === 0 && "project-nav-mindmap__branches",
        depth > 0 && "project-nav-mindmap__leaves",
      )}
    >
      {nodes.map((role) => {
        const children = byParent.get(role.id) ?? [];
        const hasChildren = children.length > 0;
        return (
          <li
            key={role.id}
            className={cn(
              "project-nav-mindmap__item",
              "team-role-mindmap__item",
              depth === 0 && "project-nav-mindmap__branch",
              depth === 0 && !hasChildren && "project-nav-mindmap__branch--solo",
              depth > 0 && "project-nav-mindmap__leaf-item",
            )}
          >
            <div className="project-nav-mindmap__cluster">
              <RoleNode
                role={role}
                accessToken={accessToken}
                readonly={readonly}
              />
              {hasChildren ? (
                <RoleSubtree
                  byParent={byParent}
                  parentId={role.id}
                  depth={depth + 1}
                  accessToken={accessToken}
                  readonly={readonly}
                />
              ) : null}
            </div>
          </li>
        );
      })}
    </ul>
  );
}

export function TeamRoleMindmap({
  rootLabel,
  roles,
  accessToken,
  readonly = false,
  onAddClick,
  addLabel = "Добавить должность",
}: TeamRoleMindmapProps) {
  const byParent = buildChildrenMap(roles);
  const hasRoles = roles.length > 0;
  const showAdd = Boolean(onAddClick) && !readonly;

  return (
    <nav className="project-nav-mindmap team-role-mindmap" aria-label={rootLabel}>
      <div className="project-nav-mindmap__canvas">
        <div className="project-nav-mindmap__root-col project-nav-mindmap__root-col--label">
          <span className="project-nav-mindmap__node project-nav-mindmap__node--group project-nav-mindmap__people-root">
            {rootLabel}
          </span>
        </div>
        {hasRoles ? (
          <RoleSubtree
            byParent={byParent}
            parentId={null}
            depth={0}
            accessToken={accessToken}
            readonly={readonly}
          />
        ) : null}
        {showAdd ? (
          <div className="team-role-mindmap__add-col">
            <button
              type="button"
              className="team-role-mindmap__add"
              onClick={onAddClick}
              aria-label={addLabel}
              title={addLabel}
            >
              <span className="team-role-mindmap__add-plus" aria-hidden>
                +
              </span>
            </button>
          </div>
        ) : null}
      </div>
    </nav>
  );
}
