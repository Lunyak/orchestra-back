import { useState } from "react";
import type { PremiseMemberRole } from "../../../sync/api/premises";
import { extractError } from "./premise-detail-helpers";
import type { PremiseDetailData } from "./usePremiseDetailData";

export function usePremiseDetailMembers(input: {
  premiseId: string;
  addMember: PremiseDetailData["addMember"];
  addingMember: boolean;
  updateMember: PremiseDetailData["updateMember"];
  removeMember: PremiseDetailData["removeMember"];
}) {
  const { premiseId, addMember, addingMember, updateMember, removeMember } =
    input;

  const [memberEmail, setMemberEmail] = useState("");
  const [memberRole, setMemberRole] = useState<PremiseMemberRole>("tenant");
  const [memberCanBook, setMemberCanBook] = useState(true);
  const [memberError, setMemberError] = useState<string | null>(null);

  async function handleAddMember() {
    const email = memberEmail.trim();
    if (!email) return;
    setMemberError(null);
    try {
      await addMember({
        premiseId,
        body: { email, role: memberRole, canBook: memberCanBook },
      }).unwrap();
      setMemberEmail("");
    } catch (e: unknown) {
      setMemberError(extractError(e, "Не удалось добавить участника"));
    }
  }

  return {
    memberEmail,
    setMemberEmail,
    memberRole,
    setMemberRole,
    memberCanBook,
    setMemberCanBook,
    memberError,
    setMemberError,
    addingMember,
    updateMember,
    removeMember,
    handleAddMember,
  };
}
