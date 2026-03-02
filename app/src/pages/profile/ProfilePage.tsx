import { useEffect } from "react";
import { useAuth } from "../../features/auth";
import { useAppDispatch, useAppSelector } from "../../shared/store/hooks";
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

  if (!accessToken) return <div>Нужно войти, чтобы открыть профиль.</div>;

  const setTab = (value: ProfileTabId) => {
    dispatch(profileUiActions.setActiveProfileTab({ value }));
  };

  return (
    <div className="app-layout profile-layout">
      <div className="app-content">
        <main className="main-content">
          <div className="profile-view">
            <h2>Профиль</h2>

            <div className="profile-tabs" role="tablist" aria-label="Разделы профиля">
              <button
                type="button"
                className={`profile-tab-btn ${activeTab === "profile" ? "active" : ""}`}
                onClick={() => setTab("profile")}
                role="tab"
                aria-selected={activeTab === "profile"}
              >
                Данные профиля
              </button>
              <button
                type="button"
                className={`profile-tab-btn ${activeTab === "availability" ? "active" : ""}`}
                onClick={() => setTab("availability")}
                role="tab"
                aria-selected={activeTab === "availability"}
              >
                Занятость
              </button>
              <button
                type="button"
                className={`profile-tab-btn ${activeTab === "trainers" ? "active" : ""}`}
                onClick={() => setTab("trainers")}
                role="tab"
                aria-selected={activeTab === "trainers"}
              >
                Тренажёры
              </button>
              <button
                type="button"
                className={`profile-tab-btn ${activeTab === "roleWork" ? "active" : ""}`}
                onClick={() => setTab("roleWork")}
                role="tab"
                aria-selected={activeTab === "roleWork"}
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

