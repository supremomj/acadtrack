'use client';
import { useState } from 'react';
import {
  Save,
  Download,
  Bell,
  Shield,
  Trash2,
  Monitor,
  Sun,
  Moon,
  CheckCheck,
  Database,
} from 'lucide-react';
import { useWorkspace } from './workspace-provider';
import { Button } from './ui/button';
import { Field } from './editors';
import { PageHeading, Empty } from './dashboard';
import { downloadJSON, dateLabel } from '@/lib/utils';
import { emptyData, type Preferences } from '@/lib/types';
import { browserClient } from '@/lib/supabase/client';
import { useTheme } from './theme-provider';
export function Settings() {
  const { theme, setTheme } = useTheme();
  const { data, mode, preferences, notify, replaceLocal, userEmail } = useWorkspace(),
    [p, setP] = useState<Preferences>({ ...data.preferences, theme }),
    [intervals, setIntervals] = useState(p.reminder_hours.join(', ')),
    [busy, setBusy] = useState(false);
  const patch = (part: Partial<Preferences>) => setP((p) => ({ ...p, ...part }));
  async function enablePush() {
    try {
      if (mode !== 'cloud')
        throw new Error('Push notifications require a connected Supabase workspace.');
      if (!('serviceWorker' in navigator) || !('PushManager' in window))
        throw new Error('Push notifications are not supported by this browser.');
      const key = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
      if (!key) throw new Error('Configure the VAPID keys on your server first.');
      const granted = await Notification.requestPermission();
      if (granted !== 'granted')
        throw new Error('Browser notification permission was not granted.');
      const registration = await navigator.serviceWorker.register('/sw.js');
      await navigator.serviceWorker.ready;
      const raw = atob(key.replace(/-/g, '+').replace(/_/g, '/'));
      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: Uint8Array.from(raw, (c) => c.charCodeAt(0)),
      });
      const r = await fetch('/api/push', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(subscription),
        }),
        result = await r.json();
      if (!r.ok) throw new Error(result.error);
      const next = { ...p, browser_notifications: true };
      setP(next);
      await preferences(next);
    } catch (e) {
      notify((e as Error).message);
    }
  }
  return (
    <>
      <PageHeading
        eyebrow="MAKE IT YOURS"
        title="A workspace that feels like you."
        description="Small preferences that make a big difference to your day."
      />
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          setBusy(true);
          await preferences({
            ...p,
            theme,
            reminder_hours: intervals.split(',').map((s) => Number(s.trim())),
          });
          setBusy(false);
        }}
      >
        <section className="panel settings-section">
          <div>
            <h2>Your profile & appearance</h2>
            <p>How you show up in your workspace.</p>
          </div>
          <div className="form-grid">
            <Field label="Your name">
              <input
                required
                maxLength={100}
                value={p.display_name}
                onChange={(e) => patch({ display_name: e.target.value })}
              />
            </Field>
            <Field label="Timezone">
              <input
                required
                list="timezones"
                value={p.timezone}
                onChange={(e) => patch({ timezone: e.target.value })}
              />
              <datalist id="timezones">
                {[
                  'Asia/Manila',
                  'Asia/Singapore',
                  'Asia/Tokyo',
                  'America/New_York',
                  'America/Los_Angeles',
                  'Europe/London',
                  'Australia/Sydney',
                  'UTC',
                ].map((t) => (
                  <option key={t}>{t}</option>
                ))}
              </datalist>
            </Field>
            <Field label="Theme">
              <select
                value={theme}
                onChange={(e) => {
                  const next = e.target.value as Preferences['theme'];
                  patch({ theme: next });
                  setTheme(next);
                }}
              >
                <option value="light">Light</option>
                <option value="dark">Dark</option>
                <option value="system">System preference</option>
              </select>
            </Field>
            <Field label="Week starts on">
              <select value={p.week_start} onChange={(e) => patch({ week_start: +e.target.value })}>
                <option value={1}>Monday</option>
                <option value={0}>Sunday</option>
              </select>
            </Field>
            <Field label="Time format">
              <select
                value={p.time_format}
                onChange={(e) =>
                  patch({ time_format: e.target.value as Preferences['time_format'] })
                }
              >
                <option value="12h">12-hour</option>
                <option value="24h">24-hour</option>
              </select>
            </Field>
            <Field label="Date format">
              <select
                value={p.date_format}
                onChange={(e) =>
                  patch({ date_format: e.target.value as Preferences['date_format'] })
                }
              >
                <option value="medium">Nov 2, 2026</option>
                <option value="short">11/2/26</option>
              </select>
            </Field>
            <Field label="Default task priority">
              <select
                value={p.default_priority}
                onChange={(e) =>
                  patch({ default_priority: e.target.value as Preferences['default_priority'] })
                }
              >
                {['Auto', 'Critical', 'High', 'Medium', 'Low'].map((v) => (
                  <option key={v}>{v}</option>
                ))}
              </select>
            </Field>
          </div>
        </section>
        <section className="panel settings-section">
          <div>
            <h2>Study preferences</h2>
            <p>Your planner works around your life.</p>
          </div>
          <div className="form-grid">
            <Field label="Available study days" wide>
              <div className="day-picker">
                {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((d, i) => (
                  <button
                    type="button"
                    aria-pressed={p.study_days.includes(i)}
                    key={d}
                    className={p.study_days.includes(i) ? 'selected' : ''}
                    onClick={() =>
                      patch({
                        study_days: p.study_days.includes(i)
                          ? p.study_days.filter((n) => n !== i)
                          : [...p.study_days, i],
                      })
                    }
                  >
                    {d}
                  </button>
                ))}
              </div>
            </Field>
            <Field label="Preferred start time">
              <input
                type="time"
                required
                value={p.study_start}
                onChange={(e) => patch({ study_start: e.target.value })}
              />
            </Field>
            <Field label="Preferred end time">
              <input
                type="time"
                required
                value={p.study_end}
                onChange={(e) => patch({ study_end: e.target.value })}
              />
            </Field>
            <Field label="Daily study limit (hours)">
              <input
                type="number"
                required
                min={0.25}
                max={16}
                step={0.25}
                value={p.daily_hours}
                onChange={(e) => patch({ daily_hours: +e.target.value })}
              />
            </Field>
            <Field label="Session length (minutes)">
              <input
                type="number"
                required
                min={5}
                max={180}
                value={p.session_minutes}
                onChange={(e) => patch({ session_minutes: +e.target.value })}
              />
            </Field>
            <Field label="Break length (minutes)">
              <input
                type="number"
                required
                min={0}
                max={60}
                value={p.break_minutes}
                onChange={(e) => patch({ break_minutes: +e.target.value })}
              />
            </Field>
          </div>
        </section>
        <section className="panel settings-section">
          <div>
            <h2>Reminders & notifications</h2>
            <p>A helpful nudge, right when you need it.</p>
          </div>
          <div>
            <Field label="Hours before deadline, separated by commas">
              <input required value={intervals} onChange={(e) => setIntervals(e.target.value)} />
            </Field>
            <p className="small muted">
              Default: 168, 72, 24, 6, 1. Generated by the server scheduler in cloud mode.
            </p>
            <label className="check-label">
              <input
                type="checkbox"
                checked={p.email_notifications}
                onChange={(e) => patch({ email_notifications: e.target.checked })}
              />
              Email reminders (requires configured email provider)
            </label>
            <label className="check-label">
              <input
                type="checkbox"
                checked={p.browser_notifications}
                onChange={(e) => patch({ browser_notifications: e.target.checked })}
              />
              Browser push notifications
            </label>
            <Button type="button" variant="outline" size="sm" onClick={enablePush}>
              <Bell size={14} />
              Enable this browser
            </Button>
          </div>
        </section>
        <section className="panel settings-section">
          <div>
            <h2>Grading preferences</h2>
            <p>Use the scale your institution actually uses.</p>
          </div>
          <div className="form-grid">
            <Field label="Target percentage">
              <input
                type="number"
                required
                min={0}
                max={100}
                value={p.target_grade}
                onChange={(e) => patch({ target_grade: +e.target.value })}
              />
            </Field>
            <Field label="Your grade scale / interpretation" wide>
              <textarea
                value={p.grading_scale}
                onChange={(e) => patch({ grading_scale: e.target.value })}
              />
            </Field>
          </div>
        </section>
        <div className="settings-save">
          <Button disabled={busy}>
            <Save size={16} />
            {busy ? 'Saving…' : 'Save preferences'}
          </Button>
        </div>
      </form>
      <section className="panel settings-section">
        <div>
          <h2>Data & account</h2>
          <p>{mode === 'cloud' ? userEmail : 'Local workspace · stored in this browser'}</p>
        </div>
        <div className="account-actions">
          <Button variant="outline" onClick={() => downloadJSON(data)}>
            <Download size={15} />
            Export all data
          </Button>
          {mode === 'cloud' ? (
            <>
              <Button
                variant="outline"
                onClick={async () => {
                  await browserClient().auth.signOut();
                  location.href = '/login';
                }}
              >
                Sign out
              </Button>
              <Button
                variant="destructive"
                onClick={async () => {
                  if (
                    prompt(
                      'This permanently deletes your account and all data. Type DELETE to continue.',
                    ) !== 'DELETE'
                  )
                    return;
                  const r = await fetch('/api/account', { method: 'DELETE' }),
                    result = await r.json();
                  if (r.ok) location.href = '/login';
                  else notify(result.error);
                }}
              >
                <Trash2 size={14} />
                Delete account
              </Button>
            </>
          ) : (
            <>
              <Button
                variant="destructive"
                onClick={() => {
                  if (
                    confirm(
                      'Permanently clear all local workspace data? Export it first if you need a backup.',
                    )
                  ) {
                    replaceLocal(emptyData());
                    localStorage.removeItem('acadtrack.timer.local');
                    notify('Local workspace cleared');
                  }
                }}
              >
                Clear local data
              </Button>
              <p className="small muted">
                Add Supabase environment variables and run the migration to enable secure cloud
                accounts. Local records stay in this browser; use Export to keep a backup.
              </p>
            </>
          )}
        </div>
      </section>
    </>
  );
}
export function Notifications({ openTask }: { openTask: (id: string) => void }) {
  const { data, save } = useWorkspace();
  const notices = [...data.notifications].sort((a, b) => b.created_at.localeCompare(a.created_at));
  return (
    <>
      <PageHeading
        eyebrow="A HELPFUL HEADS-UP"
        title="Stay one step ahead."
        description="Your reminders and updates, all in one place."
        action={
          <Button
            variant="outline"
            onClick={async () => {
              for (const n of notices.filter((n) => !n.read))
                await save('notifications', { ...n, read: true });
            }}
          >
            <CheckCheck size={16} />
            Mark all as read
          </Button>
        }
      />
      <section className="panel">
        {notices.length ? (
          notices.map((n) => (
            <div key={n.id} className={`notification-row ${n.read ? 'read' : ''}`}>
              <span className="session-icon">
                <Bell size={17} />
              </span>
              <button
                onClick={() => {
                  void save('notifications', { ...n, read: true });
                  if (n.task_id) openTask(n.task_id);
                }}
              >
                <strong>{n.title}</strong>
                <p>{n.body}</p>
                <small>{dateLabel(n.created_at, data.preferences.timezone, true)}</small>
              </button>
              <button
                className="text-link"
                onClick={() => void save('notifications', { ...n, read: !n.read })}
              >
                {n.read ? 'Mark unread' : 'Mark read'}
              </button>
            </div>
          ))
        ) : (
          <Empty
            title="You’re all caught up"
            body="Deadline reminders appear here when your cloud scheduler runs. Configure reminders in Settings."
          />
        )}
      </section>
    </>
  );
}
