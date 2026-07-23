import type { OrchestraQueryError } from "../../../shared/api/rtk/axios-base-query";

export function accountingListErrorMessage(
  error: OrchestraQueryError | undefined,
): string | null {
  if (!error) return null;

  if (error.status === 404) {
    return "API бухгалтерии не найден. Перезапустите бэкенд: cd back → npm run start:dev";
  }
  if (error.status === 401) {
    return "Нужно войти в аккаунт";
  }
  if (error.status === 500) {
    return "Ошибка сервера. Перезапустите бэкенд после миграции.";
  }

  const dataMessage =
    error.data &&
    typeof error.data === "object" &&
    "message" in error.data &&
    typeof (error.data as { message: unknown }).message === "string"
      ? (error.data as { message: string }).message
      : null;

  return (
    dataMessage ??
    error.message ??
    "Не удалось загрузить сборы. Перезапустите бэкенд и обновите страницу."
  );
}
