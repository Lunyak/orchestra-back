import { useEffect, useMemo, useState } from "react";
import { useAuth } from "../../auth";
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
import {
  type BotPatchState,
  type BridgeOption,
  type ChannelPatchState,
  type ConnectPlatform,
  type GalleryItem,
  type PanelMode,
  botPatchFromTelegram,
  channelPatchFromChannel,
  channelTitle,
  connectTokenPlaceholder,
  extractApiError,
  looksLikeTelegramBotToken,
  memberKey,
  parseMemberKey,
  platformLabel,
  telegramTitle,
} from "./settings-bot-helpers";

export function useSettingsBotTab() {
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

  const [botPatch, setBotPatch] = useState<BotPatchState>({
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

  const [channelPatch, setChannelPatch] = useState<ChannelPatchState>({
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

  const bridgeOptions: BridgeOption[] = useMemo(() => {
    const opts: BridgeOption[] = [];
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
      const nextTg = tg.items ?? [];
      const nextCh = ch.items ?? [];
      setTgBots(nextTg);
      setChannels(nextCh);
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
          !nextTg.some((b) => b.id === selectedTelegramId)
        ) {
          setSelectedTelegramId("");
          if (panelMode === "telegram") setPanelMode("none");
        }
        if (
          selectedChannelId &&
          !nextCh.some((c) => c.id === selectedChannelId)
        ) {
          setSelectedChannelId("");
          if (panelMode === "channel") setPanelMode("none");
        }
      }
    } catch (e: unknown) {
      setListError(extractApiError(e, "Не удалось загрузить ботов"));
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
    setBotPatch(botPatchFromTelegram(selectedTelegram));
    setTestChatId(selectedTelegram.groupChatId ?? "");
  }, [selectedTelegram, panelMode]);

  useEffect(() => {
    if (!selectedChannel || panelMode !== "channel") return;
    setChannelPatch(channelPatchFromChannel(selectedChannel));
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
      setVarsError(extractApiError(e, "Не удалось загрузить переменные"));
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
        const confirmationPart = res.vkConfirmation
          ? ` · confirmation: ${res.vkConfirmation}`
          : "";
        setConnectHint(`Webhook: ${res.webhookHint}${confirmationPart}`);
      }
      await reloadAll({ channelId: res.id });
    } catch (e: unknown) {
      setConnectError(extractApiError(e, "Не удалось подключить"));
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
      setBotPatchError(extractApiError(e, "Не удалось сохранить"));
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
      setChannelError(extractApiError(e, "Не удалось сохранить"));
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
      alert(extractApiError(e, "Ошибка удаления"));
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
      alert(extractApiError(e, "Ошибка удаления"));
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
      setNewVarError(extractApiError(e, "Не удалось сохранить переменную"));
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
      alert(extractApiError(e, "Ошибка"));
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
      setTestError(extractApiError(e, "Не удалось отправить"));
    } finally {
      setTestLoading(false);
    }
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
      .filter((m): m is NonNullable<typeof m> => Boolean(m));
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
      setBridgeError(extractApiError(e, "Не удалось создать мост"));
    } finally {
      setBridgeSaving(false);
    }
  };

  const toggleMirrorKey = (key: string) => {
    setBridgeMirrorKeys((prev) =>
      prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key],
    );
  };

  const handleToggleBridge = async (bridgeId: string, enabled: boolean) => {
    if (!accessToken) return;
    await updateMessengerBridge(accessToken, bridgeId, { enabled: !enabled });
    await reloadAll();
  };

  const handleDeleteBridge = async (bridgeId: string) => {
    if (!accessToken) return;
    if (!window.confirm("Удалить мост?")) return;
    await deleteMessengerBridge(accessToken, bridgeId);
    await reloadAll();
  };

  const showConnectPanel = panelMode === "connect";
  const showTelegramPanel = panelMode === "telegram" && selectedTelegram;
  const showChannelPanel = panelMode === "channel" && selectedChannel;
  const showTestPanel = Boolean(showTelegramPanel || showChannelPanel);
  const tokenPlaceholder = connectTokenPlaceholder(connectPlatform);
  const canConnect = Boolean(connectToken.trim());
  const canSendTest = Boolean(testChatId.trim() && testText.trim());
  const canCreateVar = Boolean(newVarKey.trim());
  const canCreateBridge = bridgeOptions.length >= 2;

  return {
    loading,
    listError,
    galleryItems,
    panelMode,
    selectedTelegramId,
    selectedChannelId,
    showConnectPanel,
    showTelegramPanel,
    showChannelPanel,
    showTestPanel,
    reloadAll,
    openTelegram,
    openChannel,
    openConnect,

    connectPlatform,
    setConnectPlatform,
    connectTitle,
    setConnectTitle,
    connectToken,
    setConnectToken,
    connectChatId,
    setConnectChatId,
    connectVkGroupId,
    setConnectVkGroupId,
    connectLoading,
    connectError,
    connectHint,
    tokenPlaceholder,
    canConnect,
    handleConnect,

    selectedTelegram,
    botPatch,
    setBotPatch,
    botPatchSaving,
    botPatchError,
    handleSaveTelegram,
    handleDeleteTelegram,

    vars,
    varsLoading,
    varsError,
    newVarKey,
    setNewVarKey,
    newVarValue,
    setNewVarValue,
    newVarIsSecret,
    setNewVarIsSecret,
    newVarSaving,
    newVarError,
    canCreateVar,
    handleCreateVar,
    handleDeleteVar,

    selectedChannel,
    channelPatch,
    setChannelPatch,
    channelSaving,
    channelError,
    handleSaveChannel,
    handleDeleteChannel,

    testChatId,
    setTestChatId,
    testText,
    setTestText,
    testLoading,
    testError,
    testOk,
    canSendTest,
    handleSendTest,

    bridges,
    bridgeOptions,
    bridgeTitle,
    setBridgeTitle,
    bridgePrimaryKey,
    setBridgePrimaryKey,
    bridgeMirrorKeys,
    bridgeSaving,
    bridgeError,
    canCreateBridge,
    toggleMirrorKey,
    handleCreateBridge,
    handleToggleBridge,
    handleDeleteBridge,
  };
}

export type SettingsBotTabVm = ReturnType<typeof useSettingsBotTab>;
