'use client';
import { createContext, useContext, useState, useEffect, useRef, type ReactNode } from 'react';
import { emptyData, type Data, type Table, type EntityMap, type Preferences } from '@/lib/types';
import { schemas, preferenceSchema } from '@/lib/schemas';
import { overlaps, zonedDate, zonedParts } from '@/lib/academic';
import { uid } from '@/lib/utils';
import { useTheme } from './theme-provider';
const key = 'acadtrack.workspace.v1';
type Context = {
  data: Data;
  mode: 'local' | 'cloud';
  loading: boolean;
  error: string;
  toast: string;
  userEmail: string;
  isAdmin: boolean;
  save: <K extends Table>(table: K, record: EntityMap[K]) => Promise<boolean>;
  remove: (table: Table, id: string) => Promise<boolean>;
  preferences: (p: Preferences) => Promise<boolean>;
  reload: () => Promise<void>;
  replaceLocal: (data: Data) => void;
  notify: (s: string) => void;
};
const WorkspaceContext = createContext<Context | null>(null);
export function WorkspaceProvider({ children }: { children: ReactNode }) {
  const { applyAccountTheme } = useTheme();
  const [data, setData] = useState<Data>(emptyData),
    [mode, setMode] = useState<'local' | 'cloud'>('local'),
    [loading, setLoading] = useState(true),
    [error, setError] = useState(''),
    [toast, setToast] = useState(''),
    [userEmail, setEmail] = useState(''),
    [isAdmin, setIsAdmin] = useState(false);
  const current = useRef(data);
  current.current = data;
  function notify(s: string) {
    setToast(s);
  }
  async function reload() {
    setError('');
    try {
      const res = await fetch('/api/data');
      const result = await res.json();
      if (!res.ok) throw new Error(result.error);
      setMode(result.mode);
      if (result.mode === 'cloud') {
        setData(result.data);
        setEmail(result.user.email);
        setIsAdmin(!!result.user.is_admin);
      } else {
        const stored = localStorage.getItem(key);
        if (stored) {
          const parsed = JSON.parse(stored);
          setData({
            ...emptyData(),
            ...parsed,
            preferences: { ...emptyData().preferences, ...parsed.preferences },
          });
        }
      }
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => {
    void reload();
  }, []);
  useEffect(() => {
    if (!loading && mode === 'local') {
      try {
        localStorage.setItem(key, JSON.stringify(data));
      } catch {
        setError('Browser storage is full. Export your data before closing this page.');
      }
    }
    const p = data.preferences;
    if (!loading) applyAccountTheme(p.theme);
    document.documentElement.dataset.dateFormat = p.date_format;
    document.documentElement.dataset.timeFormat = p.time_format;
  }, [data, loading, mode, applyAccountTheme]);
  useEffect(() => {
    if (loading) return;
    const timer = setInterval(() => {
      if (mode === 'cloud') void reload();
      else setData((d) => ({ ...d }));
    }, 60000);
    return () => clearInterval(timer);
  }, [mode, loading]);
  useEffect(() => {
    if (toast) {
      const t = setTimeout(() => setToast(''), 4500);
      return () => clearTimeout(t);
    }
  }, [toast]);
  async function request(body: unknown) {
    const res = await fetch('/api/records', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const result = await res.json();
    if (!res.ok) throw new Error(result.error);
  }
  async function save<K extends Table>(table: K, record: EntityMap[K]) {
    try {
      schemas[table].parse(record);
      if (table === 'study_sessions') {
        const s = record as EntityMap['study_sessions'];
        if (s.status === 'Planned') {
          const p = current.current.preferences,
            parts = zonedParts(new Date(s.starts_at), p.timezone),
            day = `${parts.year}-${parts.month}-${parts.day}`,
            weekday = new Date(`${day}T12:00:00Z`).getUTCDay();
          const classes = current.current.class_schedules
            .filter((c) => c.weekday === weekday)
            .map((c) => ({
              starts_at: zonedDate(day, c.start_time.slice(0, 5), p.timezone).toISOString(),
              ends_at: zonedDate(day, c.end_time.slice(0, 5), p.timezone).toISOString(),
            }));
          if (
            [
              ...current.current.study_sessions.filter(
                (t) => t.id !== s.id && t.status === 'Planned',
              ),
              ...current.current.calendar_events,
              ...classes,
            ].some((t) => overlaps(s, t))
          )
            throw new Error('This session overlaps a class, event or study session.');
        }
      }
      if (table === 'calendar_events') {
        const event = record as EntityMap['calendar_events'];
        if (
          [
            ...current.current.calendar_events.filter((e) => e.id !== event.id),
            ...current.current.study_sessions.filter((s) => s.status === 'Planned'),
          ].some((block) => overlaps(event, block))
        )
          throw new Error('This event overlaps another event or a planned study session.');
      }
      if (table === 'grade_categories') {
        const c = record as EntityMap['grade_categories'];
        if (
          current.current.grade_categories
            .filter((g) => g.subject_id === c.subject_id && g.id !== c.id)
            .reduce((n, g) => n + g.weight, 0) +
            c.weight >
          100
        )
          throw new Error('Category weights cannot exceed 100%.');
      }
      if (mode === 'cloud') {
        await request({ table, action: 'save', record });
        await reload();
      } else
        setData((prev) => {
          const exists = prev[table].some((x) => x.id === record.id);
          return {
            ...prev,
            [table]: exists
              ? prev[table].map((x) => (x.id === record.id ? record : x))
              : [...prev[table], record],
            activity_history:
              table === 'activity_history'
                ? prev.activity_history
                : [
                    {
                      id: uid(),
                      title: `${exists ? 'Updated' : 'Added'} ${'title' in record ? record.title : 'name' in record ? record.name : table.replaceAll('_', ' ')}`,
                      created_at: new Date().toISOString(),
                    },
                    ...prev.activity_history,
                  ].slice(0, 200),
          };
        });
      notify('Saved to your workspace');
      return true;
    } catch (e) {
      notify((e as Error).message);
      return false;
    }
  }
  async function remove(table: Table, id: string) {
    try {
      if (mode === 'cloud') {
        await request({ table, action: 'delete', id });
        await reload();
      } else
        setData((prev) => {
          const next = structuredClone(prev);
          (next[table] as { id: string }[]) = (next[table] as { id: string }[]).filter(
            (x) => x.id !== id,
          );
          if (table === 'subjects') {
            const taskIds = next.tasks.filter((t) => t.subject_id === id).map((t) => t.id);
            next.tasks = next.tasks.filter((t) => t.subject_id !== id);
            next.subtasks = next.subtasks.filter((s) => !taskIds.includes(s.task_id));
            next.task_attachments = next.task_attachments.filter(
              (s) => !taskIds.includes(s.task_id),
            );
            next.study_sessions = next.study_sessions.map((s) =>
              taskIds.includes(s.task_id || '') ? { ...s, task_id: null } : s,
            );
            next.grades = next.grades.filter((g) => g.subject_id !== id);
            next.grade_categories = next.grade_categories.filter((g) => g.subject_id !== id);
            next.class_schedules = next.class_schedules.filter((c) => c.subject_id !== id);
            next.calendar_events = next.calendar_events.filter((e) => e.subject_id !== id);
          }
          if (table === 'tasks') {
            next.subtasks = next.subtasks.filter((s) => s.task_id !== id);
            next.task_attachments = next.task_attachments.filter((s) => s.task_id !== id);
            next.study_sessions = next.study_sessions.map((s) =>
              s.task_id === id ? { ...s, task_id: null } : s,
            );
          }
          if (table === 'grade_categories')
            next.grades = next.grades.filter((g) => g.category_id !== id);
          return next;
        });
      notify('Deleted');
      return true;
    } catch (e) {
      notify((e as Error).message);
      return false;
    }
  }
  async function preferences(p: Preferences) {
    try {
      preferenceSchema.parse(p);
      if (mode === 'cloud') await request({ table: 'preferences', record: p });
      setData((d) => ({ ...d, preferences: p }));
      notify('Preferences saved');
      return true;
    } catch (e) {
      notify((e as Error).message);
      return false;
    }
  }
  return (
    <WorkspaceContext.Provider
      value={{
        data,
        mode,
        loading,
        error,
        toast,
        userEmail,
        isAdmin,
        save,
        remove,
        preferences,
        reload,
        replaceLocal: (d) => {
          if (mode === 'local') setData(d);
        },
        notify,
      }}
    >
      {children}
      <div role="status" aria-live="polite" className={`toast ${toast ? 'visible' : ''}`}>
        {toast}
      </div>
    </WorkspaceContext.Provider>
  );
}
export function useWorkspace() {
  const ctx = useContext(WorkspaceContext);
  if (!ctx) throw new Error('Missing workspace provider');
  return ctx;
}
