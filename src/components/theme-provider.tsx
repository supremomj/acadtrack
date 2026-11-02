'use client';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react';
export type ThemeMode = 'light' | 'dark' | 'system';
const storageKey = 'acadtrack.theme';
const valid = (value: unknown): value is ThemeMode =>
  value === 'light' || value === 'dark' || value === 'system';
const resolve = (theme: ThemeMode) =>
  theme === 'system'
    ? matchMedia('(prefers-color-scheme: dark)').matches
      ? 'dark'
      : 'light'
    : theme;
type ThemeContextValue = {
  theme: ThemeMode;
  resolvedTheme: 'light' | 'dark';
  mounted: boolean;
  setTheme: (mode: ThemeMode) => void;
  applyAccountTheme: (mode: ThemeMode) => void;
};
const ThemeContext = createContext<ThemeContextValue | null>(null);
export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setMode] = useState<ThemeMode>('system'),
    [resolvedTheme, setResolved] = useState<'light' | 'dark'>('light'),
    [mounted, setMounted] = useState(false);
  const explicitChoice = useRef(false);
  const apply = useCallback((mode: ThemeMode) => {
    const resolved = resolve(mode);
    document.documentElement.dataset.theme = resolved;
    setMode(mode);
    setResolved(resolved);
  }, []);
  useEffect(() => {
    let saved: string | null = null;
    try {
      saved = localStorage.getItem(storageKey);
    } catch {}
    explicitChoice.current = valid(saved);
    apply(valid(saved) ? saved : 'system');
    setMounted(true);
    const onStorage = (event: StorageEvent) => {
      if (event.key !== storageKey) return;
      explicitChoice.current = valid(event.newValue);
      apply(valid(event.newValue) ? event.newValue : 'system');
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, [apply]);
  useEffect(() => {
    if (theme !== 'system') return;
    const media = matchMedia('(prefers-color-scheme: dark)'),
      onChange = () => apply('system');
    media.addEventListener('change', onChange);
    return () => media.removeEventListener('change', onChange);
  }, [theme, apply]);
  const applyAccountTheme = useCallback(
    (mode: ThemeMode) => {
      if (!explicitChoice.current && valid(mode)) apply(mode);
    },
    [apply],
  );
  const setTheme = useCallback(
    (mode: ThemeMode) => {
      if (!valid(mode)) return;
      explicitChoice.current = true;
      apply(mode);
      try {
        localStorage.setItem(storageKey, mode);
      } catch {
        /* Theme still works for this visit when storage is blocked. */
      }
      if (
        location.pathname !== '/login' &&
        process.env.NEXT_PUBLIC_SUPABASE_URL &&
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
      ) {
        void fetch('/api/theme', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ theme: mode }),
        }).catch(() => {
          /* Keep the device preference when offline. */
        });
      }
    },
    [apply],
  );
  return (
    <ThemeContext.Provider value={{ theme, resolvedTheme, mounted, setTheme, applyAccountTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}
export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) throw new Error('Missing theme provider');
  return context;
}
