import { Button } from "@shared/core/button/Button";
import cn from "classnames";
import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useAuth } from "../../features/auth";
import { RehearsalsCard } from "../../features/rehearsals-card/RehearsalsCard";
import { studioRoleLabel, useGetStudioQuery } from "../../features/studio";
import { StudioAssignmentsPanel } from "./StudioAssignmentsPanel";
import { StudioInvitePanel } from "./StudioInvitePanel";
import { StudioLogo } from "./StudioLogo";
import { StudioMembersPanel } from "./StudioMembersPanel";
import { StudioProgramPanel } from "./StudioProgramPanel";
import { StudioSettingsPanel } from "./StudioSettingsPanel";
import { StudioVideosPanel } from "./StudioVideosPanel";
import "../../features/rehearsals/ui/rehearsals.css";
import "./style.css";

type StudioTab = "members" | "invites" | "program" | "assignments" | "videos";

const STUDIO_TABS: { id: StudioTab; label: string }[] = [
  { id: "members", label: "Участники" },
  { id: "invites", label: "Приглашение" },
  { id: "program", label: "Программа" },
  { id: "assignments", label: "Задания" },
  { id: "videos", label: "Видео" },
];

export function StudioDetailPage() {
  const { studioId = "" } = useParams();
  const { accessToken } = useAuth();
  const { data: studio, isLoading, error } = useGetStudioQuery(studioId, {
    skip: !accessToken || !studioId,
  });

  const [activeTab, setActiveTab] = useState<StudioTab>("members");
  const [showSettings, setShowSettings] = useState(false);

  if (isLoading) {
    return (
      <div className="app-layout studio-layout">
        <div className="app-content">
          <main className="main-content">
            <div className="studio-page">
              <p>Загрузка…</p>
            </div>
          </main>
        </div>
      </div>
    );
  }

  if (error || !studio) {
    return (
      <div className="app-layout studio-layout">
        <div className="app-content">
          <main className="main-content">
            <div className="studio-page">
              <Link className="studio-page__back" to="/studio">
                ← Студии
              </Link>
              <p className="studio-page__error">Студия не найдена или нет доступа.</p>
            </div>
          </main>
        </div>
      </div>
    );
  }

  const isOwner = studio.myRole === "owner";
  const canManage = studio.canManage;
  const visibleTabs = canManage
    ? STUDIO_TABS
    : STUDIO_TABS.filter((tab) => tab.id !== "invites");
  const activeTabVisible =
    visibleTabs.some((tab) => tab.id === activeTab) ? activeTab : "members";

  return (
    <div className="app-layout studio-layout">
      <div className="app-content">
        <main className="main-content">
          <div className="studio-page">
            <Link className="studio-page__back" to="/studio">
              ← Студии
            </Link>

            <div className="studio-detail-header">
              <div className="studio-detail-header__identity">
                <StudioLogo
                  imageUrl={studio.imageUrl}
                  title={studio.title}
                  size="lg"
                />
                <div>
                  <div className="studio-detail-header__title-row">
                    <h1 className="studio-page__title">{studio.title}</h1>
                    <span className="studio-role-badge">
                      {studioRoleLabel(studio.myRole)}
                    </span>
                  </div>
                  {studio.description ? (
                    <p className="studio-page__subtitle">{studio.description}</p>
                  ) : null}
                </div>
              </div>
              {isOwner ? (
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => setShowSettings((value) => !value)}
                >
                  {showSettings ? "Закрыть" : "Изменить"}
                </Button>
              ) : null}
            </div>

            {showSettings && isOwner ? (
              <RehearsalsCard fluid>
                <StudioSettingsPanel
                  studio={studio}
                  onClose={() => setShowSettings(false)}
                />
              </RehearsalsCard>
            ) : null}

            <div className="studio-tabs" role="tablist">
              {visibleTabs.map((tab) => {
                const tabClassName = cn(
                  "studio-tab",
                  activeTabVisible === tab.id && "studio-tab--active",
                );
                return (
                  <button
                    key={tab.id}
                    type="button"
                    role="tab"
                    aria-selected={activeTabVisible === tab.id}
                    className={tabClassName}
                    onClick={() => setActiveTab(tab.id)}
                  >
                    {tab.label}
                  </button>
                );
              })}
            </div>

            <RehearsalsCard fluid>
              {activeTabVisible === "members" ? (
                <StudioMembersPanel studio={studio} />
              ) : null}
              {activeTabVisible === "invites" && canManage ? (
                <StudioInvitePanel studio={studio} />
              ) : null}
              {activeTabVisible === "program" ? (
                <StudioProgramPanel studio={studio} />
              ) : null}
              {activeTabVisible === "assignments" ? (
                <StudioAssignmentsPanel studio={studio} />
              ) : null}
              {activeTabVisible === "videos" ? (
                <StudioVideosPanel studio={studio} />
              ) : null}
            </RehearsalsCard>
          </div>
        </main>
      </div>
    </div>
  );
}
