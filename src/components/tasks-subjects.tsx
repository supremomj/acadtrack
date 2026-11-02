'use client';
import { useState } from 'react';
import {
  Plus,
  List,
  Columns3,
  CalendarDays,
  Search,
  ArrowUpDown,
  BookOpen,
  ArrowUpRight,
  Archive,
  Trash2,
} from 'lucide-react';
import { useWorkspace } from './workspace-provider';
import { Button } from './ui/button';
import { TaskRow, PageHeading, Empty, Progress, PriorityBadge } from './dashboard';
import { effectivePriority, isOverdue, rankTask, taskProgress } from '@/lib/academic';
import { statuses, categories, type Task, type Subject, type ClassSchedule } from '@/lib/types';
import { uid, dateLabel } from '@/lib/utils';
import { Dialog } from './ui/dialog';
import { Field, SubjectSelect } from './editors';
export function Tasks({
  editTask,
  newTask,
  showCalendar,
  query = '',
}: {
  editTask: (t: Task) => void;
  newTask: () => void;
  showCalendar: () => void;
  query?: string;
}) {
  const { data, save } = useWorkspace();
  const [view, setView] = useState<'list' | 'board'>('list'),
    [search, setSearch] = useState(''),
    [subject, setSubject] = useState(''),
    [status, setStatus] = useState(''),
    [priority, setPriority] = useState(''),
    [category, setCategory] = useState(''),
    [sort, setSort] = useState('smart'),
    [due, setDue] = useState('');
  const filtered = data.tasks
    .filter((t) => {
      const p = effectivePriority(t),
        hours = (+new Date(t.due_at) - Date.now()) / 3600000;
      return (
        `${t.title} ${t.description} ${t.notes}`
          .toLowerCase()
          .includes((search || query).toLowerCase()) &&
        (!subject || t.subject_id === subject) &&
        (!status || (status === 'Overdue' ? isOverdue(t) : t.status === status)) &&
        (!priority || p === priority) &&
        (!category || t.category === category) &&
        (!due || (due === 'overdue' ? isOverdue(t) : hours >= 0 && hours <= Number(due)))
      );
    })
    .sort((a, b) =>
      sort === 'smart'
        ? rankTask(b, data) - rankTask(a, data)
        : sort === 'deadline'
          ? a.due_at.localeCompare(b.due_at)
          : sort === 'title'
            ? a.title.localeCompare(b.title)
            : b.created_at.localeCompare(a.created_at),
    );
  return (
    <>
      <PageHeading
        eyebrow="ONE THING AT A TIME"
        title="Your tasks, under control."
        description="A clear view of what’s next, and what’s already behind you."
        action={
          <Button onClick={newTask}>
            <Plus size={17} />
            Create task
          </Button>
        }
      />
      <div className="toolbar">
        <div className="view-switch">
          <button className={view === 'list' ? 'active' : ''} onClick={() => setView('list')}>
            <List size={15} />
            List
          </button>
          <button className={view === 'board' ? 'active' : ''} onClick={() => setView('board')}>
            <Columns3 size={15} />
            Board
          </button>
          <button onClick={showCalendar}>
            <CalendarDays size={15} />
            Calendar
          </button>
        </div>
        <span className="muted small">{filtered.length} tasks</span>
        <select aria-label="Sort tasks" value={sort} onChange={(e) => setSort(e.target.value)}>
          <option value="smart">Smart priority</option>
          <option value="deadline">Deadline</option>
          <option value="title">Title A–Z</option>
          <option value="recent">Recently added</option>
        </select>
      </div>
      <div className="filters">
        <div className="search-field">
          <Search size={15} />
          <input
            aria-label="Search tasks"
            placeholder="Search tasks…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <select
          aria-label="Filter subject"
          value={subject}
          onChange={(e) => setSubject(e.target.value)}
        >
          <option value="">All subjects</option>
          {data.subjects.map((s) => (
            <option key={s.id} value={s.id}>
              {s.code || s.name}
            </option>
          ))}
        </select>
        <select
          aria-label="Filter status"
          value={status}
          onChange={(e) => setStatus(e.target.value)}
        >
          <option value="">All statuses</option>
          {[...statuses, 'Overdue'].map((s) => (
            <option key={s}>{s}</option>
          ))}
        </select>
        <select
          aria-label="Filter priority"
          value={priority}
          onChange={(e) => setPriority(e.target.value)}
        >
          <option value="">All priorities</option>
          {['Critical', 'High', 'Medium', 'Low'].map((s) => (
            <option key={s}>{s}</option>
          ))}
        </select>
        <select
          aria-label="Filter category"
          value={category}
          onChange={(e) => setCategory(e.target.value)}
        >
          <option value="">All categories</option>
          {categories.map((s) => (
            <option key={s}>{s}</option>
          ))}
        </select>
        <select aria-label="Filter due date" value={due} onChange={(e) => setDue(e.target.value)}>
          <option value="">Any deadline</option>
          <option value="24">Next 24 hours</option>
          <option value="168">Next 7 days</option>
          <option value="overdue">Overdue</option>
        </select>
        {(search || subject || status || priority || category || due) && (
          <button
            className="text-link"
            onClick={() => {
              setSearch('');
              setSubject('');
              setStatus('');
              setPriority('');
              setCategory('');
              setDue('');
            }}
          >
            Clear
          </button>
        )}
      </div>
      {view === 'list' ? (
        <section className="panel task-list-panel">
          <div className="list-heading">
            <span>Task name</span>
            <span>Progress</span>
            <span>Priority</span>
            <span>Deadline</span>
          </div>
          {filtered.length ? (
            filtered.map((t) => <TaskRow key={t.id} task={t} onEdit={editTask} />)
          ) : (
            <Empty
              title="Nothing on this list yet"
              body="Create a task or adjust your filters to find what you need."
              action={
                <Button variant="outline" onClick={newTask}>
                  Create a task
                </Button>
              }
            />
          )}
        </section>
      ) : (
        <div className="kanban">
          {statuses.map((s) => (
            <section
              key={s}
              className={`kanban-column status-${s.toLowerCase().replaceAll(' ', '-')}`}
              onDragOver={(e) => e.preventDefault()}
              onDrop={async (e) => {
                e.preventDefault();
                const id = e.dataTransfer.getData('text/plain'),
                  t = data.tasks.find((t) => t.id === id);
                if (t)
                  await save('tasks', {
                    ...t,
                    status: s,
                    progress: s === 'Completed' ? 100 : t.progress,
                    completed_at: s === 'Completed' ? new Date().toISOString() : null,
                  });
              }}
            >
              <h3>
                <i />
                {s}
                <span>{filtered.filter((t) => t.status === s).length}</span>
              </h3>
              {filtered
                .filter((t) => t.status === s)
                .map((t) => {
                  const subject = data.subjects.find((s) => s.id === t.subject_id);
                  return (
                    <button
                      draggable
                      onDragStart={(e) => e.dataTransfer.setData('text/plain', t.id)}
                      className="kanban-card"
                      key={t.id}
                      onClick={() => editTask(t)}
                    >
                      <span
                        className="subject-tag"
                        style={{ color: subject?.color, background: subject?.color + '15' }}
                      >
                        {subject?.code || 'Personal'}
                      </span>
                      <strong>{t.title}</strong>
                      <Progress value={taskProgress(t, data)} color={subject?.color} />
                      <div>
                        <PriorityBadge task={t} />
                        <span className="small muted">
                          {dateLabel(t.due_at, data.preferences.timezone)}
                        </span>
                      </div>
                    </button>
                  );
                })}
              <button className="kanban-add" onClick={newTask}>
                <Plus size={14} />
                Add task
              </button>
            </section>
          ))}
        </div>
      )}
      <p className="small muted">
        Smart priority considers urgency, work remaining, difficulty, and your study capacity. Drag
        cards between board columns or open a task to change status.
      </p>
    </>
  );
}
export function Subjects({
  editSubject,
  newSubject,
  editTask,
}: {
  editSubject: (s: Subject) => void;
  newSubject: () => void;
  editTask: (t: Task) => void;
}) {
  const { data, remove } = useWorkspace();
  const [archived, setArchived] = useState(false),
    [selected, setSelected] = useState<string | null>(null),
    [schedule, setSchedule] = useState<ClassSchedule | null | undefined>();
  const list = data.subjects.filter((s) => s.archived === archived),
    subject = data.subjects.find((s) => s.id === selected);
  return (
    <>
      <PageHeading
        eyebrow="THE BUILDING BLOCKS"
        title="A place for every subject."
        description="Keep coursework, class schedules, and requirements connected."
        action={
          <Button onClick={newSubject}>
            <Plus size={17} />
            Add subject
          </Button>
        }
      />
      <div className="toolbar">
        <div className="view-switch">
          <button className={!archived ? 'active' : ''} onClick={() => setArchived(false)}>
            Active subjects
          </button>
          <button className={archived ? 'active' : ''} onClick={() => setArchived(true)}>
            <Archive size={14} />
            Archived
          </button>
        </div>
        <span className="small muted">{list.length} subjects</span>
      </div>
      {list.length ? (
        <div className="subject-grid">
          {list.map((s) => {
            const tasks = data.tasks.filter((t) => t.subject_id === s.id),
              done = tasks.filter((t) => t.status === 'Completed').length;
            return (
              <article className="panel subject-card" key={s.id}>
                <div className="subject-card-top">
                  <span
                    className="subject-book"
                    style={{ background: s.color + '15', color: s.color }}
                  >
                    <BookOpen size={23} />
                  </span>
                  <button
                    aria-label={`Edit ${s.name}`}
                    className="icon-button"
                    onClick={() => editSubject(s)}
                  >
                    <ArrowUpRight size={18} />
                  </button>
                </div>
                <span className="subject-code" style={{ color: s.color }}>
                  {s.code || 'SUBJECT'}
                </span>
                <h2>
                  <button onClick={() => setSelected(s.id)}>{s.name}</button>
                </h2>
                <p>{s.instructor || 'Instructor not set'}</p>
                <span className="small muted">
                  {s.semester} · {s.academic_year}
                </span>
                <div className="subject-card-progress">
                  <span>
                    {done} / {tasks.length} tasks completed
                    <b>{tasks.length ? Math.round((done / tasks.length) * 100) : 0}%</b>
                  </span>
                  <Progress
                    value={tasks.length ? (done / tasks.length) * 100 : 0}
                    color={s.color}
                  />
                </div>
                <button className="text-link" onClick={() => setSelected(s.id)}>
                  View subject
                  <ArrowRightIcon />
                </button>
              </article>
            );
          })}
        </div>
      ) : (
        <section className="panel">
          <Empty
            title={archived ? 'Your archived subjects live here' : 'Start with your subjects'}
            body="Give each part of your academic life a place of its own."
            action={<Button onClick={newSubject}>Add a subject</Button>}
          />
        </section>
      )}
      {subject && (
        <Dialog
          open
          onOpenChange={(o) => !o && setSelected(null)}
          title={`${subject.code} · ${subject.name}`}
          description={`${subject.instructor} · ${subject.semester}`}
        >
          <p className="muted">{subject.notes || 'No notes yet.'}</p>
          <div className="section-heading">
            <h3>Class schedule</h3>
            <Button size="sm" variant="outline" onClick={() => setSchedule(null)}>
              <Plus size={13} />
              Add class
            </Button>
          </div>
          {data.class_schedules
            .filter((c) => c.subject_id === subject.id)
            .map((c) => (
              <div className="schedule-record" key={c.id}>
                <button onClick={() => setSchedule(c)}>
                  <strong>
                    {
                      [
                        'Sunday',
                        'Monday',
                        'Tuesday',
                        'Wednesday',
                        'Thursday',
                        'Friday',
                        'Saturday',
                      ][c.weekday]
                    }
                  </strong>
                  <span>
                    {c.start_time.slice(0, 5)} – {c.end_time.slice(0, 5)} · {c.location}
                  </span>
                </button>
                <button
                  className="icon-button"
                  aria-label="Delete class"
                  onClick={() => {
                    if (confirm('Delete recurring class?')) void remove('class_schedules', c.id);
                  }}
                >
                  <Trash2 size={15} />
                </button>
              </div>
            ))}
          <h3 className="spaced-title">Associated tasks</h3>
          {data.tasks
            .filter((t) => t.subject_id === subject.id)
            .map((t) => (
              <TaskRow
                key={t.id}
                task={t}
                compact
                onEdit={(t) => {
                  setSelected(null);
                  editTask(t);
                }}
              />
            ))}
          <div className="dialog-footer">
            <Button
              variant="outline"
              onClick={() => {
                setSelected(null);
                editSubject(subject);
              }}
            >
              Edit subject
            </Button>
          </div>
        </Dialog>
      )}
      {schedule !== undefined && (
        <ClassEditor
          value={schedule}
          subjectId={selected || ''}
          onClose={() => setSchedule(undefined)}
        />
      )}
    </>
  );
}
function ArrowRightIcon() {
  return <ArrowUpRight size={14} />;
}
function ClassEditor({
  value,
  subjectId,
  onClose,
}: {
  value: ClassSchedule | null;
  subjectId: string;
  onClose: () => void;
}) {
  const { save } = useWorkspace(),
    [v, setV] = useState<ClassSchedule>(
      value || {
        id: uid(),
        subject_id: subjectId,
        weekday: 1,
        start_time: '09:00',
        end_time: '10:00',
        location: '',
      },
    );
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()} title="Recurring class">
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          if (await save('class_schedules', v)) onClose();
        }}
      >
        <div className="form-grid">
          <Field label="Subject" wide>
            <SubjectSelect
              required
              value={v.subject_id}
              onChange={(s) => setV({ ...v, subject_id: s })}
            />
          </Field>
          <Field label="Day">
            <select value={v.weekday} onChange={(e) => setV({ ...v, weekday: +e.target.value })}>
              {['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'].map(
                (d, i) => (
                  <option key={d} value={i}>
                    {d}
                  </option>
                ),
              )}
            </select>
          </Field>
          <Field label="Location">
            <input value={v.location} onChange={(e) => setV({ ...v, location: e.target.value })} />
          </Field>
          <Field label="Starts">
            <input
              type="time"
              required
              value={v.start_time.slice(0, 5)}
              onChange={(e) => setV({ ...v, start_time: e.target.value })}
            />
          </Field>
          <Field label="Ends">
            <input
              type="time"
              required
              value={v.end_time.slice(0, 5)}
              onChange={(e) => setV({ ...v, end_time: e.target.value })}
            />
          </Field>
        </div>
        <div className="dialog-footer">
          <Button>Save recurring class</Button>
        </div>
      </form>
    </Dialog>
  );
}
