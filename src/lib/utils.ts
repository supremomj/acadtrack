import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
export const uid = () => crypto.randomUUID();
export function dateLabel(value: string, timezone = 'Asia/Manila', withTime = false) {
  const prefs = typeof document !== 'undefined' ? document.documentElement.dataset : {};
  return new Intl.DateTimeFormat('en', {
    timeZone: timezone,
    month: prefs.dateFormat === 'short' ? 'numeric' : 'short',
    day: 'numeric',
    ...(withTime ? { hour: 'numeric', minute: '2-digit', hour12: prefs.timeFormat !== '24h' } : {}),
  }).format(new Date(value));
}
export function localInput(iso: string) {
  const d = new Date(iso);
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
}
export function downloadJSON(value: unknown) {
  const u = URL.createObjectURL(
    new Blob([JSON.stringify(value, null, 2)], { type: 'application/json' }),
  );
  const a = document.createElement('a');
  a.href = u;
  a.download = `acadtrack-export-${new Date().toISOString().slice(0, 10)}.json`;
  a.click();
  URL.revokeObjectURL(u);
}
