import { Buttons } from "@shared/components/buttons/Buttons";
import { Button } from "@shared/core/button/Button";
import { LabeledCheckbox } from "@shared/core/labeled-checkbox/LabeledCheckbox";
import { PageLoader } from "@shared/components/page-loader/PageLoader";
import cn from "classnames";
import { useEffect, useMemo, useState } from "react";
import { useAuth } from "../../../features/auth";
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
} from "../../../sync/api/telegram-bots";
import {
  type MessengerBridgeSummary,
  type MessengerChannelSummary,
  type MessengerPlatform,
  connectMessengerChannel,
  createMessengerBridge,
  deleteMessengerBridge,
  deleteMessengerChannel,
  listMessengerBridges,
  listMessengerChannels,
  sendMessengerTestMessage,
  updateMessengerBridge,
  updateMessengerChannel,
} from "../../../sync/api/messenger-bots";

type ConnectPlatform = "telegram" | "max" | "vk";

type GalleryItem =
  | { kind: "telegram"; bot: TelegramBotIntegrationSummary }
  | { kind: "channel"; channel: MessengerChannelSummary };

type PanelMode = "none" | "connect" | "telegram" | "channel";

function looksLikeTelegramBotToken(token: string): boolean {
  const t = String(token ?? "").trim();
  return Boolean(t.match(/^(\d{5,}):([A-Za-z0-9_-]{20,})$/));
}

function platformLabel(platform: string): string {
  if (platform === "telegram") return "Telegram";
  if (platform === "max") return "Max";
  if (platform === "vk") return "VK";
  return platform;
}

function telegramTitle(bot: TelegramBotIntegrationSummary): string {
  const title = String(bot.title ?? "").trim();
  if (title) return title;
  if (bot.botUsername) return `@${bot.botUsername}`;
  return "Telegram";
}

function channelTitle(ch: MessengerChannelSummary): string {
  const title = String(ch.title ?? "").trim();
  if (title) return title;
  if (ch.externalUsername) return String(ch.externalUsername);
  return platformLabel(ch.platform);
}

function memberKey(platform: MessengerPlatform, id: string): string {
  return `${platform}:${id}`;
}

