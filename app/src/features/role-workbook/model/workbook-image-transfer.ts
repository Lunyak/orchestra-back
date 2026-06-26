export function clipboardImageFile(data: DataTransfer | null | undefined): File | null {
  const directFile = Array.from(data?.files ?? []).find((file) =>
    String(file?.type ?? "").startsWith("image/"),
  );
  if (directFile) return directFile;
  const imageItem =
    Array.from(data?.items ?? []).find((item) =>
      String(item?.type ?? "").startsWith("image/"),
    ) ?? null;
  return imageItem?.getAsFile() ?? null;
}

export function imageFilesFromTransfer(data: DataTransfer | null | undefined): File[] {
  const byFiles = Array.from(data?.files ?? []).filter((file) =>
    String(file?.type ?? "").startsWith("image/"),
  );
  if (byFiles.length > 0) return byFiles;
  return Array.from(data?.items ?? [])
    .filter((item) => String(item?.type ?? "").startsWith("image/"))
    .map((item) => item.getAsFile())
    .filter((file): file is File => Boolean(file));
}

export function referenceColumnCount(total: number): number {
  if (total <= 4) return 1;
  if (total <= 8) return 2;
  if (total <= 12) return 3;
  return 4;
}

export function distributeIntoColumns<T>(items: T[], columnCount: number): T[][] {
  const safeColumnCount = Math.max(1, Math.min(columnCount, items.length || 1));
  const columns = Array.from({ length: safeColumnCount }, () => [] as T[]);
  items.forEach((item, idx) => {
    columns[idx % safeColumnCount].push(item);
  });
  return columns;
}
