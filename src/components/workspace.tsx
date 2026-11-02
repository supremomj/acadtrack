'use client';
import { useState, useEffect, useRef } from 'react';
import {
  GraduationCap,
  LayoutDashboard,
  CheckSquare,
  BookOpen,
  CalendarDays,
  NotebookPen,
  Target,
  ChartNoAxesCombined,
  Settings as SettingsIcon,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Search,
  Bell,
  PanelLeftClose,
  PanelLeftOpen,
  Menu,
  ArrowUpRight,
  X,
  Command,
  Cloud,
  HardDrive,
  Plus,
  LifeBuoy,
  Download,
  ArrowRight,
  RefreshCw,
  FileText,
  ShieldCheck,
  Megaphone,
} from 'lucide-react';
import { useWorkspace } from './workspace-provider';
import { Button } from './ui/button';
import { Dialog } from './ui/dialog';
import { ThemeToggle } from './theme-toggle';
import { Dashboard, Analytics } from './dashboard';
import { Tasks, Subjects } from './tasks-subjects';
import dynamic from 'next/dynamic';
import { StudyPlanner, FocusMode, WeeklyReview } from './study';
import { Grades } from './grades';
import { Settings, Notifications } from './settings';
import { TaskEditor, SubjectEditor } from './editors';
import { sampleData } from '@/lib/sample';
import { downloadJSON } from '@/lib/utils';
import type { Task, Subject } from '@/lib/types';
const mainNav = [
  { name: 'Overview', icon: LayoutDashboard },
  { name: 'Tasks', icon: CheckSquare },
  { name: 'Subjects', icon: BookOpen },
  { name: 'Calendar', icon: CalendarDays },
  { name: 'Study planner', icon: NotebookPen },
  { name: 'Focus mode', icon: Target },
];
const insights = [
  { name: 'Grades', icon: GraduationCap },
  { name: 'Analytics', icon: ChartNoAxesCombined },
  { name: 'Weekly review', icon: FileText },
];
const pageNames = [...mainNav, ...insights, { name: 'Settings' }, { name: 'Notifications' }].map(
  (n) => n.name,
);
const AcademicCalendar = dynamic(() => import('./calendar').then((m) => m.AcademicCalendar), {
  loading: () => <div className="panel panel-padding muted">Preparing your calendar…</div>,
});
export function Workspace() {
  const { data, mode, loading, error, reload, userEmail, isAdmin, replaceLocal, notify } =
    useWorkspace();
  const [page, setPage] = useState('Overview'),
    [collapsed, setCollapsed] = useState(false),
    [mobile, setMobile] = useState(false),
    [task, setTask] = useState<Task | null | undefined>(),
    [subject, setSubject] = useState<Subject | null | undefined>(),
    [query, setQuery] = useState(''),
    [searchOpen, setSearchOpen] = useState(false),
    [help, setHelp] = useState(false),
    [demoBusy, setDemoBusy] = useState(false);
  const searchRef = useRef<HTMLInputElement>(null);
  function navigate(name: string) {
    setPage(name);
    location.hash = name.toLowerCase().replaceAll(' ', '-');
    setMobile(false);
    window.scrollTo({ top: 0, behavior: 'instant' });
  }
  useEffect(() => {
    function hash() {
      const p = pageNames.find(
        (p) => p.toLowerCase().replaceAll(' ', '-') === location.hash.slice(1),
      );
      if (p) setPage(p);
    }
    hash();
    window.addEventListener('hashchange', hash);
    function key(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        searchRef.current?.focus();
        setSearchOpen(true);
      }
      if (e.key === 'Escape') {
        setSearchOpen(false);
        setMobile(false);
      }
    }
    window.addEventListener('keydown', key);
    return () => {
      window.removeEventListener('hashchange', hash);
      window.removeEventListener('keydown', key);
    };
  }, []);
  const q = query.trim().toLowerCase(),
    unread = data.notifications.filter((n) => !n.read).length,
    matches = q
      ? [
          ...data.tasks
            .filter((t) => `${t.title} ${t.description} ${t.notes}`.toLowerCase().includes(q))
            .map((t) => ({ key: t.id, title: t.title, kind: 'Task', action: () => setTask(t) })),
          ...data.subjects
            .filter((s) => `${s.name} ${s.code} ${s.notes}`.toLowerCase().includes(q))
            .map((s) => ({
              key: s.id,
              title: s.name,
              kind: 'Subject',
              action: () => setSubject(s),
            })),
          ...data.calendar_events
            .filter((e) => `${e.title} ${e.notes}`.toLowerCase().includes(q))
            .map((e) => ({
              key: e.id,
              title: e.title,
              kind: 'Event',
              action: () => navigate('Calendar'),
            })),
          ...data.study_sessions
            .filter((s) => s.title.toLowerCase().includes(q))
            .map((s) => ({
              key: s.id,
              title: s.title,
              kind: 'Study session',
              action: () => navigate('Study planner'),
            })),
        ].slice(0, 12)
      : [];
  function navItem(item: { name: string; icon: typeof BookOpen }) {
    return (
      <button
        title={collapsed ? item.name : undefined}
        aria-current={page === item.name ? 'page' : undefined}
        key={item.name}
        className={`nav-item ${page === item.name ? 'active' : ''}`}
        onClick={() => navigate(item.name)}
      >
        <item.icon size={18} />
        <span>{item.name}</span>
        {item.name === 'Tasks' && data.tasks.some((t) => t.status !== 'Completed') && (
          <b>{data.tasks.filter((t) => t.status !== 'Completed').length}</b>
        )}
        {item.name === 'Weekly review' && <i className="nav-new-dot" />}
      </button>
    );
  }
  if (loading)
    return (
      <div className="loading-page">
        <span className="brand-icon">
          <GraduationCap />
        </span>
        <h2>Making room for your day…</h2>
        <div className="loading-bar" />
      </div>
    );
  return (
    <div
      className={`app-shell ${collapsed ? 'sidebar-collapsed' : ''} ${mobile ? 'mobile-open' : ''}`}
    >
      <button
        className="mobile-overlay"
        aria-label="Close navigation"
        onClick={() => setMobile(false)}
      />
      <aside className="sidebar">
        <a className="brand" href="#overview" onClick={() => navigate('Overview')}>
          <span className="brand-icon">
            <GraduationCap size={23} />
          </span>
          <span className="brand-name">
            AcadTrack<span className="brand-dot">.</span>
          </span>
        </a>
        <button className="workspace-switch" onClick={() => navigate('Settings')}>
          <span className="workspace-avatar">
            {data.preferences.display_name.slice(0, 1).toUpperCase()}
          </span>
          <span>
            <strong>My workspace</strong>
            <small>Personal academic space</small>
          </span>
          <ChevronDown size={14} />
        </button>
        <span className="nav-label">WORKSPACE</span>
        <nav aria-label="Main navigation">{mainNav.map(navItem)}</nav>
        <span className="nav-label insights-label">INSIGHTS</span>
        <nav aria-label="Insights">{insights.map(navItem)}</nav>
        <div className="sidebar-bottom">
          {isAdmin && (
            <a href="/admin" className="nav-item">
              <ShieldCheck size={18} />
              <span>Administration</span>
              <ArrowUpRight size={14} />
            </a>
          )}
          <div className="sidebar-note">
            <span>YOUR PACE. YOUR PROGRESS.</span>
            <p>
              A little better,
              <br />
              every single day.
            </p>
            <div>
              <span />
              <span />
              <span />
              <span />
              <span />
            </div>
          </div>
          {navItem({ name: 'Settings', icon: SettingsIcon })}
          <button className="nav-item" onClick={() => setHelp(true)}>
            <LifeBuoy size={18} />
            <span>Help & getting started</span>
            <ArrowUpRight size={14} />
          </button>
          <div className="sidebar-profile">
            <span className="profile-avatar">
              {data.preferences.display_name.slice(0, 1).toUpperCase()}
            </span>
            <span>
              <strong>{data.preferences.display_name}</strong>
              <small>{mode === 'cloud' ? 'Cloud workspace' : 'Local workspace'}</small>
            </span>
            <button
              className="icon-button"
              aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
              onClick={() => setCollapsed(!collapsed)}
            >
              {collapsed ? <PanelLeftOpen size={16} /> : <PanelLeftClose size={16} />}
            </button>
          </div>
        </div>
      </aside>
      <div className="main-shell">
        <header className="topbar">
          <button
            className="icon-button mobile-menu"
            aria-label="Open navigation"
            onClick={() => setMobile(true)}
          >
            <Menu size={20} />
          </button>
          <div className="breadcrumbs">
            <span>My workspace</span>
            <ChevronRight size={12} />
            <strong>{page}</strong>
          </div>
          <div className="global-search">
            <Search size={16} />
            <input
              ref={searchRef}
              aria-label="Search workspace"
              placeholder="Search anything…"
              value={query}
              onFocus={() => setSearchOpen(true)}
              onChange={(e) => {
                setQuery(e.target.value);
                setSearchOpen(true);
              }}
            />
            <kbd>Ctrl K</kbd>
            {searchOpen && query && (
              <div className="search-results">
                <div className="search-results-label">
                  SEARCH YOUR WORKSPACE{' '}
                  <button aria-label="Close search" onClick={() => setSearchOpen(false)}>
                    <X size={14} />
                  </button>
                </div>
                {matches.length ? (
                  matches.map((m) => (
                    <button
                      key={m.key}
                      onClick={() => {
                        m.action();
                        setSearchOpen(false);
                        setQuery('');
                      }}
                    >
                      <Search size={14} />
                      <span>
                        {m.title}
                        <small>{m.kind}</small>
                      </span>
                      <ArrowUpRight size={14} />
                    </button>
                  ))
                ) : (
                  <p>No matching records. Try a subject, task, note, or event.</p>
                )}
              </div>
            )}
          </div>
          <div className="topbar-actions">
            <ThemeToggle />
            <span className="topbar-date">
              {new Intl.DateTimeFormat('en', {
                timeZone: data.preferences.timezone,
                weekday: 'short',
                month: 'short',
                day: 'numeric',
                dateStyle: undefined,
              }).format(new Date())}
            </span>
            <span className="topbar-divider" />
            <button
              className="notification-button icon-button"
              aria-label={`Notifications, ${unread} unread`}
              onClick={() => navigate('Notifications')}
            >
              <Bell size={18} />
              {unread > 0 && <i />}
            </button>
            <button
              className="profile-avatar small-avatar"
              aria-label="Open profile settings"
              onClick={() => navigate('Settings')}
            >
              {data.preferences.display_name.slice(0, 1).toUpperCase()}
            </button>
          </div>
        </header>
        <main className="main-content">
          {error ? (
            <div className="error-state" role="alert">
              <h2>We couldn’t load your workspace</h2>
              <p>{error}</p>
              <Button onClick={() => void reload()}>
                <RefreshCw size={16} />
                Try again
              </Button>
              <a href="/login">Sign in</a>
            </div>
          ) : (
            <>
              {mode === 'local' && (
                <div className="local-mode-strip">
                  <span>
                    <HardDrive size={12} />
                    Local workspace · Saved in this browser
                  </span>
                  {!data.tasks.length && !data.subjects.length ? (
                    <button
                      disabled={demoBusy}
                      onClick={() => {
                        setDemoBusy(true);
                        replaceLocal(sampleData());
                        setDemoBusy(false);
                        notify('Example workspace added. Edit or clear it in Settings.');
                      }}
                    >
                      Try an example workspace
                      <ArrowRight size={12} />
                    </button>
                  ) : (
                    <button onClick={() => downloadJSON(data)}>
                      <Download size={12} />
                      Export backup
                    </button>
                  )}
                </div>
              )}
              {page === 'Overview' && (
                <>
                  {(data.announcements || []).map((post) => (
                    <section className="workspace-announcement" key={post.id}>
                      <Megaphone size={19} />
                      <div>
                        <strong>{post.title}</strong>
                        <p>{post.body}</p>
                      </div>
                    </section>
                  ))}
                  <Dashboard editTask={setTask} navigate={navigate} newTask={() => setTask(null)} />
                </>
              )}{' '}
              {page === 'Tasks' && (
                <Tasks
                  editTask={setTask}
                  newTask={() => setTask(null)}
                  showCalendar={() => navigate('Calendar')}
                />
              )}{' '}
              {page === 'Subjects' && (
                <Subjects
                  editSubject={setSubject}
                  newSubject={() => setSubject(null)}
                  editTask={setTask}
                />
              )}{' '}
              {page === 'Calendar' && <AcademicCalendar editTask={setTask} />}{' '}
              {page === 'Study planner' && <StudyPlanner />}
              {page === 'Focus mode' && <FocusMode />}
              {page === 'Grades' && <Grades />}
              {page === 'Analytics' && <Analytics />}
              {page === 'Weekly review' && (
                <WeeklyReview editTask={setTask} openPlanner={() => navigate('Study planner')} />
              )}{' '}
              {page === 'Settings' && <Settings />}
              {page === 'Notifications' && (
                <Notifications
                  openTask={(id) => {
                    const t = data.tasks.find((t) => t.id === id);
                    if (t) setTask(t);
                  }}
                />
              )}
            </>
          )}
        </main>
      </div>
      {task !== undefined && (
        <TaskEditor key={task?.id || 'new-task'} task={task} onClose={() => setTask(undefined)} />
      )}{' '}
      {subject !== undefined && (
        <SubjectEditor
          key={subject?.id || 'new-subject'}
          subject={subject}
          onClose={() => setSubject(undefined)}
        />
      )}
      <Dialog
        open={help}
        onOpenChange={setHelp}
        title="A calmer academic day starts here."
        description="A few small steps to make the workspace your own."
      >
        <div className="help-steps">
          {[
            [
              '01',
              'Add your subjects',
              'Create a subject for each course. Add recurring classes from its details.',
            ],
            [
              '02',
              'Get your tasks out of your head',
              'Add deadlines, estimates, and subtasks. Smart priority helps pick your next step.',
            ],
            [
              '03',
              'Make room to focus',
              'Generate a study plan, accept the sessions you like, then start your focus timer.',
            ],
            [
              '04',
              'See your progress',
              'Record grades, review your analytics, and check in with yourself each week.',
            ],
          ].map(([n, t, d]) => (
            <div key={n}>
              <span>{n}</span>
              <div>
                <h3>{t}</h3>
                <p>{d}</p>
              </div>
            </div>
          ))}
        </div>
        <div className="setup-note">
          <Cloud size={20} />
          <p>
            <strong>
              {mode === 'local'
                ? 'You’re using a local workspace.'
                : 'You’re connected to Supabase.'}
            </strong>
            {mode === 'local'
              ? 'Your records are saved in this browser. Secure accounts, file uploads, and background reminders need Supabase configuration. See the project README for setup.'
              : 'Your records are isolated with row-level security. Reminder delivery requires the configured server scheduler.'}
          </p>
        </div>
        <div className="dialog-footer">
          <Button onClick={() => setHelp(false)}>
            Let’s get started
            <ArrowRight size={16} />
          </Button>
        </div>
      </Dialog>
    </div>
  );
}
