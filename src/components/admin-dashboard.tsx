'use client';
import { useState, useEffect, useCallback } from 'react';
import {
  ShieldCheck,
  ArrowLeft,
  Users,
  CheckCircle2,
  UserX,
  Activity,
  Search,
  Plus,
  Megaphone,
  RefreshCw,
  ChevronLeft,
  ChevronRight,
  Trash2,
} from 'lucide-react';
import { Button } from './ui/button';
import { Dialog } from './ui/dialog';
import { ThemeToggle } from './theme-toggle';
import { useTheme, type ThemeMode } from './theme-provider';
type Account = {
  id: string;
  email: string;
  display_name: string | null;
  created_at: string;
  last_sign_in_at: string | null;
  email_confirmed_at: string | null;
  is_admin: boolean;
  suspended: boolean;
  suspension_reason: string;
};
type Post = {
  id: string;
  title: string;
  body: string;
  published: boolean;
  created_at?: string;
  updated_at?: string;
};
type Audit = {
  id: string;
  action: string;
  actor_email: string | null;
  target_email: string | null;
  details: { reason?: string; title?: string };
  created_at: string;
};
type Overview = {
  accounts: Account[];
  total: number;
  page: number;
  announcements: Post[];
  audit: Audit[];
  stats: {
    users: number;
    verified: number;
    suspended: number;
    admins: number;
    tasks: number;
    completed_tasks: number;
    subjects: number;
    study_minutes: number;
  };
};
export function AdminDashboard({
  email,
  initialTheme,
}: {
  email: string;
  initialTheme: ThemeMode;
}) {
  const { applyAccountTheme } = useTheme();
  useEffect(() => {
    applyAccountTheme(initialTheme);
  }, [initialTheme, applyAccountTheme]);
  const [data, setData] = useState<Overview | null>(null),
    [loading, setLoading] = useState(true),
    [error, setError] = useState(''),
    [notice, setNotice] = useState(''),
    [busy, setBusy] = useState(false),
    [search, setSearch] = useState(''),
    [query, setQuery] = useState(''),
    [page, setPage] = useState(0),
    [tab, setTab] = useState<'Users' | 'Announcements' | 'Audit log'>('Users'),
    [account, setAccount] = useState<Account | null>(null),
    [reason, setReason] = useState(''),
    [post, setPost] = useState<Post | null>(null);
  const load = useCallback(
    async (signal?: AbortSignal) => {
      setLoading(true);
      setError('');
      try {
        const r = await fetch(`/api/admin?search=${encodeURIComponent(query)}&page=${page}`, {
            signal,
            cache: 'no-store',
          }),
          result = await r.json();
        if (!r.ok) throw new Error(result.error);
        if (!signal?.aborted) setData(result);
      } catch (e) {
        if (!signal?.aborted) setError((e as Error).message);
      } finally {
        if (!signal?.aborted) setLoading(false);
      }
    },
    [query, page],
  );
  useEffect(() => {
    const controller = new AbortController();
    void load(controller.signal);
    return () => controller.abort();
  }, [load]);
  async function change(body: unknown) {
    setBusy(true);
    setNotice('');
    try {
      const r = await fetch('/api/admin', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        }),
        result = await r.json();
      if (!r.ok) throw new Error(result.error);
      await load();
      setNotice('Change saved to the administration log.');
      return true;
    } catch (e) {
      setNotice((e as Error).message);
      return false;
    } finally {
      setBusy(false);
    }
  }
  const when = (s: string | null) => (s ? new Date(s).toLocaleString() : 'Never');
  return (
    <main className="admin-layout">
      <header className="admin-header">
        <a href="/" className="text-link">
          <ArrowLeft size={16} />
          Back to workspace
        </a>
        <span>
          <ThemeToggle />
          <ShieldCheck size={16} />
          Administrator <small>{email}</small>
        </span>
      </header>
      <div className="welcome-row">
        <div>
          <span className="eyebrow">ACADTRACK ADMINISTRATION</span>
          <h1>A well-run place to learn.</h1>
          <p>Manage accounts and announcements. Students’ private coursework stays private.</p>
        </div>
        <Button variant="outline" disabled={loading || busy} onClick={() => void load()}>
          <RefreshCw size={15} />
          Refresh
        </Button>
      </div>
      {notice && (
        <p className="form-message" role="status">
          {notice}
        </p>
      )}
      {error && (
        <section className="panel panel-padding" role="alert">
          <h2>Administration couldn’t load</h2>
          <p>{error}</p>
          <Button onClick={() => void load()}>Try again</Button>
        </section>
      )}
      {!data && loading && (
        <div className="panel panel-padding muted" role="status">
          Loading administration…
        </div>
      )}
      {data && (
        <>
          <div className="stats-grid">
            {[
              { label: 'Total accounts', value: data.stats.users, icon: Users },
              { label: 'Verified accounts', value: data.stats.verified, icon: CheckCircle2 },
              { label: 'Suspended accounts', value: data.stats.suspended, icon: UserX },
              { label: 'Active administrators', value: data.stats.admins, icon: ShieldCheck },
            ].map((s) => (
              <section key={s.label} className="stat-card">
                <div>
                  <span>{s.label}</span>
                  <s.icon size={18} />
                </div>
                <strong>{s.value}</strong>
              </section>
            ))}
          </div>
          <section className="panel admin-usage">
            <span>
              <Activity size={17} />
              Aggregate usage
            </span>
            <p>
              <strong>{data.stats.tasks}</strong> tasks ·{' '}
              <strong>{data.stats.completed_tasks}</strong> completed ·{' '}
              <strong>{data.stats.subjects}</strong> subjects ·{' '}
              <strong>{(Number(data.stats.study_minutes) / 60).toFixed(1)}h</strong> studied
            </p>
          </section>
          <div className="toolbar">
            <div className="view-switch">
              {(['Users', 'Announcements', 'Audit log'] as const).map((t) => (
                <button key={t} className={tab === t ? 'active' : ''} onClick={() => setTab(t)}>
                  {t}
                </button>
              ))}
            </div>
            {tab === 'Announcements' && (
              <Button
                size="sm"
                onClick={() => setPost({ id: '', title: '', body: '', published: false })}
              >
                <Plus size={14} />
                New announcement
              </Button>
            )}
          </div>
          {tab === 'Users' && (
            <section className="panel">
              <div className="panel-heading">
                <h2>
                  User accounts <span className="count-pill">{data.total}</span>
                </h2>
                <form
                  className="inline-form"
                  onSubmit={(e) => {
                    e.preventDefault();
                    setPage(0);
                    setQuery(search.trim());
                  }}
                >
                  <div className="search-field">
                    <Search size={15} />
                    <input
                      aria-label="Search accounts"
                      placeholder="Name or email…"
                      maxLength={200}
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                    />
                  </div>
                  <Button variant="outline" size="sm" disabled={loading}>
                    Search
                  </Button>
                </form>
              </div>
              <div className="table-scroll">
                <table>
                  <thead>
                    <tr>
                      <th>Account</th>
                      <th>Role</th>
                      <th>Verification</th>
                      <th>Access</th>
                      <th>Joined</th>
                      <th>Last sign-in</th>
                      <th>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.accounts.map((a) => (
                      <tr key={a.id}>
                        <td>
                          <strong>{a.display_name || 'Student'}</strong>
                          <small className="admin-email">{a.email}</small>
                        </td>
                        <td>
                          <span className={`admin-badge ${a.is_admin ? 'purple' : ''}`}>
                            {a.is_admin ? 'Admin' : 'Student'}
                          </span>
                        </td>
                        <td>
                          <span
                            className={`admin-badge ${a.email_confirmed_at ? 'green' : 'orange'}`}
                          >
                            {a.email_confirmed_at ? 'Verified' : 'Unverified'}
                          </span>
                        </td>
                        <td>
                          <span className={`admin-badge ${a.suspended ? 'red' : 'green'}`}>
                            {a.suspended ? 'Suspended' : 'Active'}
                          </span>
                          {a.suspended && (
                            <small className="admin-email">{a.suspension_reason}</small>
                          )}
                        </td>
                        <td>{when(a.created_at)}</td>
                        <td>{when(a.last_sign_in_at)}</td>
                        <td>
                          {a.is_admin ? (
                            <span className="muted small">Protected</span>
                          ) : (
                            <Button
                              disabled={busy}
                              size="sm"
                              variant={a.suspended ? 'outline' : 'destructive'}
                              onClick={() => {
                                setReason('');
                                setAccount(a);
                              }}
                            >
                              {a.suspended ? 'Restore access' : 'Suspend'}
                            </Button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {!data.accounts.length && (
                  <p className="panel-padding muted">No accounts match your search.</p>
                )}
              </div>
              <div className="admin-pagination">
                <span>
                  {data.total} matching accounts · page {page + 1}
                </span>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={!page || loading}
                  onClick={() => setPage((p) => p - 1)}
                >
                  <ChevronLeft size={14} />
                  Previous
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={(page + 1) * 25 >= data.total || loading}
                  onClick={() => setPage((p) => p + 1)}
                >
                  Next
                  <ChevronRight size={14} />
                </Button>
              </div>
            </section>
          )}
          {tab === 'Announcements' && (
            <section className="panel">
              <div className="panel-heading">
                <h2>
                  <Megaphone size={17} />
                  Workspace announcements
                </h2>
                <span className="muted small">Published posts appear on student overviews</span>
              </div>
              {data.announcements.length ? (
                data.announcements.map((p) => (
                  <article key={p.id} className="admin-post">
                    <div>
                      <h3>
                        {p.title}
                        <span className={`admin-badge ${p.published ? 'green' : ''}`}>
                          {p.published ? 'Published' : 'Draft'}
                        </span>
                      </h3>
                      <p>{p.body}</p>
                      <small className="muted">Updated {when(p.updated_at || null)}</small>
                    </div>
                    <Button size="sm" variant="outline" onClick={() => setPost(p)}>
                      Edit
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      disabled={busy}
                      aria-label={`Delete ${p.title}`}
                      onClick={() => {
                        if (confirm(`Delete announcement “${p.title}”?`))
                          void change({ action: 'delete_announcement', id: p.id });
                      }}
                    >
                      <Trash2 size={16} />
                    </Button>
                  </article>
                ))
              ) : (
                <div className="empty-state">
                  <Megaphone size={27} />
                  <h3>No announcements yet</h3>
                  <p>Write a helpful update for everyone’s workspace.</p>
                  <Button
                    variant="outline"
                    onClick={() => setPost({ id: '', title: '', body: '', published: false })}
                  >
                    Create announcement
                  </Button>
                </div>
              )}
            </section>
          )}
          {tab === 'Audit log' && (
            <section className="panel">
              <div className="panel-heading">
                <h2>Administration activity</h2>
                <span className="muted small">
                  Latest 100 changes · dates use your device timezone
                </span>
              </div>
              <div className="table-scroll">
                <table>
                  <thead>
                    <tr>
                      <th>Action</th>
                      <th>Administrator</th>
                      <th>Account / announcement</th>
                      <th>Details</th>
                      <th>When</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.audit.map((a) => (
                      <tr key={a.id}>
                        <td>{a.action}</td>
                        <td>{a.actor_email || 'Deleted account'}</td>
                        <td>{a.target_email || a.details.title || '—'}</td>
                        <td>{a.details.reason || '—'}</td>
                        <td>{when(a.created_at)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {!data.audit.length && (
                  <p className="panel-padding muted">
                    Changes you make here will be recorded automatically.
                  </p>
                )}
              </div>
            </section>
          )}
          <p className="small muted admin-footnote">
            Administrator roles are granted through trusted Supabase SQL only. Suspension blocks
            workspace and database access; it preserves academic records and does not delete the
            Supabase identity.
          </p>
        </>
      )}
      {account && (
        <Dialog
          open
          onOpenChange={(o) => !o && !busy && setAccount(null)}
          title={account.suspended ? 'Restore account access' : 'Suspend account access'}
          description={account.email}
        >
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              if (
                await change({
                  action: 'suspend',
                  user_id: account.id,
                  suspended: !account.suspended,
                  reason,
                })
              )
                setAccount(null);
            }}
          >
            <p className="muted small">
              {account.suspended
                ? 'The student will regain access to their existing workspace.'
                : 'The student will lose access to AcadTrack. Their records will be preserved.'}
            </p>
            <label className="field admin-reason">
              <span>{account.suspended ? 'Note (optional)' : 'Reason for suspension'}</span>
              <textarea
                required={!account.suspended}
                minLength={account.suspended ? 0 : 3}
                maxLength={500}
                value={reason}
                onChange={(e) => setReason(e.target.value)}
              />
            </label>
            <div className="dialog-footer">
              <Button
                type="button"
                variant="outline"
                disabled={busy}
                onClick={() => setAccount(null)}
              >
                Cancel
              </Button>
              <Button disabled={busy} variant={account.suspended ? 'default' : 'destructive'}>
                {busy ? 'Saving…' : account.suspended ? 'Restore access' : 'Confirm suspension'}
              </Button>
            </div>
          </form>
        </Dialog>
      )}
      {post && (
        <Dialog
          open
          onOpenChange={(o) => !o && !busy && setPost(null)}
          title={post.id ? 'Edit announcement' : 'New announcement'}
          description="Published announcements appear in student workspaces."
        >
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              if (
                await change({
                  action: 'announcement',
                  id: post.id || null,
                  title: post.title,
                  body: post.body,
                  published: post.published,
                })
              )
                setPost(null);
            }}
          >
            <div className="form-grid">
              <label className="field wide">
                <span>Title</span>
                <input
                  required
                  maxLength={150}
                  value={post.title}
                  onChange={(e) => setPost({ ...post, title: e.target.value })}
                />
              </label>
              <label className="field wide">
                <span>Message</span>
                <textarea
                  required
                  maxLength={4000}
                  rows={6}
                  value={post.body}
                  onChange={(e) => setPost({ ...post, body: e.target.value })}
                />
              </label>
            </div>
            <label className="check-label">
              <input
                type="checkbox"
                checked={post.published}
                onChange={(e) => setPost({ ...post, published: e.target.checked })}
              />
              Publish to student workspaces
            </label>
            <div className="dialog-footer">
              <Button type="button" variant="outline" disabled={busy} onClick={() => setPost(null)}>
                Cancel
              </Button>
              <Button disabled={busy}>
                {busy ? 'Saving…' : post.published ? 'Save & publish' : 'Save draft'}
              </Button>
            </div>
          </form>
        </Dialog>
      )}
    </main>
  );
}
