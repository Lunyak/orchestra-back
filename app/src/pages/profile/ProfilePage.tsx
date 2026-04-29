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

  useEffect(() => {
    dispatch(profileUiActions.initProfileUi());
  }, [dispatch]);

  useEffect(() => {
    if (ENABLE_PROFILE_TABS) return;
    if (activeTab !== "profile") {
      dispatch(profileUiActions.setActiveProfileTab({ value: "profile" }));
    }
  }, [activeTab, dispatch]);

  if (!accessToken) return <div>Нужно войти, чтобы открыть профиль.</div>;

  const setTab = (value: ProfileTabId) => {
    if (!ENABLE_PROFILE_TABS) return;
    dispatch(profileUiActions.setActiveProfileTab({ value }));
  };

  return (
    <div className="app-layout profile-layout">
      <div className="app-content">
        <main className="main-content">
          <div className="profile-view">
            <h2>Профиль</h2>
            {!ENABLE_PROFILE_TABS ? (
              <div className="profile-tabs-disabled-note">
                Разделы профиля временно недоступны в production. Страница в стадии разработки.
              </div>
            ) : null}

            <div className="profile-tabs" role="tablist" aria-label="Разделы профиля">
              <button
                type="button"
                className={cn("profile-tab-btn", activeTab === "profile" && "active")}
                onClick={() => setTab("profile")}
                role="tab"
                aria-selected={activeTab === "profile"}
                disabled={!ENABLE_PROFILE_TABS}
              >
                Данные профиля
              </button>
              <button
                type="button"
                className={cn("profile-tab-btn", activeTab === "availability" && "active")}
                onClick={() => setTab("availability")}
                role="tab"
                aria-selected={activeTab === "availability"}
                disabled={!ENABLE_PROFILE_TABS}
              >
                Занятость
              </button>
              <button
                type="button"
                className={cn("profile-tab-btn", activeTab === "trainers" && "active")}
                onClick={() => setTab("trainers")}
                role="tab"
                aria-selected={activeTab === "trainers"}
                disabled={!ENABLE_PROFILE_TABS}
              >
                Тренажёры
              </button>
              <button
                type="button"
                className={cn("profile-tab-btn", activeTab === "roleWork" && "active")}
                onClick={() => setTab("roleWork")}
                role="tab"
                aria-selected={activeTab === "roleWork"}
                disabled={!ENABLE_PROFILE_TABS}
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

