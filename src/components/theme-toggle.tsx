'use client';
import { Moon, Sun } from 'lucide-react';
import { useTheme } from './theme-provider';
export function ThemeToggle() {
  const { resolvedTheme, setTheme, mounted } = useTheme(),
    dark = mounted && resolvedTheme === 'dark';
  return (
    <button
      type="button"
      className="icon-button theme-toggle"
      aria-label={dark ? 'Switch to light mode' : 'Switch to dark mode'}
      title={dark ? 'Switch to light mode' : 'Switch to dark mode'}
      disabled={!mounted}
      onClick={() => setTheme(dark ? 'light' : 'dark')}
    >
      {dark ? <Sun size={18} /> : <Moon size={18} />}
    </button>
  );
}
