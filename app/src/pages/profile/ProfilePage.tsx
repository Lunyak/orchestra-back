import { useEffect } from "react";
import cn from "classnames";
import { useAuth } from "../../features/auth";
import { useAppDispatch, useAppSelector } from "../../shared/store/hooks";
import { ENABLE_PROFILE_TABS } from "../../shared/build-features";
import {
  profileUiActions,
  selectActiveProfileTab,
  type ProfileTabId,
} from "../../features/profile/model/profileUiSlice";
import { ProfileAvailabilityTab } from "./tabs/ProfileAvailabilityTab";
import { ProfileDataTab } from "./tabs/ProfileDataTab";
import { ProfileRoleWorkTab } from "./tabs/ProfileRoleWorkTab";
import { ProfileTrainersTab } from "./tabs/ProfileTrainersTab";
import "./style.css";

export function ProfilePage() {
  const { accessToken } = useAuth();
  const dispatch = useAppDispatch();
  const activeTab = useAppSelector(selectActiveProfileTab);
  const isLimitedProductionMode = !ENABLE_PROFILE_TABS;

  const isTabDisabled = (tabId: ProfileTabId) => {
    if (!isLimitedProductionMode) return false;
    return tabId === "trainers" || tabId === "roleWork";
  };

  useEffect(() => {
    dispatch(profileUiActions.initProfileUi());
  }, [dispatch]);

  useEffect(() => {
    if (!isTabDisabled(activeTab)) return;
    if (activeTab !== "profile") {
      dispatch(profileUiActions.setActiveProfileTab({ value: "profile" }));
    }
  }, [activeTab, dispatch]);

  if (!accessToken) return <div>Нужно войти, чтобы открыть профиль.</div>;

  const setTab = (value: ProfileTabId) => {
    if (isTabDisabled(value)) return;
    dispatch(profileUiActions.setActiveProfileTab({ value }));
  };

  return (
    <div className="app-layout profile-layout">
      <div className="app-content">
        <main className="main-content">
          <div className="profile-view">
            <h2>Профиль</h2>
            {isLimitedProductionMode ? (
              <div className="profile-tabs-disabled-note">
                Некоторые разделы профиля временно недоступны в production. Страница в стадии разработки.
              </div>
            ) : null}

            <div className="profile-tabs" role="tablist" aria-label="Разделы профиля">
              <button
                type="button"
                className={cn("profile-tab-btn", activeTab === "profile" && "active")}
                onClick={() => setTab("profile")}
                role="tab"
                aria-selected={activeTab === "profile"}
                disabled={isTabDisabled("profile")}
              >
                Данные профиля
              </button>
              <button
                type="button"
                className={cn("profile-tab-btn", activeTab === "availability" && "active")}
                onClick={() => setTab("availability")}
                role="tab"
                aria-selected={activeTab === "availability"}
                disabled={isTabDisabled("availability")}
              >
                Занятость
              </button>
              <button
                type="button"
                className={cn("profile-tab-btn", activeTab === "trainers" && "active")}
                onClick={() => setTab("trainers")}
                role="tab"
                aria-selected={activeTab === "trainers"}
                disabled={isTabDisabled("trainers")}
              >
                Тренажёры
              </button>
              <button
                type="button"
                className={cn("profile-tab-btn", activeTab === "roleWork" && "active")}
                onClick={() => setTab("roleWork")}
                role="tab"
                aria-selected={activeTab === "roleWork"}
                disabled={isTabDisabled("roleWork")}
              >
                Работа над ролью
              </button>
            </div>

            <div className="profile-tab-content" role="tabpanel">
              {activeTab === "profile" ? (
                <ProfileDataTab />
              ) : activeTab === "availability" ? (
                <ProfileAvailabilityTab />
              ) : activeTab === "trainers" ? (
                <ProfileTrainersTab />
              ) : (
                <ProfileRoleWorkTab />
              )}
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}

