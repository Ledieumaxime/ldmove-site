import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { useLocation } from "react-router-dom";

/**
 * Light / dark for the app, and only for the app.
 *
 * The marketing site is white and sand on purpose and must never turn
 * dark, so the `dark` class goes on <html> only while the visitor is
 * inside /app, and comes straight back off on the way out. Putting it
 * on <html> rather than on a wrapper is what lets the page background,
 * the opening screen and the sign-in page follow too, instead of a dark
 * app arriving behind a white flash.
 *
 * The choice is per device, not per account: it is about the screen in
 * the hand, and a coach reviewing on a laptop at noon and on a phone at
 * night wants opposite answers. That is also why it lives in
 * localStorage and never goes to the server.
 */
const STORAGE_KEY = "ldmove-theme";

type Theme = "light" | "dark";

type ThemeValue = {
  theme: Theme;
  dark: boolean;
  setTheme: (t: Theme) => void;
  toggle: () => void;
};

const ThemeContext = createContext<ThemeValue>({
  theme: "light",
  dark: false,
  setTheme: () => {},
  toggle: () => {},
});

function readStored(): Theme {
  // Private windows and cleared site data both make this throw or come
  // back empty, and neither is a reason to fail to render.
  try {
    return localStorage.getItem(STORAGE_KEY) === "dark" ? "dark" : "light";
  } catch {
    return "light";
  }
}

export const ThemeProvider = ({ children }: { children: React.ReactNode }) => {
  const [theme, setThemeState] = useState<Theme>(readStored);
  const { pathname } = useLocation();
  const inApp = pathname.startsWith("/app");

  useEffect(() => {
    const root = document.documentElement;
    if (inApp && theme === "dark") root.classList.add("dark");
    else root.classList.remove("dark");
  }, [inApp, theme]);

  // Leaving the app entirely (or unmounting in a test) must not strand
  // the class on <html>.
  useEffect(() => () => document.documentElement.classList.remove("dark"), []);

  const setTheme = useCallback((t: Theme) => {
    setThemeState(t);
    try {
      localStorage.setItem(STORAGE_KEY, t);
    } catch {
      /* the theme still applies for this visit */
    }
  }, []);

  const value = useMemo<ThemeValue>(
    () => ({
      theme,
      dark: theme === "dark",
      setTheme,
      toggle: () => setTheme(theme === "dark" ? "light" : "dark"),
    }),
    [theme, setTheme]
  );

  return (
    <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
  );
};

export const useTheme = () => useContext(ThemeContext);
