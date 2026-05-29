import { useCallback, useEffect, useState } from "react";
import {
  CHAT_DOCK_VISIBILITY_EVENT,
  readChatDockHidden,
  setChatDockHidden,
} from "./chat-dock-visibility";

export function useChatDockHidden() {
  const [chatDockHidden, setChatDockHiddenState] = useState(readChatDockHidden);

  useEffect(() => {
    const onVisibilityChange = (event: Event) => {
      const detail = (event as CustomEvent<{ hidden?: boolean }>).detail;
      setChatDockHiddenState(detail?.hidden ?? readChatDockHidden());
    };

    window.addEventListener(CHAT_DOCK_VISIBILITY_EVENT, onVisibilityChange);
    return () => window.removeEventListener(CHAT_DOCK_VISIBILITY_EVENT, onVisibilityChange);
  }, []);

  const toggleChatDock = useCallback(() => {
    const nextHidden = !readChatDockHidden();
    setChatDockHidden(nextHidden);
    setChatDockHiddenState(nextHidden);
  }, []);

  return { chatDockHidden, toggleChatDock };
}
