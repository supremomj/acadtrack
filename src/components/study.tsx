'use client';
import { useState, useEffect, useRef } from 'react';
import {
  Plus,
  Sparkles,
  Check,
  X,
  Clock3,
  Play,
  Pause,
  RotateCcw,
  ArrowRight,
  Target,
  Coffee,
  CheckCircle2,
} from 'lucide-react';
import { useWorkspace } from './workspace-provider';
import { Button } from './ui/button';
import { PageHeading, Empty, Progress, TaskRow } from './dashboard';
import { SessionEditor } from './editors';
import { suggestSessions, rankTask, atRisk } from '@/lib/academic';
import { dateLabel, uid } from '@/lib/utils';
import type { StudySession, Task } from '@/lib/types';
import { ReviewHistory } from './history';
export function StudyPlanner() {
  const { data, save, notify } = useWorkspace(),
    [suggestions, setSuggestions] = useState<StudySession[]>([]),
    [editor, setEditor] = useState<StudySession | null | undefined>(),
    [period, setPeriod] = useState('week'),
    [working, setWorking] = useState(false);
  const zone = data.preferences.timezone,
    dayKey = (s: string) =>
      new Intl.DateTimeFormat('en-CA', { timeZone: zone }).format(new Date(s)),
    today = dayKey(new Date().toISOString()),
    sessions = data.study_sessions
      .filter(
        (s) =>
          s.status !== 'Rejected' &&
          s.status !== 'Suggested' &&
          (period === 'day'
            ? dayKey(s.starts_at) === today
            : +new Date(s.starts_at) > Date.now() - 86400000 &&
              +new Date(s.starts_at) < Date.now() + 7 * 86400000),
      )
      .sort((a, b) => a.starts_at.localeCompare(b.starts_at));
  return (
    <>
      <PageHeading
        eyebrow="MAKE TIME FOR YOUR BEST WORK"
        title="A plan that fits your life."
        description="Balance your workload with a little breathing room."
        action={
          <Button onClick={() => setEditor(null)}>
            <Plus size={17} />
            Plan a session
          </Button>
        }
      />
      <div className="planner-banner">
        <div>
          <span className="eyebrow">YOUR PERSONAL STUDY ASSISTANT</span>
          <h2>Big goals. Manageable sessions.</h2>
          <p>We’ll find time around your classes, work remaining, and upcoming deadlines.</p>
          <span className="small muted">
            {data.preferences.session_minutes} min sessions · {data.preferences.break_minutes} min
            breaks · {data.preferences.daily_hours}h daily limit · {zone}
          </span>
        </div>
        <Button
          variant="outline"
          onClick={() => {
            const next = suggestSessions(data);
            setSuggestions(next);
            if (!next.length)
              notify(
                'No available slots before your deadlines. Adjust your study preferences or task estimates.',
              );
          }}
        >
          <Sparkles size={16} />
          Suggest my study plan
        </Button>
      </div>
      {suggestions.length > 0 && (
        <section className="panel">
          <div className="panel-heading">
            <h2>
              <Sparkles size={17} />
              Recommended for you <span className="count-pill">{suggestions.length}</span>
            </h2>
            <Button
              size="sm"
              disabled={working}
              onClick={async () => {
                setWorking(true);
                const failed = [];
                for (const s of suggestions) {
                  if (!(await save('study_sessions', { ...s, status: 'Planned' }))) failed.push(s);
                }
                setSuggestions(failed);
                setWorking(false);
              }}
            >
              Accept all
            </Button>
          </div>
          <p className="panel-padding small muted">
            Generated for the next 14 days. Accept, adjust, or dismiss each recommendation.
          </p>
          {suggestions.map((s) => (
            <div key={s.id} className="session-row">
              <span className="session-icon">
                <Sparkles size={18} />
              </span>
              <button
                onClick={() => {
                  setEditor({ ...s, status: 'Planned' });
                  setSuggestions((old) => old.filter((x) => x.id !== s.id));
                }}
              >
                <strong>{s.title}</strong>
                <small>
                  {dateLabel(s.starts_at, zone, true)} ·{' '}
                  {Math.round((+new Date(s.ends_at) - +new Date(s.starts_at)) / 60000)} min
                </small>
              </button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setEditor({ ...s, status: 'Planned' });
                  setSuggestions((old) => old.filter((x) => x.id !== s.id));
                }}
              >
                Adjust
              </Button>
              <Button
                variant="outline"
                size="icon"
                aria-label="Accept session"
                onClick={async () => {
                  if (await save('study_sessions', { ...s, status: 'Planned' }))
                    setSuggestions((old) => old.filter((x) => x.id !== s.id));
                }}
              >
                <Check size={16} />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                aria-label="Reject suggestion"
                onClick={() => setSuggestions((old) => old.filter((x) => x.id !== s.id))}
              >
                <X size={16} />
              </Button>
            </div>
          ))}
        </section>
      )}
      <div className="toolbar">
        <h2>Your study schedule</h2>
        <div className="view-switch">
          <button className={period === 'day' ? 'active' : ''} onClick={() => setPeriod('day')}>
            Today
          </button>
          <button className={period === 'week' ? 'active' : ''} onClick={() => setPeriod('week')}>
            Next 7 days
          </button>
        </div>
      </div>
      <section className="panel">
        {sessions.length ? (
          sessions.map((s) => (
            <div key={s.id} className="session-row">
              <span className={`session-icon ${s.status === 'Completed' ? 'green' : ''}`}>
                {s.status === 'Completed' ? <CheckCircle2 size={18} /> : <Clock3 size={18} />}
              </span>
              <button onClick={() => setEditor(s)}>
                <strong>{s.title}</strong>
                <small>
                  {dateLabel(s.starts_at, zone, true)} –{' '}
                  {new Intl.DateTimeFormat('en', {
                    timeZone: zone,
                    hour: 'numeric',
                    minute: '2-digit',
                  }).format(new Date(s.ends_at))}{' '}
                  · {s.status === 'Completed' ? `${s.actual_minutes} min studied` : s.status}
                </small>
              </button>
              {s.status === 'Planned' && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() =>
                    setEditor({
                      ...s,
                      status: 'Completed',
                      actual_minutes: Math.round(
                        (+new Date(s.ends_at) - +new Date(s.starts_at)) / 60000,
                      ),
                    })
                  }
                >
                  Complete
                </Button>
              )}
              <Button variant="ghost" size="sm" onClick={() => setEditor(s)}>
                Edit
              </Button>
            </div>
          ))
        ) : (
          <Empty
            title="Make a little space to study"
            body="Create a session or let your study assistant find a time for you."
            action={
              <Button variant="outline" onClick={() => setEditor(null)}>
                Plan a session
              </Button>
            }
          />
        )}
      </section>
      {editor !== undefined && (
        <SessionEditor
          key={editor?.id || 'new'}
          session={editor}
          onClose={() => setEditor(undefined)}
        />
      )}
    </>
  );
}
type TimerState = {
  id: string;
  mode: 'Focus' | 'Short break' | 'Long break';
  duration: number;
  remaining: number;
  running: boolean;
  ends: number | null;
  task_id: string;
  started_at: string | null;
  elapsed: number;
  round: number;
};
export function FocusMode() {
  const { data, save, notify } = useWorkspace(),
    [timer, setTimer] = useState<TimerState>({
      id: '',
      mode: 'Focus',
      duration: 25 * 60,
      remaining: 25 * 60,
      running: false,
      ends: null,
      task_id: '',
      started_at: null,
      elapsed: 0,
      round: 0,
    }),
    [ready, setReady] = useState(false),
    [custom, setCustom] = useState(25),
    [tick, setTick] = useState(Date.now());
  const completing = useRef(false);
  const storageKey = `acadtrack.timer.${data.preferences.id || 'local'}`;
  useEffect(() => {
    try {
      const t = localStorage.getItem(storageKey);
      if (t) setTimer(JSON.parse(t));
    } catch {}
    setReady(true);
  }, [storageKey]);
  useEffect(() => {
    if (ready) localStorage.setItem(storageKey, JSON.stringify(timer));
  }, [timer, ready, storageKey]);
  useEffect(() => {
    if (timer.running) {
      const i = setInterval(() => setTick(Date.now()), 500);
      return () => clearInterval(i);
    }
  }, [timer.running]);
  const remaining =
    timer.running && timer.ends
      ? Math.max(0, Math.ceil((timer.ends - tick) / 1000))
      : timer.remaining;
  useEffect(() => {
    if (!ready || !timer.running || remaining > 0 || completing.current) return;
    completing.current = true;
    void (async () => {
      let ok = true;
      if (timer.mode === 'Focus') {
        const end = new Date(timer.ends!).toISOString();
        ok = await save('study_sessions', {
          id: timer.id,
          task_id: timer.task_id || null,
          title: data.tasks.find((t) => t.id === timer.task_id)?.title || 'Focus session',
          starts_at:
            timer.started_at || new Date(timer.ends! - timer.duration * 1000).toISOString(),
          ends_at: end,
          status: 'Completed',
          actual_minutes: timer.duration / 60,
          kind: 'Focus',
        });
      }
      if (ok) {
        setTimer((t) => ({
          ...t,
          running: false,
          remaining: 0,
          ends: null,
          round: t.mode === 'Focus' ? t.round + 1 : t.round,
          elapsed: t.duration,
        }));
        notify(
          timer.mode === 'Focus'
            ? 'Focus session complete. Your time is saved. Take a well-earned break.'
            : 'Break complete. Ready for your next chapter?',
        );
      } else setTimer((t) => ({ ...t, running: false, remaining: 1, ends: null }));
      completing.current = false;
    })();
  }, [remaining, timer.running, ready]);
  function changeMode(mode: TimerState['mode'], minutes?: number) {
    if (timer.running && !confirm('Reset the current timer? Unsaved time will be discarded.'))
      return;
    const duration =
      (minutes || (mode === 'Focus' ? custom : mode === 'Short break' ? 5 : 15)) * 60;
    setTimer((t) => ({
      ...t,
      id: uid(),
      mode,
      duration,
      remaining: duration,
      running: false,
      ends: null,
      started_at: null,
      elapsed: 0,
    }));
  }
  function toggle() {
    if (timer.running) {
      setTimer((t) => ({
        ...t,
        running: false,
        remaining,
        ends: null,
        elapsed: t.duration - remaining,
      }));
    } else {
      const secs = remaining || timer.duration;
      setTick(Date.now());
      setTimer((t) => ({
        ...t,
        id: remaining === 0 ? uid() : t.id || uid(),
        running: true,
        remaining: secs,
        ends: Date.now() + secs * 1000,
        started_at:
          remaining === 0 ? new Date().toISOString() : t.started_at || new Date().toISOString(),
      }));
    }
  }
  const today = new Intl.DateTimeFormat('en-CA', { timeZone: data.preferences.timezone }).format(
      new Date(),
    ),
    done = data.study_sessions.filter(
      (s) =>
        s.kind === 'Focus' &&
        s.status === 'Completed' &&
        new Intl.DateTimeFormat('en-CA', { timeZone: data.preferences.timezone }).format(
          new Date(s.starts_at),
        ) === today,
    ),
    minutes = done.reduce((n, s) => n + s.actual_minutes, 0);
  return (
    <>
      <PageHeading
        eyebrow="LESS DISTRACTION. MORE INTENTION."
        title="Find your focus."
        description="You don’t have to do everything. Just the next thing."
      />
      <div className="focus-layout">
        <section className="panel timer-panel">
          <div className="view-switch">
            {(['Focus', 'Short break', 'Long break'] as const).map((m) => (
              <button
                className={timer.mode === m ? 'active' : ''}
                key={m}
                onClick={() => changeMode(m)}
              >
                {m === 'Focus' ? <Target size={15} /> : <Coffee size={15} />} {m}
              </button>
            ))}
          </div>
          <div
            className={`timer-circle ${timer.running ? 'running' : ''}`}
            style={
              {
                '--timer-progress': `${(1 - remaining / timer.duration) * 360}deg`,
              } as React.CSSProperties
            }
          >
            <div>
              <span className="eyebrow">
                {timer.running
                  ? 'YOU’RE MAKING PROGRESS'
                  : remaining === 0
                    ? 'NICELY DONE'
                    : 'ONE STEP AT A TIME'}
              </span>
              <strong>
                {Math.floor(remaining / 60)
                  .toString()
                  .padStart(2, '0')}
                <em>:</em>
                {(remaining % 60).toString().padStart(2, '0')}
              </strong>
              <span>
                {timer.mode === 'Focus' ? 'Time to do your best work' : 'Let your mind breathe'}
              </span>
            </div>
          </div>
          <div className="timer-actions">
            <Button
              variant="outline"
              size="icon"
              aria-label="Reset timer"
              onClick={() => changeMode(timer.mode)}
            >
              <RotateCcw size={18} />
            </Button>
            <Button className="timer-start" onClick={toggle}>
              {timer.running ? <Pause size={18} /> : <Play size={18} />}{' '}
              {timer.running
                ? 'Pause'
                : remaining === 0
                  ? 'Start again'
                  : timer.remaining < timer.duration
                    ? 'Resume'
                    : 'Start focusing'}
            </Button>
          </div>
          <div className="focus-task">
            <label>
              WHAT ARE YOU WORKING ON?
              <select
                disabled={timer.running || !!timer.started_at}
                value={timer.task_id}
                onChange={(e) => setTimer((t) => ({ ...t, task_id: e.target.value }))}
              >
                <option value="">A little general study</option>
                {data.tasks
                  .filter((t) => t.status !== 'Completed')
                  .map((t) => (
                    <option value={t.id} key={t.id}>
                      {t.title}
                    </option>
                  ))}
              </select>
            </label>
            <label>
              FOCUS DURATION (MINUTES)
              <div className="inline-form">
                <input
                  aria-label="Focus minutes"
                  type="number"
                  min={5}
                  max={180}
                  value={custom}
                  onChange={(e) => setCustom(+e.target.value)}
                />
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    if (custom >= 5 && custom <= 180) changeMode('Focus', custom);
                    else notify('Choose 5–180 minutes.');
                  }}
                >
                  Apply
                </Button>
              </div>
            </label>
          </div>
          <p className="small muted">
            Your timer resumes after refresh. Completed sessions are saved automatically.
          </p>
        </section>
        <aside>
          <section className="panel panel-padding">
            <span className="eyebrow">TODAY’S SMALL WINS</span>
            <h2>Showing up counts.</h2>
            <div className="focus-stat">
              <strong>{done.length}</strong>
              <span>focus sessions completed</span>
            </div>
            <div className="focus-stat">
              <strong>
                {Math.round(minutes)}
                <small> min</small>
              </strong>
              <span>of intentional study</span>
            </div>
            <Progress value={(minutes / (data.preferences.daily_hours * 60)) * 100} />
            <p className="small muted">Daily study goal: {data.preferences.daily_hours} hours</p>
          </section>
          <div className="focus-advice">
            <Sparkles size={22} />
            <h3>Protect your attention.</h3>
            <p>
              Put your phone away. Clear a little space. Take a breath. The rest can wait for 25
              minutes.
            </p>
            <small>After four focus sessions, try a longer break.</small>
          </div>
          <section className="panel panel-padding">
            <h3>Recent focus sessions</h3>
            {data.study_sessions
              .filter((s) => s.kind === 'Focus' && s.status === 'Completed')
              .sort((a, b) => b.starts_at.localeCompare(a.starts_at))
              .slice(0, 5)
              .map((s) => (
                <div className="focus-history" key={s.id}>
                  <span>
                    {s.title}
                    <small>{dateLabel(s.starts_at, data.preferences.timezone)}</small>
                  </span>
                  <b>{Math.round(s.actual_minutes)}m</b>
                </div>
              ))}
          </section>
        </aside>
      </div>
    </>
  );
}
export function WeeklyReview({
  editTask,
  openPlanner,
}: {
  editTask: (t: Task) => void;
  openPlanner: () => void;
}) {
  const { data } = useWorkspace(),
    now = new Date(),
    start = new Date(now);
  start.setDate(now.getDate() - ((now.getDay() - data.preferences.week_start + 7) % 7));
  start.setHours(0, 0, 0, 0);
  const done = data.tasks.filter((t) => t.completed_at && +new Date(t.completed_at) >= +start),
    pending = data.tasks
      .filter((t) => t.status !== 'Completed')
      .sort((a, b) => rankTask(b, data) - rankTask(a, data)),
    hours =
      data.study_sessions
        .filter((s) => s.status === 'Completed' && +new Date(s.starts_at) >= +start)
        .reduce((n, s) => n + s.actual_minutes, 0) / 60,
    upcoming = pending.filter(
      (t) => +new Date(t.due_at) > +now && +new Date(t.due_at) < +now + 7 * 86400000,
    ),
    risk = pending.filter((t) => atRisk(t, data));
  return (
    <>
      <PageHeading
        eyebrow="PAUSE. REFLECT. RESET."
        title="Your weekly check-in."
        description={`Week of ${dateLabel(start.toISOString(), data.preferences.timezone)} · A moment to see how far you’ve come.`}
        action={
          <Button onClick={openPlanner}>
            Plan next week
            <ArrowRight size={16} />
          </Button>
        }
      />
      <div className="review-hero">
        <Sparkles size={28} />
        <h2>
          {done.length
            ? 'Progress is progress. You’re moving forward.'
            : 'Every week is a chance to begin again.'}
        </h2>
        <p>
          You completed {done.length} tasks and made {hours.toFixed(1)} hours for focused study.
          Take that momentum into the week ahead.
        </p>
      </div>
      <div className="stats-grid">
        {[
          ['Completed this week', done.length],
          ['Still in progress', pending.length],
          ['Upcoming deadlines', upcoming.length],
          ['Subjects to watch', new Set(risk.map((t) => t.subject_id)).size],
        ].map(([l, v]) => (
          <div className="stat-card" key={l}>
            <span>{l}</span>
            <strong>{v}</strong>
          </div>
        ))}
      </div>
      <div className="two-columns">
        <section className="panel">
          <div className="panel-heading">
            <h2>Your small wins</h2>
            <CheckCircle2 size={18} className="green-text" />
          </div>
          {done.length ? (
            done.map((t) => <TaskRow key={t.id} task={t} onEdit={editTask} compact />)
          ) : (
            <div className="panel-padding muted">
              No completed tasks yet this week. Your first win is ahead.
            </div>
          )}
        </section>
        <section className="panel">
          <div className="panel-heading">
            <h2>Next week’s priorities</h2>
            <Target size={18} />
          </div>
          {pending.slice(0, 5).map((t) => (
            <TaskRow key={t.id} task={t} onEdit={editTask} compact />
          ))}
        </section>
      </div>
      <section className="panel panel-padding">
        <h2>Give these subjects a little attention</h2>
        {[...new Set(risk.map((t) => t.subject_id))].map((id) => (
          <p key={id || 'personal'}>
            <strong>{data.subjects.find((s) => s.id === id)?.name || 'Personal tasks'}</strong>
            <span className="muted">
              {' '}
              · {risk.filter((t) => t.subject_id === id).length} tasks at risk. Break down remaining
              work and reserve time in your planner.
            </span>
          </p>
        ))}
        {!risk.length && (
          <p className="muted">Your current study capacity looks sufficient for your deadlines.</p>
        )}
        <Button variant="outline" onClick={openPlanner}>
          Adjust your study plan
        </Button>
      </section>
      <ReviewHistory />
    </>
  );
}
