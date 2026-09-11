import { useEffect, useState } from "react";
import { nextScheduleRowSelection } from "./troupe-page-utils";

export function useScheduleRowSelection(members: { id: string }[]) {
  const [selectedMemberIds, setSelectedMemberIds] = useState<string[]>([]);
  const memberIdKey = members.map((member) => member.id).join("\n");

  useEffect(() => {
    const validIds = new Set(memberIdKey ? memberIdKey.split("\n") : []);
    setSelectedMemberIds((prev) => {
      const next = prev.filter((id) => validIds.has(id));
      return next.length === prev.length ? prev : next;
    });
  }, [memberIdKey]);

  const toggleMemberId = (id: string, shiftKey = false) => {
    setSelectedMemberIds((prev) =>
      nextScheduleRowSelection(prev, id, shiftKey),
    );
  };

  const clearMemberSelection = () => {
    setSelectedMemberIds([]);
  };

  useEffect(() => {
    if (selectedMemberIds.length === 0) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      event.preventDefault();
      setSelectedMemberIds([]);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [selectedMemberIds.length]);

  return {
    selectedMemberIds,
    toggleMemberId,
    clearMemberSelection,
  };
}
