import type { CustomSelectOption } from "./CustomSelect";

function normalizeSelectSearchText(value: unknown): string {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/ё/g, "е");
}

export function getCustomSelectOptionSearchHaystack(option: CustomSelectOption): string {
  const parts = [option.label, option.value, option.searchText].filter(Boolean);
  return normalizeSelectSearchText(parts.join(" "));
}

export function filterCustomSelectOptions(
  options: CustomSelectOption[],
  queryRaw: string,
): CustomSelectOption[] {
  const query = normalizeSelectSearchText(queryRaw);
  if (!query) return options;

  return options.filter((option) =>
    getCustomSelectOptionSearchHaystack(option).includes(query),
  );
}
