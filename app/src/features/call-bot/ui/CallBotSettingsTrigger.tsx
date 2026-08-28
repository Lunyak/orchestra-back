import { useState } from "react";
import { Button } from "@shared/core/button/Button";
import { CallBotSettingsModal } from "./CallBotSettingsModal";
import "./call-bot-settings.css";

type CallBotSettingsTriggerProps = {
  className?: string;
};

export function CallBotSettingsTrigger({
  className,
}: CallBotSettingsTriggerProps) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button
        type="button"
        className={className}
        title="Как бот шлёт вызов и напоминания"
        onClick={() => setOpen(true)}
      >
        Бот
      </Button>
      <CallBotSettingsModal isOpen={open} onClose={() => setOpen(false)} />
    </>
  );
}
