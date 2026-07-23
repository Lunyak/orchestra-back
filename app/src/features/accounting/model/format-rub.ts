const rubFormatter = new Intl.NumberFormat("ru-RU", {
  style: "currency",
  currency: "RUB",
  maximumFractionDigits: 0,
});

export function formatRub(amountRub: number): string {
  return rubFormatter.format(amountRub);
}

export function formatRubFromKopecks(amountKopecks: number): string {
  return formatRub(amountKopecks / 100);
}

export function parseRubInput(raw: string): number | null {
  const digits = raw.replace(/\s/g, "").replace(/[^\d]/g, "");
  if (!digits) return null;
  const value = Number(digits);
  if (!Number.isFinite(value) || value < 1) return null;
  return value;
}

export function collectionProgressPercent(paidRub: number, expectedRub: number): number {
  if (expectedRub <= 0) return 0;
  const ratio = paidRub / expectedRub;
  const percent = Math.round(ratio * 100);
  return Math.min(100, Math.max(0, percent));
}
