import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../features/auth";
import { useProject } from "../../features/project";
import { projectSettingsPath } from "../../app/router/paths";
import {
  type BotVariableItem,
  type TelegramBotIntegrationSummary,
  connectTelegramBot,
  deleteBotVariable,
  deleteTelegramBot,
  listBotVariables,
  listTelegramBots,
  sendTelegramBotTestMessage,
  updateTelegramBot,
  upsertBotVariable,
} from "../../sync/api/telegram-bots";
import "./SettingsPage/style.css";

function looksLikeTelegramBotToken(token: string): boolean {
  const t = String(token ?? "").trim();
  // Telegram bot token format: "<digits>:<secret>", where secret is typically 35+ chars.
  // We keep it permissive but require ":" and a reasonably long suffix.
  const m = t.match(/^(\d{5,}):([A-Za-z0-9_-]{20,})$/);
  return Boolean(m);
}

export function SettingsBotPage() {
  const navigate = useNavigate();
  const { projectName } = useProject();
  const { accessToken } = useAuth();

  const [bots, setBots] = useState<TelegramBotIntegrationSummary[]>([]);
  const [botsLoading, setBotsLoading] = useState(false);
  const [botsError, setBotsError] = useState<string | null>(null);

  const [selectedBotId, setSelectedBotId] = useState<string>("");

  const selectedBot = useMemo(
    () => bots.find((b) => b.id === selectedBotId) ?? null,
    [bots, selectedBotId],
  );

  const [connectTitle, setConnectTitle] = useState("");
  const [connectToken, setConnectToken] = useState("");
  const [connectLoading, setConnectLoading] = useState(false);
  const [connectError, setConnectError] = useState<string | null>(null);

  const [botPatch, setBotPatch] = useState<{
    title: string;
    ownerTelegramId: string;
    adminTelegramId: string;
    groupChatId: string;
    attendanceThreadId: string;
    announcementsThreadId: string;
    defaultProjectSlug: string;
    quizGroupChatId: string;
    quizThreadId: string;
  }>({
    title: "",
    ownerTelegramId: "",
    adminTelegramId: "",
    groupChatId: "",
    attendanceThreadId: "",
    announcementsThreadId: "",
    defaultProjectSlug: "",
    quizGroupChatId: "",
    quizThreadId: "",
  });
  const [botPatchSaving, setBotPatchSaving] = useState(false);
  const [botPatchError, setBotPatchError] = useState<string | null>(null);

  const [vars, setVars] = useState<BotVariableItem[]>([]);
  const [varsLoading, setVarsLoading] = useState(false);
  const [varsError, setVarsError] = useState<string | null>(null);

  const [newVarKey, setNewVarKey] = useState("");
  const [newVarValue, setNewVarValue] = useState("");
  const [newVarIsSecret, setNewVarIsSecret] = useState(false);
  const [newVarSaving, setNewVarSaving] = useState(false);
  const [newVarError, setNewVarError] = useState<string | null>(null);

  const [testChatId, setTestChatId] = useState("");
  const [testText, setTestText] = useState("Привет! Это тест из Orchestra. {{name}}");
  const [testLoading, setTestLoading] = useState(false);
  const [testError, setTestError] = useState<string | null>(null);
  const [testOk, setTestOk] = useState<string | null>(null);

  async function reloadBots(nextSelectId?: string) {
    if (!accessToken) return;
    setBotsLoading(true);
    setBotsError(null);
    try {
      const data = await listTelegramBots(accessToken);
      setBots(data.items ?? []);
      const candidate = nextSelectId ?? selectedBotId;
      if (candidate && data.items?.some((b) => b.id === candidate)) {
        setSelectedBotId(candidate);
      } else if (data.items?.[0]?.id) {
        setSelectedBotId(data.items[0].id);
      } else {
        setSelectedBotId("");
      }
    } catch (e: any) {
      setBotsError(e?.response?.data?.message || e?.message || "Не удалось загрузить ботов");
    } finally {
      setBotsLoading(false);
    }
  }

  useEffect(() => {
    void reloadBots();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [accessToken]);

  useEffect(() => {
    if (!selectedBot) return;
    setBotPatch({
      title: selectedBot.title ?? "",
      ownerTelegramId: selectedBot.ownerTelegramId ?? "",
      adminTelegramId: selectedBot.adminTelegramId ?? "",
      groupChatId: selectedBot.groupChatId ?? "",
      attendanceThreadId: selectedBot.attendanceThreadId ?? "",
      announcementsThreadId: selectedBot.announcementsThreadId ?? "",
      defaultProjectSlug: selectedBot.defaultProjectSlug ?? "",
      quizGroupChatId: selectedBot.quizGroupChatId ?? "",
      quizThreadId: selectedBot.quizThreadId ?? "",
    });
  }, [selectedBot]);

  async function reloadVars() {
    if (!accessToken || !selectedBotId) return;
    setVarsLoading(true);
    setVarsError(null);
    try {
      const data = await listBotVariables(accessToken, selectedBotId);
      setVars(data.items ?? []);
    } catch (e: any) {
      setVarsError(
        e?.response?.data?.message || e?.message || "Не удалось загрузить переменные",
      );
    } finally {
      setVarsLoading(false);
    }
  }

  useEffect(() => {
    void reloadVars();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [accessToken, selectedBotId]);

  const handleConnect = async () => {
    if (!accessToken) return;
    const token = connectToken.trim();
    if (!token) return;
    if (token === "BOT_TOKENS_KEY") {
      setConnectError(
        'В это поле нужно вставить токен Telegram-бота из BotFather (пример: "123456789:AA..."), а не имя переменной окружения.',
      );
      return;
    }
    if (!looksLikeTelegramBotToken(token)) {
      setConnectError(
        'Токен не похож на токен Telegram-бота. Он должен выглядеть как "123456789:AA..." (обязательно с двоеточием).',
      );
      return;
    }
    setConnectLoading(true);
    setConnectError(null);
    try {
      const res = await connectTelegramBot(accessToken, {
        token,
        title: connectTitle.trim() || undefined,
      });
      setConnectToken("");
      setConnectTitle("");
      await reloadBots(res.id);
    } catch (e: any) {
      setConnectError(e?.response?.data?.message || e?.message || "Не удалось подключить бота");
    } finally {
      setConnectLoading(false);
    }
  };

  const handleSaveBotSettings = async () => {
    if (!accessToken || !selectedBotId) return;
    setBotPatchSaving(true);
    setBotPatchError(null);
    try {
      await updateTelegramBot(accessToken, selectedBotId, {
        title: botPatch.title.trim() || null,
        ownerTelegramId: botPatch.ownerTelegramId.trim() || null,
        adminTelegramId: botPatch.adminTelegramId.trim() || null,
        groupChatId: botPatch.groupChatId.trim() || null,
        attendanceThreadId: botPatch.attendanceThreadId.trim() || null,
        announcementsThreadId: botPatch.announcementsThreadId.trim() || null,
        defaultProjectSlug: botPatch.defaultProjectSlug.trim() || null,
        quizGroupChatId: botPatch.quizGroupChatId.trim() || null,
        quizThreadId: botPatch.quizThreadId.trim() || null,
      });
      await reloadBots(selectedBotId);
    } catch (e: any) {
      setBotPatchError(
        e?.response?.data?.message || e?.message || "Не удалось сохранить настройки",
      );
    } finally {
      setBotPatchSaving(false);
    }
  };

  const handleDeleteBot = async () => {
    if (!accessToken || !selectedBotId) return;
    const ok = window.confirm("Удалить подключение бота? Это не удалит бота в Telegram.");
    if (!ok) return;
    try {
      await deleteTelegramBot(accessToken, selectedBotId);
      await reloadBots();
    } catch (e: any) {
      alert(e?.response?.data?.message || e?.message || "Не удалось удалить бота");
    }
  };

  const handleCreateVar = async () => {
    if (!accessToken || !selectedBotId) return;
    const key = newVarKey.trim();
    if (!key) return;
    setNewVarSaving(true);
    setNewVarError(null);
    try {
      await upsertBotVariable(accessToken, selectedBotId, key, {
        value: newVarValue,
        isSecret: newVarIsSecret,
      });
      setNewVarKey("");
      setNewVarValue("");
      setNewVarIsSecret(false);
      await reloadVars();
    } catch (e: any) {
      setNewVarError(e?.response?.data?.message || e?.message || "Не удалось сохранить переменную");
    } finally {
      setNewVarSaving(false);
    }
  };

  const handleDeleteVar = async (key: string) => {
    if (!accessToken || !selectedBotId) return;
    const ok = window.confirm(`Удалить переменную "${key}"?`);
    if (!ok) return;
    try {
      await deleteBotVariable(accessToken, selectedBotId, key);
      await reloadVars();
    } catch (e: any) {
      alert(e?.response?.data?.message || e?.message || "Не удалось удалить переменную");
    }
  };

  const handleSendTest = async () => {
    if (!accessToken || !selectedBotId) return;
    setTestLoading(true);
    setTestError(null);
    setTestOk(null);
    try {
      await sendTelegramBotTestMessage(accessToken, selectedBotId, {
        chatId: testChatId.trim(),
        text: testText,
      });
      setTestOk("Отправлено");
    } catch (e: any) {
      setTestError(e?.response?.data?.message || e?.message || "Не удалось отправить сообщение");
    } finally {
      setTestLoading(false);
    }
  };

  return (
    <div className="app-layout settings-layout">
      <div className="app-content">
        <main className="main-content main-content-settings">
          <div className="settings-view">
            <div className="settings-bot-topbar">
              <button
                type="button"
                onClick={() => navigate(projectSettingsPath(projectName))}
              >
                ← Назад
              </button>
              <h2>Настройки бота (Telegram)</h2>
            </div>

            <section className="settings-bot-section">
              <h3>Подключить бота</h3>
              <div className="settings-bot-row">
                <input
                  type="text"
                  value={connectTitle}
                  onChange={(e) => setConnectTitle(e.target.value)}
                  placeholder="Название (например: Театр)"
                />
                <input
                  type="password"
                  value={connectToken}
                  onChange={(e) => setConnectToken(e.target.value)}
                  placeholder='Токен из BotFather (пример: 123456789:AA...)'
                />
                <button type="button" onClick={handleConnect} disabled={connectLoading || !connectToken.trim()}>
                  {connectLoading ? "Подключаем..." : "Подключить"}
                </button>
              </div>
              <p className="settings-bot-hint">
                Вставьте токен Telegram-бота из BotFather (формат: <code>числа:секрет</code>).
                Токен хранится на сервере в зашифрованном виде и в интерфейсе не показывается.
              </p>
              {connectError && <div className="settings-bot-error">{connectError}</div>}
            </section>

            <section className="settings-bot-section">
              <h3>Мои боты</h3>
              <div className="settings-bot-row">
                <select
                  value={selectedBotId}
                  onChange={(e) => setSelectedBotId(e.target.value)}
                  disabled={botsLoading}
                >
                  <option value="">— выберите бота —</option>
                  {bots.map((b) => (
                    <option key={b.id} value={b.id}>
                      {(b.title || (b.botUsername ? `@${b.botUsername}` : b.id)).toString()} ({b.status})
                    </option>
                  ))}
                </select>
                <button type="button" onClick={() => void reloadBots()} disabled={botsLoading}>
                  {botsLoading ? "Обновляем..." : "Обновить"}
                </button>
                <button type="button" onClick={handleDeleteBot} disabled={!selectedBotId}>
                  Удалить
                </button>
              </div>
              {botsError && <div className="settings-bot-error">{botsError}</div>}
              {selectedBot && (
                <p className="settings-bot-hint">
                  Telegram: {selectedBot.botUsername ? `@${selectedBot.botUsername}` : "—"} / id:{" "}
                  {selectedBot.botTelegramUserId || "—"}
                </p>
              )}
            </section>

            {selectedBot && (
              <>
                <section className="settings-bot-section">
                  <h3>Настройки публикации</h3>
                  <div className="settings-bot-grid">
                    <label>
                      Название
                      <input
                        type="text"
                        value={botPatch.title}
                        onChange={(e) =>
                          setBotPatch((s) => ({ ...s, title: e.target.value }))
                        }
                      />
                    </label>
                    <label>
                      ownerTelegramId
                      <input
                        type="text"
                        value={botPatch.ownerTelegramId}
                        onChange={(e) =>
                          setBotPatch((s) => ({
                            ...s,
                            ownerTelegramId: e.target.value,
                          }))
                        }
                        placeholder="381275482"
                      />
                    </label>
                    <label>
                      adminTelegramId
                      <input
                        type="text"
                        value={botPatch.adminTelegramId}
                        onChange={(e) =>
                          setBotPatch((s) => ({
                            ...s,
                            adminTelegramId: e.target.value,
                          }))
                        }
                        placeholder="381275482"
                      />
                    </label>
                    <label>
                      groupChatId
                      <input
                        type="text"
                        value={botPatch.groupChatId}
                        onChange={(e) =>
                          setBotPatch((s) => ({ ...s, groupChatId: e.target.value }))
                        }
                        placeholder="-1001234567890"
                      />
                    </label>
                    <label>
                      attendanceThreadId
                      <input
                        type="text"
                        value={botPatch.attendanceThreadId}
                        onChange={(e) =>
                          setBotPatch((s) => ({
                            ...s,
                            attendanceThreadId: e.target.value,
                          }))
                        }
                        placeholder="(опционально)"
                      />
                    </label>
                    <label>
                      announcementsThreadId
                      <input
                        type="text"
                        value={botPatch.announcementsThreadId}
                        onChange={(e) =>
                          setBotPatch((s) => ({
                            ...s,
                            announcementsThreadId: e.target.value,
                          }))
                        }
                        placeholder="(опционально)"
                      />
                    </label>
                    <label>
                      defaultProjectSlug
                      <input
                        type="text"
                        value={botPatch.defaultProjectSlug}
                        onChange={(e) =>
                          setBotPatch((s) => ({
                            ...s,
                            defaultProjectSlug: e.target.value,
                          }))
                        }
                        placeholder="(опционально)"
                      />
                    </label>
                    <label>
                      quizGroupChatId
                      <input
                        type="text"
                        value={botPatch.quizGroupChatId}
                        onChange={(e) =>
                          setBotPatch((s) => ({
                            ...s,
                            quizGroupChatId: e.target.value,
                          }))
                        }
                        placeholder="-1494331205"
                      />
                    </label>
                    <label>
                      quizThreadId
                      <input
                        type="text"
                        value={botPatch.quizThreadId}
                        onChange={(e) =>
                          setBotPatch((s) => ({
                            ...s,
                            quizThreadId: e.target.value,
                          }))
                        }
                        placeholder="39822"
                      />
                    </label>
                  </div>
                  <div className="settings-bot-row">
                    <button type="button" onClick={handleSaveBotSettings} disabled={botPatchSaving}>
                      {botPatchSaving ? "Сохраняем..." : "Сохранить"}
                    </button>
                    {botPatchError && <div className="settings-bot-error">{botPatchError}</div>}
                  </div>
                </section>

                <section className="settings-bot-section">
                  <h3>Переменные</h3>
                  <p className="settings-bot-hint">
                    Используйте в текстах шаблоны вида {"{{name}}"} (ключи: латиница/цифры/._-).
                  </p>

                  <div className="settings-bot-row">
                    <input
                      type="text"
                      value={newVarKey}
                      onChange={(e) => setNewVarKey(e.target.value)}
                      placeholder="key (например: name)"
                    />
                    <input
                      type={newVarIsSecret ? "password" : "text"}
                      value={newVarValue}
                      onChange={(e) => setNewVarValue(e.target.value)}
                      placeholder="value"
                    />
                    <label className="settings-bot-checkbox">
                      <input
                        type="checkbox"
                        checked={newVarIsSecret}
                        onChange={(e) => setNewVarIsSecret(e.target.checked)}
                      />
                      secret
                    </label>
                    <button
                      type="button"
                      onClick={handleCreateVar}
                      disabled={newVarSaving || !newVarKey.trim()}
                    >
                      {newVarSaving ? "Сохраняем..." : "Добавить/обновить"}
                    </button>
                  </div>
                  {newVarError && <div className="settings-bot-error">{newVarError}</div>}

                  {varsLoading ? (
                    <div className="settings-bot-hint">Загрузка...</div>
                  ) : varsError ? (
                    <div className="settings-bot-error">{varsError}</div>
                  ) : vars.length === 0 ? (
                    <div className="settings-bot-hint">Переменных пока нет.</div>
                  ) : (
                    <div className="settings-bot-vars">
                      {vars.map((v) => (
                        <div key={v.id} className="settings-bot-var-row">
                          <code className="settings-bot-var-key">{v.key}</code>
                          <span className="settings-bot-var-value">
                            {v.isSecret ? "(secret)" : v.value}
                          </span>
                          <button type="button" onClick={() => handleDeleteVar(v.key)}>
                            Удалить
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </section>

                <section className="settings-bot-section">
                  <h3>Тестовое сообщение</h3>
                  <div className="settings-bot-grid">
                    <label>
                      chatId
                      <input
                        type="text"
                        value={testChatId}
                        onChange={(e) => setTestChatId(e.target.value)}
                        placeholder="-1001234567890 или ваш userId"
                      />
                    </label>
                    <label>
                      Текст
                      <textarea
                        value={testText}
                        onChange={(e) => setTestText(e.target.value)}
                        rows={4}
                      />
                    </label>
                  </div>
                  <div className="settings-bot-row">
                    <button
                      type="button"
                      onClick={handleSendTest}
                      disabled={testLoading || !testChatId.trim() || !testText.trim()}
                    >
                      {testLoading ? "Отправляем..." : "Отправить"}
                    </button>
                    {testOk && <div className="settings-bot-ok">{testOk}</div>}
                    {testError && <div className="settings-bot-error">{testError}</div>}
                  </div>
                </section>
              </>
            )}

            <section className="settings-bot-section">
              <h3>Что дальше</h3>
              <p className="settings-bot-hint">
                Сейчас страница даёт подключение токена, переменные и тест отправки.
                Следующий шаг — привязать вашу бизнес-логику (публикация сессий/команды) к выбранному боту.
              </p>
            </section>
          </div>
        </main>
      </div>
    </div>
  );
}