export function SettingsBotTab() {
  const { accessToken } = useAuth();

  const [tgBots, setTgBots] = useState<TelegramBotIntegrationSummary[]>([]);
  const [channels, setChannels] = useState<MessengerChannelSummary[]>([]);
  const [bridges, setBridges] = useState<MessengerBridgeSummary[]>([]);
  const [loading, setLoading] = useState(false);
  const [listError, setListError] = useState<string | null>(null);

  const [panelMode, setPanelMode] = useState<PanelMode>("none");
  const [selectedTelegramId, setSelectedTelegramId] = useState("");
  const [selectedChannelId, setSelectedChannelId] = useState("");

  const [connectPlatform, setConnectPlatform] =
    useState<ConnectPlatform>("telegram");
  const [connectTitle, setConnectTitle] = useState("");
  const [connectToken, setConnectToken] = useState("");
  const [connectChatId, setConnectChatId] = useState("");
  const [connectVkGroupId, setConnectVkGroupId] = useState("");
  const [connectLoading, setConnectLoading] = useState(false);
  const [connectError, setConnectError] = useState<string | null>(null);
  const [connectHint, setConnectHint] = useState<string | null>(null);

  const selectedTelegram = useMemo(
    () => tgBots.find((b) => b.id === selectedTelegramId) ?? null,
    [tgBots, selectedTelegramId],
  );
  const selectedChannel = useMemo(
    () => channels.find((c) => c.id === selectedChannelId) ?? null,
    [channels, selectedChannelId],
  );

  const [botPatch, setBotPatch] = useState({
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

  const [channelPatch, setChannelPatch] = useState({
    title: "",
    chatId: "",
    vkConfirmation: "",
  });
  const [channelSaving, setChannelSaving] = useState(false);
  const [channelError, setChannelError] = useState<string | null>(null);

  const [vars, setVars] = useState<BotVariableItem[]>([]);
  const [varsLoading, setVarsLoading] = useState(false);
  const [varsError, setVarsError] = useState<string | null>(null);
  const [newVarKey, setNewVarKey] = useState("");
  const [newVarValue, setNewVarValue] = useState("");
  const [newVarIsSecret, setNewVarIsSecret] = useState(false);
  const [newVarSaving, setNewVarSaving] = useState(false);
  const [newVarError, setNewVarError] = useState<string | null>(null);

  const [testChatId, setTestChatId] = useState("");
  const [testText, setTestText] = useState("Привет! Это тест из Orchestra.");
  const [testLoading, setTestLoading] = useState(false);
  const [testError, setTestError] = useState<string | null>(null);
  const [testOk, setTestOk] = useState<string | null>(null);

  const [bridgeTitle, setBridgeTitle] = useState("");
  const [bridgePrimaryKey, setBridgePrimaryKey] = useState("");
  const [bridgeMirrorKeys, setBridgeMirrorKeys] = useState<string[]>([]);
  const [bridgeSaving, setBridgeSaving] = useState(false);
  const [bridgeError, setBridgeError] = useState<string | null>(null);

  const galleryItems: GalleryItem[] = useMemo(() => {
    const tg: GalleryItem[] = tgBots.map((bot) => ({ kind: "telegram", bot }));
    const ch: GalleryItem[] = channels.map((channel) => ({
      kind: "channel",
      channel,
    }));
    return [...tg, ...ch];
  }, [tgBots, channels]);

  const bridgeOptions = useMemo(() => {
    const opts: Array<{ key: string; label: string; platform: MessengerPlatform }> =
      [];
    for (const bot of tgBots) {
      opts.push({
        key: memberKey("telegram", bot.id),
        label: `Telegram · ${telegramTitle(bot)}`,
        platform: "telegram",
      });
    }
    for (const ch of channels) {
      opts.push({
        key: memberKey(ch.platform, ch.id),
        label: `${platformLabel(ch.platform)} · ${channelTitle(ch)}`,
        platform: ch.platform,
      });
    }
    return opts;
  }, [tgBots, channels]);

  async function reloadAll(next?: {
    telegramId?: string;
    channelId?: string;
  }) {
    if (!accessToken) return;
    setLoading(true);
    setListError(null);
    try {
      const [tg, ch, br] = await Promise.all([
        listTelegramBots(accessToken),
        listMessengerChannels(accessToken),
        listMessengerBridges(accessToken),
      ]);
      setTgBots(tg.items ?? []);
      setChannels(ch.items ?? []);
      setBridges(br.items ?? []);

      if (next?.telegramId) {
        setSelectedTelegramId(next.telegramId);
        setSelectedChannelId("");
        setPanelMode("telegram");
      } else if (next?.channelId) {
        setSelectedChannelId(next.channelId);
        setSelectedTelegramId("");
        setPanelMode("channel");
      } else {
        if (
          selectedTelegramId &&
          !(tg.items ?? []).some((b) => b.id === selectedTelegramId)
        ) {
          setSelectedTelegramId("");
          if (panelMode === "telegram") setPanelMode("none");
        }
        if (
          selectedChannelId &&
          !(ch.items ?? []).some((c) => c.id === selectedChannelId)
        ) {
          setSelectedChannelId("");
          if (panelMode === "channel") setPanelMode("none");
        }
      }
    } catch (e: unknown) {
      const err = e as { response?: { data?: { message?: string } }; message?: string };
      setListError(
        err?.response?.data?.message ||
          err?.message ||
          "Не удалось загрузить ботов",
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void reloadAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [accessToken]);

  useEffect(() => {
    if (!selectedTelegram || panelMode !== "telegram") return;
    setBotPatch({
      title: selectedTelegram.title ?? "",
      ownerTelegramId: selectedTelegram.ownerTelegramId ?? "",
      adminTelegramId: selectedTelegram.adminTelegramId ?? "",
      groupChatId: selectedTelegram.groupChatId ?? "",
      attendanceThreadId: selectedTelegram.attendanceThreadId ?? "",
      announcementsThreadId: selectedTelegram.announcementsThreadId ?? "",
      defaultProjectSlug: selectedTelegram.defaultProjectSlug ?? "",
      quizGroupChatId: selectedTelegram.quizGroupChatId ?? "",
      quizThreadId: selectedTelegram.quizThreadId ?? "",
    });
    setTestChatId(selectedTelegram.groupChatId ?? "");
  }, [selectedTelegram, panelMode]);

  useEffect(() => {
    if (!selectedChannel || panelMode !== "channel") return;
    setChannelPatch({
      title: selectedChannel.title ?? "",
      chatId: selectedChannel.chatId ?? "",
      vkConfirmation: "",
    });
    setTestChatId(selectedChannel.chatId ?? "");
  }, [selectedChannel, panelMode]);

  async function reloadVars() {
    if (!accessToken || !selectedTelegramId || panelMode !== "telegram") return;
    setVarsLoading(true);
    setVarsError(null);
    try {
      const data = await listBotVariables(accessToken, selectedTelegramId);
      setVars(data.items ?? []);
    } catch (e: unknown) {
      const err = e as { response?: { data?: { message?: string } }; message?: string };
      setVarsError(
        err?.response?.data?.message ||
          err?.message ||
          "Не удалось загрузить переменные",
      );
    } finally {
      setVarsLoading(false);
    }
  }

  useEffect(() => {
    if (panelMode !== "telegram" || !selectedTelegramId) {
      setVars([]);
      return;
    }
    void reloadVars();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [accessToken, selectedTelegramId, panelMode]);

  const openTelegram = (id: string) => {
    setSelectedTelegramId(id);
    setSelectedChannelId("");
    setPanelMode("telegram");
  };

  const openChannel = (id: string) => {
    setSelectedChannelId(id);
    setSelectedTelegramId("");
    setPanelMode("channel");
  };

  const openConnect = () => {
    setSelectedTelegramId("");
    setSelectedChannelId("");
    setPanelMode("connect");
    setConnectError(null);
    setConnectHint(null);
  };

  const handleConnect = async () => {
    if (!accessToken) return;
    const token = connectToken.trim();
    if (!token) return;

    setConnectLoading(true);
    setConnectError(null);
    setConnectHint(null);
    try {
      if (connectPlatform === "telegram") {
        if (token === "BOT_TOKENS_KEY") {
          setConnectError(
            "Нужен токен из BotFather (123456:AA...), не имя переменной.",
          );
          return;
        }
        if (!looksLikeTelegramBotToken(token)) {
          setConnectError(
            'Токен Telegram должен выглядеть как "123456789:AA...".',
          );
          return;
        }
        const res = await connectTelegramBot(accessToken, {
          token,
          title: connectTitle.trim() || undefined,
        });
        setConnectToken("");
        setConnectTitle("");
        await reloadAll({ telegramId: res.id });
        return;
      }

      if (connectPlatform === "vk" && !connectVkGroupId.trim()) {
        setConnectError("Укажите ID сообщества VK.");
        return;
      }

      const res = await connectMessengerChannel(accessToken, {
        platform: connectPlatform,
        token,
        title: connectTitle.trim() || undefined,
        chatId: connectChatId.trim() || undefined,
        vkGroupId:
          connectPlatform === "vk" ? connectVkGroupId.trim() : undefined,
      });
      setConnectToken("");
      setConnectTitle("");
      setConnectChatId("");
      setConnectVkGroupId("");
      if (res.webhookHint) {
        setConnectHint(
          `Webhook: ${res.webhookHint}${
            res.vkConfirmation
              ? ` · confirmation: ${res.vkConfirmation}`
              : ""
          }`,
        );
      }
      await reloadAll({ channelId: res.id });
    } catch (e: unknown) {
      const err = e as { response?: { data?: { message?: string } }; message?: string };
      setConnectError(
        err?.response?.data?.message ||
          err?.message ||
          "Не удалось подключить",
      );
    } finally {
      setConnectLoading(false);
    }
  };

  const handleSaveTelegram = async () => {
    if (!accessToken || !selectedTelegramId) return;
    setBotPatchSaving(true);
    setBotPatchError(null);
    try {
      await updateTelegramBot(accessToken, selectedTelegramId, {
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
      await reloadAll({ telegramId: selectedTelegramId });
    } catch (e: unknown) {
      const err = e as { response?: { data?: { message?: string } }; message?: string };
      setBotPatchError(
        err?.response?.data?.message ||
          err?.message ||
          "Не удалось сохранить",
      );
    } finally {
      setBotPatchSaving(false);
    }
  };

  const handleSaveChannel = async () => {
    if (!accessToken || !selectedChannelId) return;
    setChannelSaving(true);
    setChannelError(null);
    try {
      await updateMessengerChannel(accessToken, selectedChannelId, {
        title: channelPatch.title.trim() || null,
        chatId: channelPatch.chatId.trim() || null,
        vkConfirmation: channelPatch.vkConfirmation.trim() || null,
      });
      await reloadAll({ channelId: selectedChannelId });
    } catch (e: unknown) {
      const err = e as { response?: { data?: { message?: string } }; message?: string };
      setChannelError(
        err?.response?.data?.message ||
          err?.message ||
          "Не удалось сохранить",
      );
    } finally {
      setChannelSaving(false);
    }
  };

  const handleDeleteTelegram = async () => {
    if (!accessToken || !selectedTelegramId) return;
    if (!window.confirm("Удалить подключение Telegram-бота?")) return;
    try {
      await deleteTelegramBot(accessToken, selectedTelegramId);
      setSelectedTelegramId("");
      setPanelMode("none");
      await reloadAll();
    } catch (e: unknown) {
      const err = e as { response?: { data?: { message?: string } }; message?: string };
      alert(err?.response?.data?.message || err?.message || "Ошибка удаления");
    }
  };

  const handleDeleteChannel = async () => {
    if (!accessToken || !selectedChannelId) return;
    if (!window.confirm("Удалить подключение канала?")) return;
    try {
      await deleteMessengerChannel(accessToken, selectedChannelId);
      setSelectedChannelId("");
      setPanelMode("none");
      await reloadAll();
    } catch (e: unknown) {
      const err = e as { response?: { data?: { message?: string } }; message?: string };
      alert(err?.response?.data?.message || err?.message || "Ошибка удаления");
    }
  };

  const handleCreateVar = async () => {
    if (!accessToken || !selectedTelegramId) return;
    const key = newVarKey.trim();
    if (!key) return;
    setNewVarSaving(true);
    setNewVarError(null);
    try {
      await upsertBotVariable(accessToken, selectedTelegramId, key, {
        value: newVarValue,
        isSecret: newVarIsSecret,
      });
      setNewVarKey("");
      setNewVarValue("");
      setNewVarIsSecret(false);
      await reloadVars();
    } catch (e: unknown) {
      const err = e as { response?: { data?: { message?: string } }; message?: string };
      setNewVarError(
        err?.response?.data?.message ||
          err?.message ||
          "Не удалось сохранить переменную",
      );
    } finally {
      setNewVarSaving(false);
    }
  };

  const handleDeleteVar = async (key: string) => {
    if (!accessToken || !selectedTelegramId) return;
    if (!window.confirm(`Удалить переменную "${key}"?`)) return;
    try {
      await deleteBotVariable(accessToken, selectedTelegramId, key);
      await reloadVars();
    } catch (e: unknown) {
      const err = e as { response?: { data?: { message?: string } }; message?: string };
      alert(err?.response?.data?.message || err?.message || "Ошибка");
    }
  };

  const handleSendTest = async () => {
    if (!accessToken) return;
    setTestLoading(true);
    setTestError(null);
    setTestOk(null);
    try {
      if (panelMode === "telegram" && selectedTelegramId) {
        await sendTelegramBotTestMessage(accessToken, selectedTelegramId, {
          chatId: testChatId.trim(),
          text: testText,
        });
      } else if (panelMode === "channel" && selectedChannelId) {
        await sendMessengerTestMessage(accessToken, selectedChannelId, {
          chatId: testChatId.trim() || undefined,
          text: testText,
        });
      } else {
        return;
      }
      setTestOk("Отправлено");
    } catch (e: unknown) {
      const err = e as { response?: { data?: { message?: string } }; message?: string };
      setTestError(
        err?.response?.data?.message ||
          err?.message ||
          "Не удалось отправить",
      );
    } finally {
      setTestLoading(false);
    }
  };

  const parseMemberKey = (
    key: string,
  ): {
    platform: MessengerPlatform;
    telegramBotId?: string;
    channelId?: string;
  } | null => {
    const [platform, id] = key.split(":");
    if (!id) return null;
    if (platform === "telegram")
      return { platform: "telegram", telegramBotId: id };
    if (platform === "max" || platform === "vk")
      return { platform, channelId: id };
    return null;
  };

  const handleCreateBridge = async () => {
    if (!accessToken) return;
    const primary = parseMemberKey(bridgePrimaryKey);
    if (!primary) {
      setBridgeError("Выберите primary-канал");
      return;
    }
    const mirrors = bridgeMirrorKeys
      .filter((k) => k !== bridgePrimaryKey)
      .map(parseMemberKey)
      .filter(Boolean) as Array<{
      platform: MessengerPlatform;
      telegramBotId?: string;
      channelId?: string;
    }>;
    if (mirrors.length === 0) {
      setBridgeError("Добавьте хотя бы одно зеркало");
      return;
    }
    setBridgeSaving(true);
    setBridgeError(null);
    try {
      await createMessengerBridge(accessToken, {
        title: bridgeTitle.trim() || undefined,
        primary,
        mirrors,
      });
      setBridgeTitle("");
      setBridgePrimaryKey("");
      setBridgeMirrorKeys([]);
      await reloadAll();
    } catch (e: unknown) {
      const err = e as { response?: { data?: { message?: string } }; message?: string };
      setBridgeError(
        err?.response?.data?.message ||
          err?.message ||
          "Не удалось создать мост",
      );
    } finally {
      setBridgeSaving(false);
    }
  };

  const toggleMirrorKey = (key: string) => {
    setBridgeMirrorKeys((prev) =>
      prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key],
    );
  };

  const showConnectPanel = panelMode === "connect";
  const showTelegramPanel = panelMode === "telegram" && selectedTelegram;
  const showChannelPanel = panelMode === "channel" && selectedChannel;

  const tokenPlaceholder =
    connectPlatform === "telegram"
      ? "Токен BotFather"
      : connectPlatform === "max"
        ? "Токен Max (Authorization)"
        : "Токен сообщества VK";

  return (
    <div className="settings-tab-page settings-bot-tab">
      <section className="settings-card settings-bot-section">
        <div className="settings-bot-gallery-head">
          <h3 className="settings-card__title settings-bot-gallery-head__title">
            Боты
          </h3>
          <Button
            type="button"
            onClick={() => void reloadAll()}
            disabled={loading}
          >
            {loading ? "Обновляем…" : "Обновить"}
          </Button>
        </div>

        {listError ? (
          <div className="settings-invite-error">{listError}</div>
        ) : null}

        {loading && galleryItems.length === 0 ? (
          <PageLoader variant="view" label="Загрузка ботов…" />
        ) : (
          <div className="settings-bot-gallery">
            {galleryItems.map((item) => {
              if (item.kind === "telegram") {
                const isActive =
                  panelMode === "telegram" &&
                  selectedTelegramId === item.bot.id;
                return (
                  <button
                    key={`tg-${item.bot.id}`}
                    type="button"
                    className={cn(
                      "settings-bot-card",
                      isActive && "settings-bot-card--active",
                    )}
                    onClick={() => openTelegram(item.bot.id)}
                  >
                    <span className="settings-bot-card__platform">
                      Telegram
                    </span>
                    <span className="settings-bot-card__title">
                      {telegramTitle(item.bot)}
                    </span>
                    <span className="settings-bot-card__meta">
                      {item.bot.botUsername
                        ? `@${item.bot.botUsername}`
                        : item.bot.status}
                    </span>
                  </button>
                );
              }
              const isActive =
                panelMode === "channel" &&
                selectedChannelId === item.channel.id;
              return (
                <button
                  key={`ch-${item.channel.id}`}
                  type="button"
                  className={cn(
                    "settings-bot-card",
                    isActive && "settings-bot-card--active",
                  )}
                  onClick={() => openChannel(item.channel.id)}
                >
                  <span className="settings-bot-card__platform">
                    {platformLabel(item.channel.platform)}
                  </span>
                  <span className="settings-bot-card__title">
                    {channelTitle(item.channel)}
                  </span>
                  <span className="settings-bot-card__meta">
                    {item.channel.chatId
                      ? `chat ${item.channel.chatId}`
                      : item.channel.status}
                  </span>
                </button>
              );
            })}
            <button
              type="button"
              className={cn(
                "settings-bot-card",
                "settings-bot-card--connect",
                showConnectPanel && "settings-bot-card--active",
              )}
              onClick={openConnect}
            >
              <span className="settings-bot-card__title">+ Подключить</span>
              <span className="settings-bot-card__meta">
                Telegram · Max · VK
              </span>
            </button>
          </div>
        )}
      </section>

      {showConnectPanel ? (
        <section className="settings-card settings-bot-section">
          <h3 className="settings-card__title">Подключить бота</h3>
          <div className="settings-bot-platform-tabs">
            {(["telegram", "max", "vk"] as ConnectPlatform[]).map((p) => (
              <button
                key={p}
                type="button"
                className={cn(
                  "settings-bot-platform-tab",
                  connectPlatform === p && "settings-bot-platform-tab--active",
                )}
                onClick={() => setConnectPlatform(p)}
              >
                {platformLabel(p)}
              </button>
            ))}
          </div>
          <div className="settings-invite-row settings-bot-row">
            <input
              type="text"
              className="settings-invite-input"
              value={connectTitle}
              onChange={(e) => setConnectTitle(e.target.value)}
              placeholder="Название"
            />
            <input
              type="password"
              className="settings-invite-input settings-bot-token"
              value={connectToken}
              onChange={(e) => setConnectToken(e.target.value)}
              placeholder={tokenPlaceholder}
            />
            {connectPlatform === "vk" ? (
              <input
                type="text"
                className="settings-invite-input"
                value={connectVkGroupId}
                onChange={(e) => setConnectVkGroupId(e.target.value)}
                placeholder="ID сообщества"
              />
            ) : null}
            {connectPlatform !== "telegram" ? (
              <input
                type="text"
                className="settings-invite-input"
                value={connectChatId}
                onChange={(e) => setConnectChatId(e.target.value)}
                placeholder={
                  connectPlatform === "max" ? "chat_id" : "peer_id чата"
                }
              />
            ) : null}
            <Button
              type="button"
              className="primary"
              onClick={handleConnect}
              disabled={connectLoading || !connectToken.trim()}
            >
              {connectLoading ? "Подключаем…" : "Подключить"}
            </Button>
          </div>
          <p className="settings-sync-hint">
            {connectPlatform === "telegram"
              ? "Токен из @BotFather. Хранится зашифрованным."
              : connectPlatform === "max"
                ? "Токен из кабинета MAX для партнёров после модерации бота."
                : "Ключ доступа сообщества VK с правом messages. Укажите ID группы."}
          </p>
          {connectHint ? (
            <p className="settings-sync-hint">{connectHint}</p>
          ) : null}
          {connectError ? (
            <div className="settings-invite-error">{connectError}</div>
          ) : null}
        </section>
      ) : null}

      {showTelegramPanel && selectedTelegram ? (
        <>
          <section className="settings-card settings-bot-section">
            <div className="settings-bot-detail-head">
              <div className="settings-bot-detail-head__text">
                <h3 className="settings-card__title settings-bot-detail-head__title">
                  {telegramTitle(selectedTelegram)}
                </h3>
                <p className="settings-sync-hint">
                  Telegram · @
                  {selectedTelegram.botUsername || "—"} · id{" "}
                  {selectedTelegram.botTelegramUserId || "—"}
                </p>
              </div>
              <Button
                type="button"
                className="danger"
                onClick={handleDeleteTelegram}
              >
                Удалить
              </Button>
            </div>

            <h4 className="settings-bot-subheading">Публикация</h4>
            <div className="settings-bot-props">
              {(
                [
                  ["title", "Название", "title"],
                  ["ownerTelegramId", "Владелец", "telegram id"],
                  ["adminTelegramId", "Админ", "telegram id"],
                  ["groupChatId", "Группа", "-100…"],
                  ["attendanceThreadId", "Посещаемость", "thread id"],
                  ["announcementsThreadId", "Анонсы", "thread id"],
                  ["defaultProjectSlug", "Проект", "slug"],
                  ["quizGroupChatId", "Quiz-группа", "-100…"],
                  ["quizThreadId", "Quiz-тред", "thread id"],
                ] as const
              ).map(([field, label, placeholder]) => (
                <label key={field} className="settings-bot-prop">
                  <span className="settings-bot-prop__key" title={field}>
                    {label}
                  </span>
                  <input
                    type="text"
                    value={botPatch[field]}
                    onChange={(e) =>
                      setBotPatch((s) => ({ ...s, [field]: e.target.value }))
                    }
                    placeholder={placeholder}
                  />
                </label>
              ))}
            </div>
            <div className="settings-invite-row settings-bot-row settings-bot-row--footer">
              <Button
                type="button"
                className="primary"
                onClick={handleSaveTelegram}
                disabled={botPatchSaving}
              >
                {botPatchSaving ? "Сохраняем…" : "Сохранить"}
              </Button>
              {botPatchError ? (
                <div className="settings-invite-error settings-invite-error--flush">
                  {botPatchError}
                </div>
              ) : null}
            </div>
          </section>

          <section className="settings-card settings-bot-section">
            <h3 className="settings-card__title">Переменные</h3>
            <div className="settings-invite-row settings-bot-row">
              <input
                type="text"
                className="settings-invite-input"
                value={newVarKey}
                onChange={(e) => setNewVarKey(e.target.value)}
                placeholder="key"
              />
              <input
                type={newVarIsSecret ? "password" : "text"}
                className="settings-invite-input"
                value={newVarValue}
                onChange={(e) => setNewVarValue(e.target.value)}
                placeholder="value"
              />
              <LabeledCheckbox
                className="settings-bot-checkbox"
                checked={newVarIsSecret}
                onChange={setNewVarIsSecret}
              >
                Секрет
              </LabeledCheckbox>
              <Button
                type="button"
                className="primary"
                onClick={handleCreateVar}
                disabled={newVarSaving || !newVarKey.trim()}
              >
                {newVarSaving ? "Сохраняем…" : "Добавить"}
              </Button>
            </div>
            {newVarError ? (
              <div className="settings-invite-error">{newVarError}</div>
            ) : null}
            {varsLoading ? (
              <PageLoader variant="view" label="Загрузка…" />
            ) : varsError ? (
              <div className="settings-invite-error">{varsError}</div>
            ) : vars.length === 0 ? (
              <p className="settings-sync-hint">Переменных пока нет.</p>
            ) : (
              <ul className="settings-bot-vars">
                {vars.map((v) => (
                  <li key={v.id} className="settings-bot-var-row">
                    <code className="settings-bot-var-key">{v.key}</code>
                    <span className="settings-bot-var-value">
                      {v.isSecret ? "(секрет)" : v.value}
                    </span>
                    <Buttons.DeleteButton
                      type="button"
                      className="settings-member-remove settings-bot-var-remove"
                      onClick={() => handleDeleteVar(v.key)}
                      aria-label={`Удалить ${v.key}`}
                      title="Удалить"
                    />
                  </li>
                ))}
              </ul>
            )}
          </section>
        </>
      ) : null}

      {showChannelPanel && selectedChannel ? (
        <section className="settings-card settings-bot-section">
          <div className="settings-bot-detail-head">
            <div className="settings-bot-detail-head__text">
              <h3 className="settings-card__title settings-bot-detail-head__title">
                {channelTitle(selectedChannel)}
              </h3>
              <p className="settings-sync-hint">
                {platformLabel(selectedChannel.platform)}
                {selectedChannel.externalUsername
                  ? ` · ${selectedChannel.externalUsername}`
                  : ""}
                {selectedChannel.vkGroupId
                  ? ` · group ${selectedChannel.vkGroupId}`
                  : ""}
              </p>
            </div>
            <Button
              type="button"
              className="danger"
              onClick={handleDeleteChannel}
            >
              Удалить
            </Button>
          </div>
          <div className="settings-bot-props">
            <label className="settings-bot-prop">
              <span className="settings-bot-prop__key">Название</span>
              <input
                type="text"
                value={channelPatch.title}
                onChange={(e) =>
                  setChannelPatch((s) => ({ ...s, title: e.target.value }))
                }
              />
            </label>
            <label className="settings-bot-prop">
              <span className="settings-bot-prop__key">
                {selectedChannel.platform === "max" ? "chat_id" : "peer_id"}
              </span>
              <input
                type="text"
                value={channelPatch.chatId}
                onChange={(e) =>
                  setChannelPatch((s) => ({ ...s, chatId: e.target.value }))
                }
              />
            </label>
            {selectedChannel.platform === "vk" ? (
              <label className="settings-bot-prop">
                <span className="settings-bot-prop__key">confirmation</span>
                <input
                  type="text"
                  value={channelPatch.vkConfirmation}
                  onChange={(e) =>
                    setChannelPatch((s) => ({
                      ...s,
                      vkConfirmation: e.target.value,
                    }))
                  }
                  placeholder="строка Callback API"
                />
              </label>
            ) : null}
          </div>
          <div className="settings-invite-row settings-bot-row settings-bot-row--footer">
            <Button
              type="button"
              className="primary"
              onClick={handleSaveChannel}
              disabled={channelSaving}
            >
              {channelSaving ? "Сохраняем…" : "Сохранить"}
            </Button>
            {channelError ? (
              <div className="settings-invite-error settings-invite-error--flush">
                {channelError}
              </div>
            ) : null}
          </div>
        </section>
      ) : null}

      {showTelegramPanel || showChannelPanel ? (
        <section className="settings-card settings-bot-section">
          <h3 className="settings-card__title">Тестовое сообщение</h3>
          <div className="settings-bot-grid">
            <label className="settings-bot-field">
              <span className="settings-bot-field__label">chat / peer</span>
              <input
                type="text"
                value={testChatId}
                onChange={(e) => setTestChatId(e.target.value)}
              />
            </label>
            <label className="settings-bot-field settings-bot-field--wide">
              <span className="settings-bot-field__label">Текст</span>
              <textarea
                value={testText}
                onChange={(e) => setTestText(e.target.value)}
                rows={3}
              />
            </label>
          </div>
          <div className="settings-invite-row settings-bot-row settings-bot-row--footer">
            <Button
              type="button"
              className="primary"
              onClick={handleSendTest}
              disabled={
                testLoading || !testChatId.trim() || !testText.trim()
              }
            >
              {testLoading ? "Отправляем…" : "Отправить"}
            </Button>
            {testOk ? (
              <span className="settings-bot-ok" role="status">
                {testOk}
              </span>
            ) : null}
            {testError ? (
              <div className="settings-invite-error settings-invite-error--flush">
                {testError}
              </div>
            ) : null}
          </div>
        </section>
      ) : null}

      <section className="settings-card settings-bot-section">
        <h3 className="settings-card__title">Синхронизация групп</h3>
        <p className="settings-sync-hint">
          Один primary-источник. Сообщения людей из его чата копируются в
          зеркала (без эха от ботов).
        </p>

        {bridges.length > 0 ? (
          <ul className="settings-bot-bridges">
            {bridges.map((b) => {
              const primary = b.members.find((m) => m.role === "primary");
              const mirrors = b.members.filter((m) => m.role === "mirror");
              return (
                <li key={b.id} className="settings-bot-bridge-row">
                  <div className="settings-bot-bridge-row__main">
                    <strong>{b.title || "Мост"}</strong>
                    <span className="settings-sync-hint">
                      {b.enabled ? "вкл" : "выкл"} · primary{" "}
                      {primary ? platformLabel(primary.platform) : "—"} →{" "}
                      {mirrors.map((m) => platformLabel(m.platform)).join(", ") ||
                        "—"}
                    </span>
                  </div>
                  <div className="settings-bot-bridge-row__actions">
                    <Button
                      type="button"
                      onClick={() => {
                        if (!accessToken) return;
                        void updateMessengerBridge(accessToken, b.id, {
                          enabled: !b.enabled,
                        }).then(() => reloadAll());
                      }}
                    >
                      {b.enabled ? "Выкл" : "Вкл"}
                    </Button>
                    <Buttons.DeleteButton
                      type="button"
                      className="settings-member-remove"
                      onClick={() => {
                        if (!accessToken) return;
                        if (!window.confirm("Удалить мост?")) return;
                        void deleteMessengerBridge(accessToken, b.id).then(() =>
                          reloadAll(),
                        );
                      }}
                      aria-label="Удалить мост"
                      title="Удалить"
                    />
                  </div>
                </li>
              );
            })}
          </ul>
        ) : (
          <p className="settings-sync-hint">Мостов пока нет.</p>
        )}

        <h4 className="settings-bot-subheading">Новый мост</h4>
        <div className="settings-invite-row settings-bot-row">
          <input
            type="text"
            className="settings-invite-input"
            value={bridgeTitle}
            onChange={(e) => setBridgeTitle(e.target.value)}
            placeholder="Название моста"
          />
        </div>
        <label className="settings-bot-field">
          <span className="settings-bot-field__label">Primary</span>
          <select
            value={bridgePrimaryKey}
            onChange={(e) => setBridgePrimaryKey(e.target.value)}
          >
            <option value="">Выберите канал</option>
            {bridgeOptions.map((o) => (
              <option key={o.key} value={o.key}>
                {o.label}
              </option>
            ))}
          </select>
        </label>
        <div className="settings-bot-mirror-list">
          <span className="settings-bot-field__label">Зеркала</span>
          {bridgeOptions
            .filter((o) => o.key !== bridgePrimaryKey)
            .map((o) => {
              const checked = bridgeMirrorKeys.includes(o.key);
              return (
                <LabeledCheckbox
                  key={o.key}
                  className="settings-bot-checkbox"
                  checked={checked}
                  onChange={() => toggleMirrorKey(o.key)}
                >
                  {o.label}
                </LabeledCheckbox>
              );
            })}
        </div>
        <div className="settings-invite-row settings-bot-row settings-bot-row--footer">
          <Button
            type="button"
            className="primary"
            onClick={handleCreateBridge}
            disabled={bridgeSaving || bridgeOptions.length < 2}
          >
            {bridgeSaving ? "Создаём…" : "Создать мост"}
          </Button>
          {bridgeError ? (
            <div className="settings-invite-error settings-invite-error--flush">
              {bridgeError}
            </div>
          ) : null}
        </div>
      </section>
    </div>
  );
}
