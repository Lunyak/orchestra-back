import { PageLoader } from "@shared/components/page-loader/PageLoader";
import cn from "classnames";
import dayjs from "dayjs";
import "dayjs/locale/ru";
import isoWeek from "dayjs/plugin/isoWeek";
import { CalendarSection } from "../../../shared/components/calendar/CalendarSection";
import { MiniAvatar } from "../../../shared/components/mini-avatar/MiniAvatar";
import { RehearsalsCard } from "../../rehearsals-card/RehearsalsCard";
import { formatMemberLabel, RehearsalPlanBlock } from "..";
import { isoDate, normalizeEmail } from "../model/rehearsals-page-utils";
import type { RehearsalsPageViewModel } from "../model/useRehearsalsPage";
import { useRehearsalsPage } from "../model/useRehearsalsPage";
import "./rehearsals.css";

dayjs.extend(isoWeek);
dayjs.locale("ru");

export type { RehearsalsPageViewModel } from "../model/useRehearsalsPage";
export { useRehearsalsPage } from "../model/useRehearsalsPage";

export function RehearsalsPageView(vm: RehearsalsPageViewModel) {
  const {
    accessToken,
    activeRehearsal,
    activeRehearsalId,
    applyPresetDuration,
    availableEmailSetForSelectedDate,
    calendarError,
    calendarState,
    computedDuration,
    computedDurationLabel,
    createForSelectedDate,
    deepLinkedRehearsalId,
    doPublish,
    dotsByDate,
    error,
    freeActorsForSelectedDate,
    loading,
    location,
    members,
    membersWithMe,
    metaDurationMin,
    metaEndTouched,
    metaEndsAtLocal,
    metaSaveError,
    metaSaving,
    metaStartsAtLocal,
    metaTitle,
    myMember,
    myProfile,
    onChangeEnd,
    onChangeStart,
    planCache,
    projectMembers,
    projectName,
    projectOwner,
    projectRoles,
    projectSlug,
    publishError,
    publishing,
    rehearsals,
    rehearsalsByDate,
    rehearsalsForSelectedDay,
    roleByNorm,
    rolesError,
    rolesLoading,
    saveMeta,
    saveSelectedScenes,
    saveScenesError,
    savingScenes,
    scriptSceneById,
    selectedScenes,
    setActiveRehearsalId,
    setCalendarError,
    setCalendarState,
    setMetaDurationMin,
    setMetaEndTouched,
    setMetaEndsAtLocal,
    setMetaSaveError,
    setMetaSaving,
    setMetaStartsAtLocal,
    setMetaTitle,
    setPublishError,
    setPublishing,
    setSaveScenesError,
    setSavingScenes,
    setSelectedScenes,
    sceneAvailabilityByKey,
    scenesError,
    scenesLoading,
    sceneOptions,
    teamProfileByEmail,
    teamProfiles,
    toggleScene,
  } = vm;

  return (
    <div className="app-layout">
      <div className="app-content">
        <main className="main-content">
          <div className="rehearsals-page">
            <div className="rehearsals-head">
              <h2 className="rehearsals-title">Репетиции</h2>
              <div className="rehearsals-meta">Проект: {projectSlug || "—"}</div>
            </div>

            {error && <div className="rehearsals-error">{error}</div>}
            {rolesError && <div className="rehearsals-error">{rolesError}</div>}

            <div className="rehearsals-layout">
              <div className="rehearsals-main">
                <div className="rehearsals-toolbar">
                  <button type="button" onClick={createForSelectedDate} disabled={loading}>
                    + Создать репетицию
                  </button>
                </div>

                <CalendarSection
                  storageMonthKey="rehearsals-calendar-month"
                  onStateChange={setCalendarState}
                  dotsByDate={dotsByDate}
                  title="Календарь репетиций"
                  subtitle="Клик по дню: выбрать дату. Репетиции на дате показываются точками."
                />
                {calendarError && (
                  <div className="rehearsals-error rehearsals-error--spaced">
                    {calendarError}
                  </div>
                )}

                <div className="rehearsals-day-list-label">
                  Репетиции на {calendarState.selectedDate}:
                </div>
                <div className="rehearsals-list">
                  {loading ? (
                    <PageLoader variant="view" label="Загрузка…" />
                  ) : rehearsalsForSelectedDay.length === 0 ? (
                    <div className="rehearsals-muted">На этот день репетиций нет.</div>
                  ) : (
                    rehearsalsForSelectedDay.map((r) => {
                      const t = new Date(r.startsAt);
                      const hh = String(t.getHours()).padStart(2, "0");
                      const mm = String(t.getMinutes()).padStart(2, "0");
                      const end = r.durationMin != null ? dayjs(r.startsAt).add(r.durationMin, "minute") : null;
                      const endLabel = end ? end.format("HH:mm") : null;
                      const notReady = planCache[r.id]?.notReady ?? null;
                      const isBad = notReady != null && notReady > 0;
                      return (
                        <button
                          key={r.id}
                          type="button"
                          className={cn(
                            "rehearsals-item",
                            activeRehearsal?.id === r.id && "rehearsals-item--active",
                            isBad && "rehearsals-item--bad",
                          )}
                          onClick={() => setActiveRehearsalId(r.id)}
                          title={isBad ? `Не собирается сцен: ${notReady}` : undefined}
                        >
                          <div className="rehearsals-item-title">
                            {hh}:{mm}
                            {endLabel ? `–${endLabel}` : ""} · {r.title}
                          </div>
                          <div className="rehearsals-item-meta">
                            {notReady == null ? "План…" : isBad ? `Не собирается: ${notReady}` : "Собирается"}
                          </div>
                        </button>
                      );
                    })
                  )}
                </div>

                <div className="rehearsals-panels">
                  <div className="rehearsals-panel">
                    <div className="rehearsals-panel-title">
                      Свободные актёры на {calendarState.selectedDate}
                    </div>
                    {freeActorsForSelectedDate.length === 0 ? (
                      <div className="rehearsals-muted">Никто не отметил «свободен» на эту дату.</div>
                    ) : (
                      <div className="rehearsals-table-container">
                        <table className="rehearsals-table">
                          <thead>
                            <tr>
                              <th>Актёр</th>
                              <th>Роли (по назначениям)</th>
                            </tr>
                          </thead>
                          <tbody>
                            {freeActorsForSelectedDate.map((a) => (
                              <tr key={a.email}>
                                <td>
                                  <span className="rehearsals-actor-cell">
                                    <MiniAvatar src={String(a.avatarUrl ?? "").trim() || null} label={formatMemberLabel(a)} size={20} />
                                    <span>{formatMemberLabel(a)}</span>
                                  </span>
                                </td>
                                <td className="rehearsals-td-muted">
                                  {a.roles.length ? a.roles.join(", ") : "—"}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>

                  <div className="rehearsals-panel">
                    <div className="rehearsals-panel-title">
                      Сцены, которые можно выбрать (по ролям свободных актёров)
                    </div>
                    {!activeRehearsal ? (
                      <div className="rehearsals-muted">Выбери (или создай) репетицию, чтобы загрузить список сцен.</div>
                    ) : scenesLoading ? (
                      <PageLoader variant="view" label="Загрузка сцен…" />
                    ) : scenesError ? (
                      <div className="rehearsals-error">{scenesError}</div>
                    ) : sceneOptions.length === 0 ? (
                      <div className="rehearsals-muted">Сцен пока нет.</div>
                    ) : (
                      <div className="rehearsals-table-container">
                        <table className="rehearsals-table">
                          <thead>
                            <tr>
                              <th>Сцена</th>
                              <th>Сцена</th>
                              <th>Статус</th>
                              <th>Не хватает ролей</th>
                            </tr>
                          </thead>
                          <tbody>
                            {sceneOptions.flatMap((sc) =>
                              sc.scenes.map((st) => {
                                const key = `${sc.id}:${st.id}`;
                                const info = sceneAvailabilityByKey.get(key);
                                const unknown = info?.unknown ?? false;
                                const ok = info?.ok ?? true;
                                const missing = info?.missingRoles ?? [];
                                return (
                                  <tr key={`tbl-${key}`} data-ok={!unknown && ok ? "1" : "0"}>
                                    <td>{sc.name}</td>
                                    <td>
                                      {st.id}. {st.title}
                                    </td>
                                    <td
                                      className={
                                        unknown
                                          ? "rehearsals-td-muted"
                                          : ok
                                            ? "rehearsals-td-ok"
                                            : "rehearsals-td-bad"
                                      }
                                    >
                                      {unknown ? "неизвестно" : ok ? "можно" : "нельзя"}
                                    </td>
                                    <td className="rehearsals-td-muted">
                                      {unknown ? "нет данных о ролях/назначениях" : missing.length ? missing.join(", ") : "—"}
                                    </td>
                                  </tr>
                                );
                              }),
                            )}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              <aside className="rehearsals-side">
                {!activeRehearsal ? (
                  <RehearsalsCard>
                    <div className="rehearsals-muted">Выбери репетицию слева.</div>
                  </RehearsalsCard>
                ) : (
                  <RehearsalsCard
                    title={activeRehearsal.title}
                    subtitle={(() => {
                      const start = dayjs(activeRehearsal.startsAt);
                      const end =
                        activeRehearsal.durationMin != null
                          ? start.add(activeRehearsal.durationMin, "minute")
                          : null;
                      return `${start.format("DD.MM.YYYY HH:mm")}${end ? `–${end.format("HH:mm")}` : ""}`;
                    })()}
                  >
                    <div className="rehearsals-section">
                      <div className="rehearsals-section-title">Параметры</div>
                      <div className="rehearsals-form-grid">
                        <label className="rehearsals-form-field">
                          <span className="rehearsals-muted rehearsals-muted--sm">
                            Название
                          </span>
                          <input
                            value={metaTitle}
                            onChange={(e) => setMetaTitle(e.target.value)}
                            placeholder="Репетиция"
                          />
                        </label>
                        <label className="rehearsals-form-field">
                          <span className="rehearsals-muted rehearsals-muted--sm">
                            Дата и время начала
                          </span>
                          <input
                            type="datetime-local"
                            value={metaStartsAtLocal}
                            onChange={(e) => onChangeStart(e.target.value)}
                          />
                        </label>
                        <label className="rehearsals-form-field">
                          <span className="rehearsals-muted rehearsals-muted--sm">
                            Дата и время окончания
                          </span>
                          <input
                            type="datetime-local"
                            value={metaEndsAtLocal}
                            onChange={(e) => onChangeEnd(e.target.value)}
                          />
                        </label>
                        <div className="rehearsals-muted rehearsals-muted--sm">
                          Длительность: {computedDurationLabel}
                        </div>

                        <div className="rehearsals-form-actions">
                          <button type="button" onClick={() => applyPresetDuration(90)} disabled={metaSaving}>
                            90 мин
                          </button>
                          <button type="button" onClick={() => applyPresetDuration(120)} disabled={metaSaving}>
                            120 мин
                          </button>
                          <button type="button" onClick={() => applyPresetDuration(150)} disabled={metaSaving}>
                            150 мин
                          </button>
                          <button type="button" onClick={saveMeta} disabled={metaSaving}>
                            {metaSaving ? "Сохраняю…" : "Сохранить параметры"}
                          </button>
                        </div>
                        {metaSaveError && <div className="rehearsals-error">{metaSaveError}</div>}
                      </div>
                    </div>

                    <div className="rehearsals-section">
                      <div className="rehearsals-section-title">Публикация в чат</div>
                      <div className="rehearsals-form-grid">
                        <div className="rehearsals-muted rehearsals-muted--sm">
                          Сначала выбери сцены для репетиции. В опрос попадут только те актёры, которые нужны по выбранным сценам и отметили «свободен» в графике коллектива.
                        </div>
                        <button
                          type="button"
                          onClick={doPublish}
                          disabled={
                            publishing ||
                            !!activeRehearsal.telegramMessageId ||
                            !(activeRehearsal.selectedScenes?.length ?? 0)
                          }
                          title={
                            activeRehearsal.telegramMessageId
                              ? "Уже опубликовано"
                              : !(activeRehearsal.selectedScenes?.length ?? 0)
                                ? "Сначала выберите и сохраните сцены"
                                : "Опубликовать репетицию в Telegram-чате"
                          }
                        >
                          {activeRehearsal.telegramMessageId
                            ? "Опубликовано"
                            : publishing
                              ? "Публикую…"
                              : "Опубликовать в чат"}
                        </button>
                        {activeRehearsal.publishedAt && (
                          <div className="rehearsals-muted">
                            Опубликовано: {dayjs(activeRehearsal.publishedAt).format("DD.MM.YYYY HH:mm")}
                          </div>
                        )}
                        {publishError && <div className="rehearsals-error">{publishError}</div>}
                      </div>
                    </div>

                    <div className="rehearsals-section">
                      <div className="rehearsals-section-title">Сцены на репетицию</div>
                      {scenesLoading ? (
                        <PageLoader variant="view" label="Загрузка…" />
                      ) : scenesError ? (
                        <div className="rehearsals-error">{scenesError}</div>
                      ) : sceneOptions.length === 0 ? (
                        <div className="rehearsals-muted">Сцен пока нет.</div>
                      ) : (
                        <div className="rehearsals-scene-pick-grid">
                          <div className="rehearsals-muted rehearsals-muted--sm">
                            Выбрано: {selectedScenes.length}
                          </div>
                          <div className="rehearsals-scene-pick-scroll">
                            {sceneOptions.slice(0, 10).map((sc) => (
                              <div key={sc.id} className="rehearsals-scene-group">
                                <div className="rehearsals-scene-group-title">
                                  {sc.name}
                                </div>
                                <div className="rehearsals-scene-options">
                                  {sc.scenes.slice(0, 200).map((st) => {
                                    const key = `${sc.id}:${st.id}`;
                                    const avail = sceneAvailabilityByKey.get(key);
                                    const unknown = avail?.unknown ?? false;
                                    const ok = avail?.ok ?? true;
                                    const missing = avail?.missingRoles ?? [];
                                    const checked = selectedScenes.some(
                                      (x) => x.playbookId === sc.id && x.sceneId === st.id,
                                    );
                                    return (
                                      <label
                                        key={`${sc.id}:${st.id}`}
                                        className="rehearsals-scene-option"
                                      >
                                        <input
                                          type="checkbox"
                                          checked={checked}
                                          disabled={!unknown && !ok}
                                          onChange={() => toggleScene(sc.id, st.id)}
                                          title={
                                            unknown
                                              ? "Нет данных о ролях/назначениях для этой сцены"
                                              : ok
                                                ? "Можно выбрать"
                                                : missing.length
                                                  ? `Не хватает ролей (по свободным актёрам): ${missing.join(", ")}`
                                                  : "Не хватает ролей (по свободным актёрам)"
                                          }
                                        />
                                        <span className="rehearsals-scene-option-text">
                                          {st.id}. {st.title}
                                          {!unknown && !ok && missing.length > 0 && (
                                            <span className="rehearsals-muted rehearsals-scene-option-note">
                                              не хватает: {missing.slice(0, 4).join(", ")}
                                              {missing.length > 4 ? ` +${missing.length - 4}` : ""}
                                            </span>
                                          )}
                                          {unknown && (
                                            <span className="rehearsals-muted rehearsals-scene-option-note">
                                              роли: нет данных
                                            </span>
                                          )}
                                        </span>
                                      </label>
                                    );
                                  })}
                                </div>
                              </div>
                            ))}
                          </div>
                          <button type="button" onClick={saveSelectedScenes} disabled={savingScenes}>
                            {savingScenes ? "Сохраняю…" : "Сохранить сцены"}
                          </button>
                          {saveScenesError && <div className="rehearsals-error">{saveScenesError}</div>}
                        </div>
                      )}
                    </div>

                    <div className="rehearsals-section">
                      <div className="rehearsals-section-title">Вызов актёров</div>
                      <div className="rehearsals-people">
                        {members.map((m) => {
                          const meta = (activeRehearsal.participants ?? []).find(
                            (p) => normalizeEmail(p.email) === normalizeEmail(m.email),
                          );
                          const dateKey = isoDate(new Date(activeRehearsal.startsAt));
                          const prof = teamProfileByEmail.get(normalizeEmail(m.email));
                          const availability =
                            (prof?.availabilityCalendar as any)?.[dateKey] === "present"
                              ? ("present" as const)
                              : (prof?.availabilityCalendar as any)?.[dateKey] === "absent"
                                ? ("absent" as const)
                                : ("unknown" as const);
                          return (
                            <div key={m.email} className="rehearsals-person">
                              <div className="rehearsals-person-label">
                                <span className="rehearsals-actor-cell">
                                  <MiniAvatar
                                    src={String((prof as any)?.avatarUrl ?? "").trim() || null}
                                    label={formatMemberLabel(m)}
                                    size={20}
                                  />
                                  <span>{formatMemberLabel(m)}</span>
                                </span>
                              </div>
                              <div className="rehearsals-muted rehearsals-muted--xs">
                                по календарю:{" "}
                                {availability === "present"
                                  ? "свободен"
                                  : availability === "absent"
                                    ? "занят"
                                    : "не отмечено"}
                              </div>
                              {meta?.respondedAt && (
                                <div className="rehearsals-muted rehearsals-muted--xs">
                                  ответил: {dayjs(meta.respondedAt).format("DD.MM HH:mm")}
                                </div>
                              )}
                              {meta?.status === "late" && meta?.lateTime && (
                                <div className="rehearsals-muted rehearsals-muted--xs">
                                  будет к: {meta.lateTime}
                                </div>
                              )}
                              {meta?.status && meta.status !== "unknown" && (
                                <div className="rehearsals-muted rehearsals-muted--xs">
                                  по вызову:{" "}
                                  {meta.status === "present"
                                    ? "подтвердил"
                                    : meta.status === "absent"
                                      ? "отказался"
                                      : "опоздает"}
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>

                    <div className="rehearsals-section">
                      <div className="rehearsals-section-title">Что не собирается</div>
                      <RehearsalPlanBlock accessToken={accessToken} rehearsalId={activeRehearsal.id} />
                    </div>
                  </RehearsalsCard>
                )}
              </aside>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}

export function RehearsalsPage() {
  const vm = useRehearsalsPage();
  if (vm.needsAuth) {
    return <div className="rehearsals-muted">Нужно войти.</div>;
  }
  return <RehearsalsPageView {...vm} />;
}
