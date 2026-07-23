/** Маршруты, на которых нужен список участников проекта (кэш RTK). */
export function shouldLoadProjectMembers(pathname: string): boolean {
  return (
    pathname === "/settings" ||
    pathname === "/board" ||
    pathname === "/tasks" ||
    pathname.startsWith("/tasks/") ||
    pathname === "/troupe" ||
    pathname === "/sessions" ||
    pathname.startsWith("/sessions/")
  );
}
