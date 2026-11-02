'use client';
import { useState } from 'react';
import { Trash2, Plus, Paperclip, ExternalLink } from 'lucide-react';
import { Dialog } from './ui/dialog';
import { Button } from './ui/button';
import { useWorkspace } from './workspace-provider';
import {
  statuses,
  categories,
  type Task,
  type Subject,
  type CalendarEvent,
  type StudySession,
} from '@/lib/types';
import { uid, localInput } from '@/lib/utils';
import { browserClient } from '@/lib/supabase/client';
type FieldProps = { label: string; children: React.ReactNode; wide?: boolean };
export function Field({ label, children, wide }: FieldProps) {
  return (
    <label className={wide ? 'field wide' : 'field'}>
      <span>{label}</span>
      {children}
    </label>
  );
}
export function SubjectSelect({
  value,
  onChange,
  required = false,
}: {
  value: string;
  onChange: (v: string) => void;
  required?: boolean;
}) {
  const { data } = useWorkspace();
  return (
    <select value={value} onChange={(e) => onChange(e.target.value)} required={required}>
      <option value="">{required ? 'Select subject' : 'No subject'}</option>
      {data.subjects
        .filter((s) => !s.archived || s.id === value)
        .map((s) => (
          <option key={s.id} value={s.id}>
            {s.code} · {s.name}
          </option>
        ))}
    </select>
  );
}
export function TaskEditor({ task, onClose }: { task: Task | null; onClose: () => void }) {
  const { data, save, remove, mode, notify, reload } = useWorkspace();
  const isNew = !task;
  const [v, setV] = useState<Task>(
    task || {
      id: uid(),
      subject_id: null,
      title: '',
      description: '',
      category: 'Assignment',
      assigned_at: new Date().toISOString(),
      due_at: new Date(Date.now() + 86400000).toISOString(),
      target_at: null,
      estimated_minutes: 60,
      difficulty: 3,
      priority: data.preferences.default_priority,
      status: 'Not Started',
      progress: 0,
      auto_progress: false,
      notes: '',
      completed_at: null,
      created_at: new Date().toISOString(),
    },
  );
  const [busy, setBusy] = useState(false),
    [sub, setSub] = useState('');
  const patch = (p: Partial<Task>) => setV((v) => ({ ...v, ...p }));
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    const ok = await save('tasks', {
      ...v,
      progress: v.status === 'Completed' ? 100 : v.progress,
      completed_at: v.status === 'Completed' ? v.completed_at || new Date().toISOString() : null,
    });
    setBusy(false);
    if (ok) onClose();
  }
  async function upload(file: File) {
    if (mode === 'local') {
      notify('Attachments require a connected Supabase workspace.');
      return;
    }
    setBusy(true);
    try {
      const body = new FormData();
      body.set('file', file);
      body.set('task_id', v.id);
      const r = await fetch('/api/upload', { method: 'POST', body });
      const result = await r.json();
      if (!r.ok) throw new Error(result.error);
      await reload();
      notify('Attachment uploaded');
    } catch (e) {
      notify((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <Dialog
      open
      onOpenChange={(o) => !o && onClose()}
      title={isNew ? 'Create a task' : 'Task details'}
      description="A clear next step brings you closer."
    >
      <form onSubmit={submit}>
        <div className="form-grid">
          <Field label="Task title" wide>
            <input
              autoFocus
              required
              maxLength={200}
              value={v.title}
              placeholder="What do you need to get done?"
              onChange={(e) => patch({ title: e.target.value })}
            />
          </Field>
          <Field label="Subject">
            <SubjectSelect
              value={v.subject_id || ''}
              onChange={(s) => patch({ subject_id: s || null })}
            />
          </Field>
          <Field label="Category">
            <select
              value={v.category}
              onChange={(e) => patch({ category: e.target.value as Task['category'] })}
            >
              {categories.map((s) => (
                <option key={s}>{s}</option>
              ))}
            </select>
          </Field>
          <Field label="Actual submission deadline">
            <input
              type="datetime-local"
              required
              value={localInput(v.due_at)}
              onChange={(e) =>
                e.target.value && patch({ due_at: new Date(e.target.value).toISOString() })
              }
            />
          </Field>
          <Field label="Personal target (optional)">
            <input
              type="datetime-local"
              value={v.target_at ? localInput(v.target_at) : ''}
              onChange={(e) =>
                patch({ target_at: e.target.value ? new Date(e.target.value).toISOString() : null })
              }
            />
          </Field>
          <Field label="Date assigned">
            <input
              type="datetime-local"
              required
              value={localInput(v.assigned_at)}
              onChange={(e) =>
                e.target.value && patch({ assigned_at: new Date(e.target.value).toISOString() })
              }
            />
          </Field>
          <Field label="Status">
            <select
              value={v.status}
              onChange={(e) => patch({ status: e.target.value as Task['status'] })}
            >
              {statuses.map((s) => (
                <option key={s}>{s}</option>
              ))}
            </select>
          </Field>
          <Field label="Priority">
            <select
              value={v.priority}
              onChange={(e) => patch({ priority: e.target.value as Task['priority'] })}
            >
              {['Auto', 'Critical', 'High', 'Medium', 'Low'].map((s) => (
                <option key={s}>{s}</option>
              ))}
            </select>
          </Field>
          <Field label="Estimated work (minutes)">
            <input
              type="number"
              required
              min={1}
              max={100000}
              value={v.estimated_minutes}
              onChange={(e) => patch({ estimated_minutes: +e.target.value })}
            />
          </Field>
          <Field label="Difficulty">
            <select value={v.difficulty} onChange={(e) => patch({ difficulty: +e.target.value })}>
              {[1, 2, 3, 4, 5].map((n) => (
                <option key={n} value={n}>
                  {n} ·{' '}
                  {['Very easy', 'Easy', 'Moderate', 'Challenging', 'Very challenging'][n - 1]}
                </option>
              ))}
            </select>
          </Field>
          <Field label={`Progress · ${v.progress}%`}>
            <input
              type="range"
              min={0}
              max={100}
              disabled={v.auto_progress}
              value={v.progress}
              onChange={(e) => patch({ progress: +e.target.value })}
            />
          </Field>
          <Field label="Description" wide>
            <textarea
              value={v.description}
              onChange={(e) => patch({ description: e.target.value })}
              placeholder="Requirements, links, and context…"
            />
          </Field>
          <Field label="Notes" wide>
            <textarea
              value={v.notes}
              onChange={(e) => patch({ notes: e.target.value })}
              placeholder="Your working notes…"
            />
          </Field>
        </div>
        <label className="check-label">
          <input
            type="checkbox"
            checked={v.auto_progress}
            onChange={(e) => patch({ auto_progress: e.target.checked })}
          />
          Calculate progress from subtasks
        </label>
        <p className="muted small">
          Date inputs use your device timezone. Your workspace displays dates in{' '}
          {data.preferences.timezone}.
        </p>
        <div className="dialog-footer">
          {!isNew && (
            <Button
              type="button"
              variant="destructive"
              onClick={async () => {
                if (confirm('Delete this task and its subtasks?') && (await remove('tasks', v.id)))
                  onClose();
              }}
            >
              <Trash2 size={15} />
              Delete
            </Button>
          )}
          <Button type="button" variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button disabled={busy}>
            {busy ? 'Saving…' : isNew ? 'Create task' : 'Save changes'}
          </Button>
        </div>
      </form>
      {!isNew && (
        <div className="task-extras">
          <h4>Subtasks</h4>
          {data.subtasks
            .filter((s) => s.task_id === v.id)
            .map((s) => (
              <div className="subtask" key={s.id}>
                <input
                  aria-label={s.title}
                  type="checkbox"
                  checked={s.completed}
                  onChange={(e) => void save('subtasks', { ...s, completed: e.target.checked })}
                />
                <span>{s.title}</span>
                <button
                  className="icon-button"
                  aria-label="Delete subtask"
                  onClick={() => void remove('subtasks', s.id)}
                >
                  <Trash2 size={14} />
                </button>
              </div>
            ))}
          <form
            className="inline-form"
            onSubmit={async (e) => {
              e.preventDefault();
              if (
                sub.trim() &&
                (await save('subtasks', {
                  id: uid(),
                  task_id: v.id,
                  title: sub.trim(),
                  completed: false,
                }))
              )
                setSub('');
            }}
          >
            <input
              value={sub}
              onChange={(e) => setSub(e.target.value)}
              placeholder="Add a small next step…"
              required
            />
            <Button variant="outline" size="icon" aria-label="Add subtask">
              <Plus size={17} />
            </Button>
          </form>
          <h4>
            Attachments <small className="muted">PDF, images, documents · 10 MB max</small>
          </h4>
          {data.task_attachments
            .filter((a) => a.task_id === v.id)
            .map((a) => (
              <div className="subtask" key={a.id}>
                <Paperclip size={15} />
                <button
                  className="link-button"
                  onClick={async () => {
                    const r = await fetch(`/api/upload?id=${a.id}`),
                      d = await r.json();
                    if (d.url) window.open(d.url, '_blank', 'noopener,noreferrer');
                    else notify(d.error || 'Could not open file');
                  }}
                >
                  {a.name} <ExternalLink size={12} />
                </button>
                <button
                  className="icon-button"
                  aria-label="Delete attachment"
                  onClick={async () => {
                    if (!confirm('Delete this attachment?')) return;
                    if (mode === 'cloud') {
                      const { error } = await browserClient()
                        .storage.from('attachments')
                        .remove([a.path]);
                      if (error) {
                        notify(error.message);
                        return;
                      }
                    }
                    await remove('task_attachments', a.id);
                  }}
                >
                  <Trash2 size={14} />
                </button>
              </div>
            ))}
          <input
            aria-label="Upload attachment"
            type="file"
            accept=".pdf,.png,.jpg,.jpeg,.txt,.docx,.xlsx"
            disabled={busy}
            onChange={(e) => e.target.files?.[0] && void upload(e.target.files[0])}
          />
        </div>
      )}
    </Dialog>
  );
}
export function SubjectEditor({
  subject,
  onClose,
}: {
  subject: Subject | null;
  onClose: () => void;
}) {
  const { save, remove } = useWorkspace();
  const [v, setV] = useState<Subject>(
      subject || {
        id: uid(),
        name: '',
        code: '',
        instructor: '',
        semester: '1st Semester',
        academic_year: '2026–2027',
        color: '#7562dc',
        notes: '',
        archived: false,
      },
    ),
    [busy, setBusy] = useState(false);
  return (
    <Dialog
      open
      onOpenChange={(o) => !o && onClose()}
      title={subject ? 'Edit subject' : 'Add a subject'}
    >
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          setBusy(true);
          if (await save('subjects', v)) onClose();
          setBusy(false);
        }}
      >
        <div className="form-grid">
          {(['name', 'code', 'instructor', 'semester', 'academic_year'] as const).map((k) => (
            <Field key={k} label={k.replaceAll('_', ' ')} wide={k === 'name'}>
              <input
                required={k === 'name'}
                value={v[k]}
                onChange={(e) => setV({ ...v, [k]: e.target.value })}
              />
            </Field>
          ))}
          <Field label="Subject color">
            <input
              type="color"
              value={v.color}
              onChange={(e) => setV({ ...v, color: e.target.value })}
            />
          </Field>
          <Field label="Notes" wide>
            <textarea value={v.notes} onChange={(e) => setV({ ...v, notes: e.target.value })} />
          </Field>
        </div>
        <label className="check-label">
          <input
            type="checkbox"
            checked={v.archived}
            onChange={(e) => setV({ ...v, archived: e.target.checked })}
          />
          Archived
        </label>
        <div className="dialog-footer">
          {subject && (
            <Button
              type="button"
              variant="destructive"
              onClick={async () => {
                if (
                  confirm('Delete subject, its tasks, grades and class schedules?') &&
                  (await remove('subjects', v.id))
                )
                  onClose();
              }}
            >
              Delete subject
            </Button>
          )}
          <Button type="button" variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button disabled={busy}>Save subject</Button>
        </div>
      </form>
    </Dialog>
  );
}
export function EventEditor({
  event,
  onClose,
  initial,
}: {
  event: CalendarEvent | null;
  onClose: () => void;
  initial?: string;
}) {
  const { save, remove } = useWorkspace();
  const [v, setV] = useState<CalendarEvent>(
      event || {
        id: uid(),
        title: '',
        subject_id: null,
        starts_at: initial || new Date().toISOString(),
        ends_at: new Date(+new Date(initial || Date.now()) + 3600000).toISOString(),
        kind: 'Personal',
        notes: '',
      },
    ),
    [busy, setBusy] = useState(false);
  return (
    <Dialog
      open
      onOpenChange={(o) => !o && onClose()}
      title={event ? 'Edit event' : 'Create an event'}
    >
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          setBusy(true);
          if (await save('calendar_events', v)) onClose();
          setBusy(false);
        }}
      >
        <div className="form-grid">
          <Field label="Event title" wide>
            <input
              required
              value={v.title}
              onChange={(e) => setV({ ...v, title: e.target.value })}
            />
          </Field>
          <Field label="Subject">
            <SubjectSelect
              value={v.subject_id || ''}
              onChange={(s) => setV({ ...v, subject_id: s || null })}
            />
          </Field>
          <Field label="Type">
            <select
              value={v.kind}
              onChange={(e) => setV({ ...v, kind: e.target.value as CalendarEvent['kind'] })}
            >
              {['Personal', 'Exam', 'Project', 'Class'].map((k) => (
                <option key={k}>{k}</option>
              ))}
            </select>
          </Field>
          {(['starts_at', 'ends_at'] as const).map((k) => (
            <Field key={k} label={k === 'starts_at' ? 'Starts' : 'Ends'}>
              <input
                type="datetime-local"
                required
                value={localInput(v[k])}
                onChange={(e) =>
                  e.target.value && setV({ ...v, [k]: new Date(e.target.value).toISOString() })
                }
              />
            </Field>
          ))}
          <Field label="Notes" wide>
            <textarea value={v.notes} onChange={(e) => setV({ ...v, notes: e.target.value })} />
          </Field>
        </div>
        <div className="dialog-footer">
          {event && (
            <Button
              variant="destructive"
              type="button"
              onClick={async () => {
                if (confirm('Delete event?') && (await remove('calendar_events', v.id))) onClose();
              }}
            >
              Delete
            </Button>
          )}
          <Button disabled={busy}>Save event</Button>
        </div>
      </form>
    </Dialog>
  );
}
export function SessionEditor({
  session,
  onClose,
}: {
  session: StudySession | null;
  onClose: () => void;
}) {
  const { data, save, remove } = useWorkspace();
  const [v, setV] = useState<StudySession>(
      session || {
        id: uid(),
        task_id: null,
        title: 'Study session',
        starts_at: new Date().toISOString(),
        ends_at: new Date(Date.now() + 25 * 60000).toISOString(),
        status: 'Planned',
        actual_minutes: 0,
        kind: 'Study',
      },
    ),
    [busy, setBusy] = useState(false);
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()} title="Plan your study session">
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          setBusy(true);
          if (await save('study_sessions', v)) onClose();
          setBusy(false);
        }}
      >
        <div className="form-grid">
          <Field label="Title" wide>
            <input
              required
              value={v.title}
              onChange={(e) => setV({ ...v, title: e.target.value })}
            />
          </Field>
          <Field label="Task" wide>
            <select
              value={v.task_id || ''}
              onChange={(e) => setV({ ...v, task_id: e.target.value || null })}
            >
              <option value="">General study</option>
              {data.tasks.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.title}
                </option>
              ))}
            </select>
          </Field>
          {(['starts_at', 'ends_at'] as const).map((k) => (
            <Field key={k} label={k === 'starts_at' ? 'Starts' : 'Ends'}>
              <input
                required
                type="datetime-local"
                value={localInput(v[k])}
                onChange={(e) =>
                  e.target.value && setV({ ...v, [k]: new Date(e.target.value).toISOString() })
                }
              />
            </Field>
          ))}
          <Field label="Status">
            <select
              value={v.status}
              onChange={(e) => setV({ ...v, status: e.target.value as StudySession['status'] })}
            >
              {['Planned', 'Completed', 'Rejected'].map((s) => (
                <option key={s}>{s}</option>
              ))}
            </select>
          </Field>
          <Field label="Actual study minutes">
            <input
              type="number"
              min={0}
              max={10000}
              value={v.actual_minutes}
              onChange={(e) => setV({ ...v, actual_minutes: +e.target.value })}
            />
          </Field>
        </div>
        <div className="dialog-footer">
          {session && (
            <Button
              variant="destructive"
              type="button"
              onClick={async () => {
                if (confirm('Delete study session?') && (await remove('study_sessions', v.id)))
                  onClose();
              }}
            >
              Delete
            </Button>
          )}
          <Button disabled={busy}>Save session</Button>
        </div>
      </form>
    </Dialog>
  );
}
