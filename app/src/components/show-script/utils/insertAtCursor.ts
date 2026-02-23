export type InsertAtSelectionResult = {
  value: string;
  cursor: number;
};

type InsertAtSelectionParams = {
  value: string;
  insert: string;
  selectionStart?: number | null;
  selectionEnd?: number | null;
};

export function insertAtSelection({
  value,
  insert,
  selectionStart,
  selectionEnd,
}: InsertAtSelectionParams): InsertAtSelectionResult {
  const len = value.length;

  const rawStart = selectionStart ?? len;
  const rawEnd = selectionEnd ?? rawStart;

  const clamp = (n: number) => Math.max(0, Math.min(len, Math.trunc(n)));
  let start = clamp(rawStart);
  let end = clamp(rawEnd);
  if (end < start) [start, end] = [end, start];

  const nextValue = value.slice(0, start) + insert + value.slice(end);
  const cursor = start + insert.length;

  return { value: nextValue, cursor };
}
