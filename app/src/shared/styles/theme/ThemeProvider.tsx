import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import {
  createThemeId,
  deleteCustomTheme,
  getCustomThemes,
  upsertCustomTheme,
} from "../../settings/themePreferences";
import {
  applyTheme,
  bootstrapTheme,
  readCurrentThemeTokenValues,
  setActiveTheme,
} from "./apply-theme";
import type { CustomTheme, ThemeId } from "./types";

type ThemeContextValue = {
  activeThemeId: ThemeId;
  customThemes: CustomTheme[];
  setTheme: (id: ThemeId) => void;
  createCustomTheme: (name: string, variables?: Record<string, string>) => CustomTheme;
  updateCustomTheme: (theme: CustomTheme) => void;
  removeCustomTheme: (id: string) => void;
  duplicateAsCustomTheme: (name: string) => CustomTheme;
};

const ThemeContext = createContext<ThemeContextValue | null>(null);

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [activeThemeId, setActiveThemeIdState] = useState<ThemeId>(() => bootstrapTheme());
  const [customThemes, setCustomThemesState] = useState<CustomTheme[]>(() => getCustomThemes());

  useEffect(() => {
    const onThemeChange = (event: Event) => {
      const detail = (event as CustomEvent<{ themeId: ThemeId }>).detail;
      if (detail?.themeId) setActiveThemeIdState(detail.themeId);
    };
    window.addEventListener("orchestra-theme-change", onThemeChange);
    return () => window.removeEventListener("orchestra-theme-change", onThemeChange);
  }, []);

  const refreshCustomThemes = useCallback(() => {
    setCustomThemesState(getCustomThemes());
  }, []);

  const setTheme = useCallback((id: ThemeId) => {
    setActiveTheme(id);
    setActiveThemeIdState(id);
  }, []);

  const createCustomTheme = useCallback(
    (name: string, variables?: Record<string, string>) => {
      const now = Date.now();
      const theme: CustomTheme = {
        id: createThemeId(),
        name: name.trim() || "Новая тема",
        variables: variables ?? readCurrentThemeTokenValues(),
        createdAt: now,
        updatedAt: now,
      };
      upsertCustomTheme(theme);
      refreshCustomThemes();
      setTheme(`custom:${theme.id}`);
      return theme;
    },
    [refreshCustomThemes, setTheme],
  );

  const updateCustomTheme = useCallback(
    (theme: CustomTheme) => {
      upsertCustomTheme({ ...theme, updatedAt: Date.now() });
      refreshCustomThemes();
      if (activeThemeId === `custom:${theme.id}`) {
        applyTheme(`custom:${theme.id}`);
      }
    },
    [activeThemeId, refreshCustomThemes],
  );

  const removeCustomTheme = useCallback(
    (id: string) => {
      deleteCustomTheme(id);
      refreshCustomThemes();
      const nextActive = bootstrapTheme();
      setActiveThemeIdState(nextActive);
    },
    [refreshCustomThemes],
  );

  const duplicateAsCustomTheme = useCallback(
    (name: string) => createCustomTheme(name, readCurrentThemeTokenValues()),
    [createCustomTheme],
  );

  const value = useMemo(
    () => ({
      activeThemeId,
      customThemes,
      setTheme,
      createCustomTheme,
      updateCustomTheme,
      removeCustomTheme,
      duplicateAsCustomTheme,
    }),
    [
      activeThemeId,
      customThemes,
      createCustomTheme,
      duplicateAsCustomTheme,
      removeCustomTheme,
      setTheme,
      updateCustomTheme,
    ],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme must be used within ThemeProvider");
  return ctx;
}
