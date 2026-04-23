import cn from "classnames";
import { useMemo } from "react";
import type { DirectorSlotRoleRehearsalPick } from "../../features/director-sessions/directorSessionsSync";
import { LabeledCheckbox } from "../../shared/core/labeled-checkbox/LabeledCheckbox";
import type { TeamProfile } from "../../sync/api";
import "./SlotRoleRehearsalPicker.css";

function normalizeEmail(v: string): string {
  return String(v ?? "")
    .trim()
    .toLowerCase();
}

function pickKey(roleKey: string, email: string): string {
  return `${roleKey}\0${normalizeEmail(email)}`;
}

function materializeAllChecked(
  roleKeys: string[],
  roleEmailsByKey: Record<string, string[]>,
): DirectorSlotRoleRehearsalPick[] {
  const out: DirectorSlotRoleRehearsalPick[] = [];
  for (const rk of roleKeys) {
    for (const em of roleEmailsByKey[rk] ?? []) {
      const e = normalizeEmail(em);
      if (!e) continue;
      out.push({ roleKey: rk, email: e, checked: true });
    }
  }
  return out;
}

function applyToggle(
  prev: DirectorSlotRoleRehearsalPick[] | undefined,
  roleKeys: string[],
  roleEmailsByKey: Record<string, string[]>,
  roleKey: string,
  email: string,
  checked: boolean,
): DirectorSlotRoleRehearsalPick[] {
  const base =
    prev && prev.length > 0
      ? [...prev]
      : materializeAllChecked(roleKeys, roleEmailsByKey);
  const pk = pickKey(roleKey, email);
  const map = new Map<string, DirectorSlotRoleRehearsalPick>();
  for (const p of base) {
    map.set(pickKey(p.roleKey, p.email), { ...p });
  }
  const cur = map.get(pk);
  if (cur) {
    cur.checked = checked;
  } else {
    map.set(pk, {
      roleKey,
      email: normalizeEmail(email),
      checked,
    });
  }
  return Array.from(map.values());
}

export type SlotRoleRehearsalPickerProps = {
  className?: string;
  roleKeys: string[];
  roleTitleByKey: Record<string, string>;
  roleEmailsByKey: Record<string, string[]>;
  picks: DirectorSlotRoleRehearsalPick[] | undefined;
  profiles: TeamProfile[];
  onPicksChange: (next: DirectorSlotRoleRehearsalPick[]) => void;
};

export function SlotRoleRehearsalPicker({
  className,
  roleKeys,
  roleTitleByKey,
  roleEmailsByKey,
  picks,
  profiles,
  onPicksChange,
}: SlotRoleRehearsalPickerProps) {
  const labelByEmail = useMemo(() => {
    const m = new Map<string, string>();
    for (const p of profiles ?? []) {
      const e = normalizeEmail(String((p as any)?.email ?? ""));
      if (!e) continue;
      const dn = String((p as any)?.displayName ?? "").trim();
      m.set(e, dn || e);
    }
    return m;
  }, [profiles]);

  const effectivePicks = useMemo(() => {
    if (picks && picks.length > 0) return picks;
    return materializeAllChecked(roleKeys, roleEmailsByKey);
  }, [picks, roleKeys, roleEmailsByKey]);

  const checkedByKey = useMemo(() => {
    const m = new Map<string, boolean>();
    for (const p of effectivePicks) {
      m.set(pickKey(p.roleKey, p.email), Boolean(p.checked));
    }
    return m;
  }, [effectivePicks]);

  if (roleKeys.length === 0) {
    return (
      <div className={cn("slot-role-rehearsal", className)}>
        <div className="slot-role-rehearsal__title">Кто репетирует в слоте</div>
        <div className="slot-role-rehearsal__empty">Нет ролей в материале.</div>
      </div>
    );
  }

  return (
    <div className={cn("slot-role-rehearsal", className)}>
      <div className="slot-role-rehearsal__title">Кто репетирует в слоте</div>
      {roleKeys.map((rk) => {
        const title =
          String(roleTitleByKey[rk] ?? rk).trim() || rk;
        const emails = [...(roleEmailsByKey[rk] ?? [])].map((x) =>
          normalizeEmail(String(x)),
        ).filter(Boolean);
        return (
          <div key={rk} className="slot-role-rehearsal__role">
            <div className="slot-role-rehearsal__role-title">{title}</div>
            {emails.length === 0 ? (
              <div className="slot-role-rehearsal__empty">
                Нет назначенных актёров на роль в проекте.
              </div>
            ) : (
              <div className="slot-role-rehearsal__list">
                {emails.map((em) => {
                  const checked = checkedByKey.get(pickKey(rk, em)) ?? false;
                  const label = labelByEmail.get(em) ?? em;
                  return (
                    <LabeledCheckbox
                      key={`${rk}:${em}`}
                      checked={checked}
                      onChange={(nextChecked) =>
                        onPicksChange(
                          applyToggle(
                            picks,
                            roleKeys,
                            roleEmailsByKey,
                            rk,
                            em,
                            nextChecked,
                          ),
                        )
                      }
                    >
                      <span title={em}>{label}</span>
                    </LabeledCheckbox>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
