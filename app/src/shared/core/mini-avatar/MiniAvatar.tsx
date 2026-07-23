import { useEffect, useMemo, useState } from "react";
import "./style.css";

function initialFromLabel(label: string): string {
  const s = String(label ?? "").trim();
  if (!s) return "?";
  const ch = s[0] ?? "?";
  return ch.toUpperCase();
}

export function MiniAvatar({
  src,
  label,
  size = 22,
  title,
}: {
  src?: string | null;
  label: string;
  size?: number;
  title?: string;
}) {
  const url = String(src ?? "").trim();
  const [broken, setBroken] = useState(false);

  useEffect(() => {
    setBroken(false);
  }, [url]);

  const placeholder = useMemo(() => initialFromLabel(label), [label]);

  const avatarSizeStyle = { "--mini-avatar-size": `${size}px` } as React.CSSProperties;

  if (!url || broken) {
    return (
      <span
        className="mini-avatar mini-avatar--placeholder"
        style={avatarSizeStyle}
        title={title ?? label}
        aria-label={label}
      >
        {placeholder}
      </span>
    );
  }

  return (
    <img
      className="mini-avatar"
      src={url}
      alt={label}
      title={title ?? label}
      style={avatarSizeStyle}
      loading="lazy"
      referrerPolicy="no-referrer"
      onError={() => setBroken(true)}
    />
  );
}
