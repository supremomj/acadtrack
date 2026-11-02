'use client';
import { useState } from 'react';
import {
  ArrowUpRight,
  ArrowRight,
  Check,
  CheckCheck,
  ListTodo,
  Clock3,
  TriangleAlert,
  Flame,
  CalendarDays,
  BookOpen,
  MoreHorizontal,
  Sparkles,
  Target,
} from 'lucide-react';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
} from 'recharts';
import { useWorkspace } from './workspace-provider';
import { Button } from './ui/button';
import {
  effectivePriority,
  isOverdue,
  rankTask,
  taskProgress,
  weightedGrade,
  atRisk,
} from '@/lib/academic';
import { dateLabel } from '@/lib/utils';
import type { Task } from '@/lib/types';
import { AnalyticsHistory } from './history';
export function Empty({
  title,
  body,
  action,
}: {
  title: string;
  body: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="empty-state">
      <span className="empty-icon">
        <BookOpen size={23} />
      </span>
      <h3>{title}</h3>
      <p>{body}</p>
      {action}
    </div>
  );
}
export function Progress({ value, color }: { value: number; color?: string }) {
  return (
    <div className="progress-track">
      <span style={{ width: `${Math.min(100, Math.max(0, value))}%`, background: color }} />
    </div>
  );
}
export function PriorityBadge({ task }: { task: Task }) {
  const p = effectivePriority(task);
  return (
    <span className={`priority-badge ${isOverdue(task) ? 'critical' : p.toLowerCase()}`}>
      <i />
      {isOverdue(task) ? 'Overdue' : p}
    </span>
  );
}
export function TaskRow({
  task,
  onEdit,
  compact = false,
}: {
  task: Task;
  onEdit: (t: Task) => void;
  compact?: boolean;
}) {
  const { data, save } = useWorkspace(),
    subject = data.subjects.find((s) => s.id === task.subject_id),
    progress = taskProgress(task, data);
  return (
    <div
      className={`task-row ${task.status === 'Completed' ? 'task-done' : ''} ${compact ? 'compact' : ''}`}
    >
      <button
        className={`task-check ${task.status === 'Completed' ? 'checked' : ''}`}
        aria-label={`${task.status === 'Completed' ? 'Reopen' : 'Complete'} ${task.title}`}
        onClick={() =>
          void save('tasks', {
            ...task,
            status: task.status === 'Completed' ? 'Not Started' : 'Completed',
            progress: task.status === 'Completed' ? 0 : 100,
            completed_at: task.status === 'Completed' ? null : new Date().toISOString(),
          })
        }
      >
        {task.status === 'Completed' && <Check size={13} />}
      </button>
      <button className="task-main" onClick={() => onEdit(task)}>
        <strong>{task.title}</strong>
        <span>
          <i className="subject-dot" style={{ background: subject?.color || '#94a3b8' }} />
          {subject?.code || 'Personal'}
          <span className="meta-dot">·</span>
          {task.category}
        </span>
      </button>
      {!compact && (
        <div className="task-progress">
          <span>{progress}%</span>
          <Progress value={progress} color={subject?.color} />
        </div>
      )}
      <PriorityBadge task={task} />
      <span className={`due-date ${isOverdue(task) ? 'overdue' : ''}`}>
        <CalendarDays size={13} />
        {dateLabel(task.due_at, data.preferences.timezone)}
      </span>
      <button
        className="icon-button row-more"
        aria-label={`Edit ${task.title}`}
        onClick={() => onEdit(task)}
      >
        <MoreHorizontal size={18} />
      </button>
    </div>
  );
}
export function weeklyData(data: ReturnType<typeof useWorkspace>['data'], weeks = 1) {
  const now = new Date(),
    zone = data.preferences.timezone,
    start = new Date(now);
  const day = now.getDay();
  start.setDate(now.getDate() - ((day - data.preferences.week_start + 7) % 7) - (weeks - 1) * 7);
  start.setHours(0, 0, 0, 0);
  return Array.from({ length: 7 * weeks }, (_, i) => {
    const d = new Date(+start + i * 86400000),
      key = new Intl.DateTimeFormat('en-CA', { timeZone: zone }).format(d),
      same = (s: string) =>
        new Intl.DateTimeFormat('en-CA', { timeZone: zone }).format(new Date(s)) === key;
    return {
      day: new Intl.DateTimeFormat('en', { weekday: 'short' }).format(d),
      date: d.toISOString(),
      completed: data.tasks.filter((t) => t.completed_at && same(t.completed_at)).length,
      due: data.tasks.filter((t) => same(t.due_at)).length,
      minutes: data.study_sessions
        .filter((s) => s.status === 'Completed' && same(s.starts_at))
        .reduce((n, s) => n + s.actual_minutes, 0),
    };
  });
}
export function Dashboard({
  editTask,
  navigate,
  newTask,
}: {
  editTask: (t: Task) => void;
  navigate: (p: string) => void;
  newTask: () => void;
}) {
  const { data } = useWorkspace(),
    [period, setPeriod] = useState('This week');
  const tasks = data.tasks,
    completed = tasks.filter((t) => t.status === 'Completed'),
    pending = tasks.filter((t) => t.status !== 'Completed'),
    overdue = tasks.filter((t) => isOverdue(t)),
    pct = tasks.length ? Math.round((completed.length / tasks.length) * 100) : 0,
    week = weeklyData(data, period === 'Last 2 weeks' ? 2 : 1),
    studyMinutes = week.reduce((n, d) => n + d.minutes, 0),
    priorities = [...pending].sort((a, b) => rankTask(b, data) - rankTask(a, data)).slice(0, 4),
    todayKey = new Intl.DateTimeFormat('en-CA', { timeZone: data.preferences.timezone }).format(
      new Date(),
    ),
    sessions = data.study_sessions
      .filter(
        (s) =>
          s.status === 'Planned' &&
          new Intl.DateTimeFormat('en-CA', { timeZone: data.preferences.timezone }).format(
            new Date(s.starts_at),
          ) === todayKey,
      )
      .sort((a, b) => a.starts_at.localeCompare(b.starts_at));
  return (
    <>
      <div className="welcome-row">
        <div>
          <span className="eyebrow">A LITTLE PROGRESS, EVERY DAY</span>
          <h1>
            Let’s make room for progress<span className="heading-dot">.</span>
          </h1>
          <p>
            You’ve got this, {data.preferences.display_name.split(' ')[0]}. Here’s your academic day
            at a glance.
          </p>
        </div>
        <Button onClick={newTask}>
          <span className="plus-sign">+</span> Create task
        </Button>
      </div>
      <div className="dashboard-banner">
        <div className="banner-art">
          <BookOpen size={27} />
          <Sparkles size={15} />
        </div>
        <div>
          <strong>
            {pending.length
              ? `${pending.length} things to do. One step at a time.`
              : 'A fresh start for your next chapter.'}
          </strong>
          <p>
            {overdue.length
              ? `${overdue.length} overdue ${overdue.length === 1 ? 'task needs' : 'tasks need'} a little attention. Let’s get you back on track.`
              : pending.length
                ? 'Your next deadline is getting closer. A little focus today goes a long way.'
                : 'Add your subjects and first task. We’ll help you make a plan that fits.'}
          </p>
        </div>
        <button onClick={() => navigate(pending.length ? 'Tasks' : 'Subjects')}>
          {pending.length ? 'See your tasks' : 'Set up subjects'}
          <ArrowRight size={16} />
        </button>
      </div>
      <div className="section-heading dashboard-overview">
        <h2>Your overview</h2>
        <span className="muted small">
          <span className="live-dot" />
          All caught up · Live overview
        </span>
      </div>
      <div className="stats-grid">
        {[
          {
            label: 'Total tasks',
            value: tasks.length,
            sub: `Across ${data.subjects.filter((s) => !s.archived).length} active subjects`,
            icon: ListTodo,
            color: 'blue',
          },
          {
            label: 'Completed',
            value: completed.length,
            sub: `${pct}% of your tasks done`,
            icon: CheckCheck,
            color: 'green',
          },
          {
            label: 'In progress',
            value: tasks.filter((t) => t.status === 'In Progress' || t.status === 'For Review')
              .length,
            sub: `${pending.length} tasks remaining`,
            icon: Clock3,
            color: 'purple',
          },
          {
            label: 'Overdue',
            value: overdue.length,
            sub: overdue.length ? 'Let’s give these some attention' : 'Looking good. Keep it up!',
            icon: TriangleAlert,
            color: 'orange',
          },
        ].map((c) => (
          <button key={c.label} className="stat-card" onClick={() => navigate('Tasks')}>
            <div>
              <span>{c.label}</span>
              <span className={`stat-icon ${c.color}`}>
                <c.icon size={18} />
              </span>
            </div>
            <strong>{c.value.toString().padStart(2, '0')}</strong>
            <p>
              {c.label === 'Completed' && <span className="tiny-trend">↗</span>}
              {c.sub}
            </p>
          </button>
        ))}
      </div>
      <div className="dashboard-columns">
        <div className="dashboard-left">
          <section className="panel priority-panel">
            <div className="panel-heading">
              <h2>
                <span className="section-icon orange-text">
                  <Flame size={18} />
                </span>
                Up next<span className="count-pill">{pending.length}</span>
              </h2>
              <button className="text-link" onClick={() => navigate('Tasks')}>
                View all tasks
                <ArrowUpRight size={14} />
              </button>
            </div>
            <div className="panel-subheading">
              <span>Your priorities, thoughtfully sorted.</span>
              <span className="small muted">
                <Sparkles size={12} /> Smart priority
              </span>
            </div>
            {priorities.length ? (
              priorities.map((t) => <TaskRow key={t.id} task={t} onEdit={editTask} />)
            ) : (
              <Empty
                title="A clear head starts here"
                body="Add a task and we’ll help you decide what to work on first."
                action={
                  <Button variant="outline" size="sm" onClick={newTask}>
                    Add your first task
                  </Button>
                }
              />
            )}
          </section>
          <section className="panel weekly-panel">
            <div className="panel-heading">
              <h2>Weekly momentum</h2>
              <select
                aria-label="Progress period"
                className="small-select"
                value={period}
                onChange={(e) => setPeriod(e.target.value)}
              >
                <option>This week</option>
                <option>Last 2 weeks</option>
              </select>
            </div>
            <div className="chart-summary">
              <strong>
                {week.reduce((n, d) => n + d.completed, 0)}
                <span> tasks completed</span>
              </strong>
              <span className="chart-legend">
                <i />
                Completed
                <i />
                Due
              </span>
            </div>
            <div className="chart-container">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={week} margin={{ top: 12, right: 12, left: -27, bottom: 0 }}>
                  <defs>
                    <linearGradient id="areaFill" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#7880e8" stopOpacity={0.2} />
                      <stop offset="100%" stopColor="#7880e8" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid vertical={false} strokeDasharray="3 4" stroke="var(--line)" />
                  <XAxis
                    dataKey="day"
                    axisLine={false}
                    tickLine={false}
                    tick={{ fontSize: 11, fill: '#9396a5' }}
                    dy={9}
                  />
                  <YAxis
                    allowDecimals={false}
                    axisLine={false}
                    tickLine={false}
                    tick={{ fontSize: 11, fill: '#9396a5' }}
                  />
                  <Tooltip
                    contentStyle={{
                      borderRadius: 10,
                      border: '1px solid var(--line)',
                      background: 'var(--panel)',
                      fontSize: 12,
                    }}
                  />
                  <Area
                    type="monotone"
                    dataKey="due"
                    stroke="#c9cbd6"
                    fill="transparent"
                    strokeDasharray="4 4"
                    strokeWidth={2}
                  />
                  <Area
                    type="monotone"
                    dataKey="completed"
                    stroke="#7377df"
                    fill="url(#areaFill)"
                    strokeWidth={2.5}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
            <div className="chart-footer">
              <span>
                <Clock3 size={14} />
                <strong>{(studyMinutes / 60).toFixed(1)}h</strong> focused study
              </span>
              <button className="text-link" onClick={() => navigate('Analytics')}>
                Explore analytics
                <ArrowRight size={14} />
              </button>
            </div>
          </section>
          <section className="panel">
            <div className="panel-heading">
              <h2>Recent activity</h2>
              <span className="muted small">Your small wins add up</span>
            </div>
            {data.activity_history.length ? (
              <div className="activity-list">
                {[...data.activity_history]
                  .sort((a, b) => b.created_at.localeCompare(a.created_at))
                  .slice(0, 4)
                  .map((a) => (
                    <div key={a.id}>
                      <span className="activity-icon">
                        <Check size={13} />
                      </span>
                      <p>
                        {a.title}
                        <small>{dateLabel(a.created_at, data.preferences.timezone, true)}</small>
                      </p>
                    </div>
                  ))}
              </div>
            ) : (
              <div className="panel-padding muted small">
                Your workspace activity will appear here.
              </div>
            )}
          </section>
        </div>
        <div className="dashboard-right">
          <section className="panel schedule-panel">
            <div className="panel-heading">
              <h2>
                <CalendarDays size={17} />
                Today’s plan
              </h2>
              <button
                className="icon-button"
                aria-label="Open study planner"
                onClick={() => navigate('Study planner')}
              >
                <ArrowUpRight size={17} />
              </button>
            </div>
            <p className="panel-date">
              {new Intl.DateTimeFormat('en', {
                timeZone: data.preferences.timezone,
                weekday: 'long',
                month: 'long',
                day: 'numeric',
              }).format(new Date())}
            </p>
            {sessions.length ? (
              <div className="timeline">
                {sessions.slice(0, 4).map((s, i) => (
                  <button
                    className="timeline-item"
                    key={s.id}
                    onClick={() => navigate('Study planner')}
                  >
                    <span className="timeline-time">
                      {new Intl.DateTimeFormat('en', {
                        timeZone: data.preferences.timezone,
                        hour: 'numeric',
                        minute: '2-digit',
                      }).format(new Date(s.starts_at))}
                    </span>
                    <div style={{ borderColor: i % 2 ? '#d5ad67' : '#8e80d9' }}>
                      <strong>{s.title}</strong>
                      <span>
                        {Math.round((+new Date(s.ends_at) - +new Date(s.starts_at)) / 60000)} min ·
                        Study session
                      </span>
                    </div>
                  </button>
                ))}
              </div>
            ) : (
              <div className="schedule-empty">
                <CalendarDays size={24} />
                <p>A little space to focus.</p>
                <small>Plan a session and make time for what matters.</small>
              </div>
            )}
            <button className="panel-bottom-link" onClick={() => navigate('Study planner')}>
              Open study planner
              <ArrowRight size={14} />
            </button>
          </section>
          <section className="focus-card">
            <span className="focus-decoration" />
            <div className="focus-card-top">
              <span className="focus-mini-icon">
                <Target size={18} />
              </span>
              <span>TIME TO TUNE IN</span>
            </div>
            <h3>
              A little focus.
              <br />A big difference.
            </h3>
            <p>
              One task. 25 minutes.
              <br />
              See how far you can go.
            </p>
            <button onClick={() => navigate('Focus mode')}>
              Start a focus session
              <ArrowRight size={16} />
            </button>
            <span className="focus-orbit one" />
            <span className="focus-orbit two" />
          </section>
          <section className="panel subjects-performance">
            <div className="panel-heading">
              <h2>Subject performance</h2>
              <button
                className="icon-button"
                aria-label="View grades"
                onClick={() => navigate('Grades')}
              >
                <ArrowUpRight size={17} />
              </button>
            </div>
            {data.subjects.filter((s) => !s.archived).length ? (
              data.subjects
                .filter((s) => !s.archived)
                .slice(0, 4)
                .map((s) => {
                  const g = weightedGrade(
                    data.grade_categories.filter((c) => c.subject_id === s.id),
                    data.grades.filter((g) => g.subject_id === s.id),
                  );
                  return (
                    <button
                      key={s.id}
                      className="subject-performance"
                      onClick={() => navigate('Grades')}
                    >
                      <span
                        className="subject-initial"
                        style={{ background: s.color + '18', color: s.color }}
                      >
                        {s.code.slice(0, 2)}
                      </span>
                      <div>
                        <strong>{s.code || s.name}</strong>
                        <Progress value={g.current || 0} color={s.color} />
                      </div>
                      <b>{g.current === null ? '—' : `${Math.round(g.current)}%`}</b>
                    </button>
                  );
                })
            ) : (
              <div className="panel-padding small muted">
                Add subjects and grades to see your progress.
              </div>
            )}
          </section>
        </div>
      </div>
      <div className="workspace-footer">
        <span>Made for steady progress, at your pace.</span>
        <span>
          <span className="live-dot" />
          Your next chapter starts here
        </span>
      </div>
    </>
  );
}
export function Analytics() {
  const { data } = useWorkspace(),
    week = weeklyData(data, 4),
    completed = data.tasks.filter((t) => t.status === 'Completed'),
    onTime = completed.filter((t) => t.completed_at && t.completed_at <= t.due_at),
    hours = data.study_sessions.reduce((n, s) => n + s.actual_minutes, 0) / 60,
    planned = data.study_sessions
      .filter((s) => s.status === 'Planned' || s.status === 'Completed')
      .reduce((n, s) => n + (+new Date(s.ends_at) - +new Date(s.starts_at)) / 3600000, 0),
    bySubject = data.subjects.map((s) => ({
      name: s.code || s.name,
      completed: data.tasks.filter((t) => t.subject_id === s.id && t.status === 'Completed').length,
      pending: data.tasks.filter((t) => t.subject_id === s.id && t.status !== 'Completed').length,
      study:
        data.study_sessions
          .filter((x) => data.tasks.find((t) => t.id === x.task_id)?.subject_id === s.id)
          .reduce((n, x) => n + x.actual_minutes, 0) / 60,
    }));
  return (
    <>
      <PageHeading
        eyebrow="THE BIGGER PICTURE"
        title="Progress, in perspective."
        description="See the effort behind your achievements."
      />
      <div className="stats-grid">
        {[
          [
            'On-time completion',
            `${completed.length ? Math.round((onTime.length / completed.length) * 100) : 0}%`,
          ],
          ['Total focus time', `${hours.toFixed(1)}h`],
          ['At-risk tasks', data.tasks.filter((t) => atRisk(t, data)).length],
          ['Planned study time', `${planned.toFixed(1)}h`],
        ].map(([l, v]) => (
          <div className="stat-card" key={l}>
            <span>{l}</span>
            <strong>{v}</strong>
          </div>
        ))}
      </div>
      <div className="two-columns">
        <section className="panel panel-padding">
          <h2>Task completion · last 4 weeks</h2>
          <div className="chart-container tall">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={week}>
                <CartesianGrid vertical={false} stroke="var(--line)" />
                <XAxis
                  dataKey="date"
                  tickFormatter={(v) => new Date(v).getDate().toString()}
                  tick={{ fontSize: 11 }}
                />
                <YAxis allowDecimals={false} />
                <Tooltip />
                <Bar dataKey="completed" fill="#7776dc" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </section>
        <section className="panel panel-padding">
          <h2>Workload by subject</h2>
          <div className="chart-container tall">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={bySubject}>
                <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                <YAxis allowDecimals={false} />
                <Tooltip />
                <Bar dataKey="completed" stackId="a" fill="#6caa96" />
                <Bar dataKey="pending" stackId="a" fill="#c9c6ee" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </section>
      </div>
      <section className="panel panel-padding">
        <h2>Subject productivity</h2>
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>Subject</th>
                <th>Completed</th>
                <th>Remaining</th>
                <th>Study hours</th>
                <th>Completion</th>
              </tr>
            </thead>
            <tbody>
              {bySubject.map((s) => (
                <tr key={s.name}>
                  <td>{s.name}</td>
                  <td>{s.completed}</td>
                  <td>{s.pending}</td>
                  <td>{s.study.toFixed(1)}h</td>
                  <td>
                    {s.completed + s.pending
                      ? Math.round((s.completed / (s.completed + s.pending)) * 100)
                      : 0}
                    %
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
      <section className="panel panel-padding">
        <h2>Current deadline health</h2>
        <p className="muted">
          {data.tasks.filter((t) => isOverdue(t)).length} currently overdue · {onTime.length}{' '}
          completed on time · {completed.length - onTime.length} completed late
        </p>
        <p className="small muted">
          Completion history uses recorded completion dates. Overdue history is available in the
          activity log; this view shows current deadline health.
        </p>
      </section>
      <AnalyticsHistory />
    </>
  );
}
export function PageHeading({
  eyebrow,
  title,
  description,
  action,
}: {
  eyebrow: string;
  title: string;
  description: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="welcome-row">
      <div>
        <span className="eyebrow">{eyebrow}</span>
        <h1>{title}</h1>
        <p>{description}</p>
      </div>
      {action}
    </div>
  );
}
