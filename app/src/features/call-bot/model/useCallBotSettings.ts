import { useCallback, useEffect, useState } from "react";
import { useAuth } from "../../auth/model/auth-context";
import {
  listTelegramBots,
  remindMonthAvailability,
  updateTelegramBot,
  type TelegramBotIntegrationSummary,
} from "../../../sync/api/telegram-bots";

export type CallNotifyMode = "on_publish" | "same_day" | "advance";

export type CallBotSettingsDraft = {
  callNotifyMode: CallNotifyMode;
  callNotifyAdvanceDays: number;
  callNotifyHour: number;
  availabilityRemindEnabled: boolean;
};

const EMPTY_DRAFT: CallBotSettingsDraft = {
  callNotifyMode: "on_publish",
  callNotifyAdvanceDays: 1,
  callNotifyHour: 12,
  availabilityRemindEnabled: false,
};

function parseMode(raw: unknown): CallNotifyMode {
  if (raw === "same_day" || raw === "advance" || raw === "on_publish") {
    return raw;
  }
  return "on_publish";
}

function draftFromBot(bot: TelegramBotIntegrationSummary): CallBotSettingsDraft {
  const advanceDays = Number(bot.callNotifyAdvanceDays);
  const hour = Number(bot.callNotifyHour);
  return {
    callNotifyMode: parseMode(bot.callNotifyMode),
    callNotifyAdvanceDays:
      Number.isFinite(advanceDays) && advanceDays >= 1 && advanceDays <= 14
        ? Math.round(advanceDays)
        : 1,
    callNotifyHour:
      Number.isFinite(hour) && hour >= 0 && hour <= 23 ? Math.round(hour) : 12,
    availabilityRemindEnabled: Boolean(bot.availabilityRemindEnabled),
  };
}

export function useCallBotSettings(isOpen: boolean) {
  const { accessToken } = useAuth();
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [reminding, setReminding] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [bot, setBot] = useState<TelegramBotIntegrationSummary | null>(null);
  const [draft, setDraft] = useState<CallBotSettingsDraft>(EMPTY_DRAFT);

  const load = useCallback(async () => {
    if (!accessToken) return;
    setLoading(true);
    setError(null);
    setMessage(null);
    try {
      const data = await listTelegramBots(accessToken);
      const connected =
        data.items.find((item) => item.status === "connected") ??
        data.items[0] ??
        null;
      setBot(connected);
      setDraft(connected ? draftFromBot(connected) : EMPTY_DRAFT);
    } catch {
      setError("Не удалось загрузить настройки бота");
    } finally {
      setLoading(false);
    }
  }, [accessToken]);

  useEffect(() => {
    if (!isOpen) return;
    void load();
  }, [isOpen, load]);

  const save = async () => {
    if (!accessToken || !bot) return;
    setSaving(true);
    setError(null);
    setMessage(null);
    try {
      await updateTelegramBot(accessToken, bot.id, {
        callNotifyMode: draft.callNotifyMode,
        callNotifyAdvanceDays: draft.callNotifyAdvanceDays,
        callNotifyHour: draft.callNotifyHour,
        availabilityRemindEnabled: draft.availabilityRemindEnabled,
      });
      setMessage("Настройки сохранены");
    } catch {
      setError("Не удалось сохранить настройки бота");
    } finally {
      setSaving(false);
    }
  };

  const remindNow = async () => {
    if (!accessToken || !bot) return;
    setReminding(true);
    setError(null);
    setMessage(null);
    try {
      const result = await remindMonthAvailability(accessToken, bot.id);
      const sent = Number(result.sentCount || 0);
      const total = Number(result.totalWithoutAvailability || 0);
      if (total === 0) {
        setMessage("У всех в труппе занятость на месяц заполнена, либо нет Telegram");
      } else {
        setMessage(`Напомнил в личку: ${sent} из ${total}`);
      }
    } catch {
      setError("Не удалось отправить напоминания о занятости");
    } finally {
      setReminding(false);
    }
  };

  return {
    loading,
    saving,
    reminding,
    error,
    message,
    bot,
    draft,
    setDraft,
    save,
    remindNow,
  };
}
