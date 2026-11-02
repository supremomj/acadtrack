'use client';
import { useState, useMemo, useRef } from 'react';
import FullCalendar from '@fullcalendar/react';
import dayGridPlugin from '@fullcalendar/daygrid';
import timeGridPlugin from '@fullcalendar/timegrid';
import interactionPlugin from '@fullcalendar/interaction';
import { Plus } from 'lucide-react';
import { useWorkspace } from './workspace-provider';
import { PageHeading } from './dashboard';
import { Button } from './ui/button';
import { EventEditor, SessionEditor } from './editors';
import { zonedDate } from '@/lib/academic';
import type { Task, CalendarEvent, StudySession } from '@/lib/types';
export function AcademicCalendar({ editTask }: { editTask: (t: Task) => void }) {
  const { data, save, notify } = useWorkspace(),
    [event, setEvent] = useState<CalendarEvent | null | undefined>(),
    [session, setSession] = useState<StudySession | null | undefined>(),
    [initial, setInitial] = useState<string>(),
    [filter, setFilter] = useState('all'),
    [subject, setSubject] = useState(''),
    [range, setRange] = useState({
      start: new Date(Date.now() - 35 * 86400000).toISOString(),
      end: new Date(Date.now() + 60 * 86400000).toISOString(),
    });
  const ref = useRef<FullCalendar>(null);
  const events = useMemo(() => {
    const match = (id: string | null) => !subject || id === subject;
    const result = [];
    if (filter === 'all' || filter === 'deadlines')
      for (const t of data.tasks.filter((t) => match(t.subject_id))) {
        const s = data.subjects.find((s) => s.id === t.subject_id);
        result.push({
          id: `task:${t.id}`,
          title: t.title,
          start: t.due_at,
          backgroundColor: s?.color || '#766bd3',
          borderColor: 'transparent',
          className: t.status === 'Completed' ? 'calendar-done' : '',
        });
      }
    if (filter === 'all' || filter === 'events')
      for (const e of data.calendar_events.filter((e) => match(e.subject_id)))
        result.push({
          id: `event:${e.id}`,
          title: e.title,
          start: e.starts_at,
          end: e.ends_at,
          backgroundColor: e.kind === 'Exam' ? '#d98b71' : '#5c9dba',
          borderColor: 'transparent',
        });
    if (filter === 'all' || filter === 'study')
      for (const s of data.study_sessions.filter(
        (s) => s.status === 'Planned' || s.status === 'Completed',
      )) {
        const t = data.tasks.find((t) => t.id === s.task_id);
        if (match(t?.subject_id || null))
          result.push({
            id: `session:${s.id}`,
            title: s.title,
            start: s.starts_at,
            end: s.ends_at,
            backgroundColor: '#5c9d87',
            borderColor: 'transparent',
          });
      }
    if (filter === 'all' || filter === 'classes')
      for (const c of data.class_schedules.filter((c) => match(c.subject_id))) {
        const s = data.subjects.find((s) => s.id === c.subject_id);
        const start = new Date(range.start);
        for (let i = 0; i < 100; i++) {
          const date = new Date(+start + i * 86400000);
          if (+date >= +new Date(range.end)) break;
          const day = date.toISOString().slice(0, 10);
          if (new Date(`${day}T12:00:00Z`).getUTCDay() !== c.weekday) continue;
          result.push({
            id: `class:${c.id}:${day}`,
            title: `${s?.code || 'Class'} · ${c.location}`,
            start: zonedDate(
              day,
              c.start_time.slice(0, 5),
              data.preferences.timezone,
            ).toISOString(),
            end: zonedDate(day, c.end_time.slice(0, 5), data.preferences.timezone).toISOString(),
            backgroundColor: s?.color || '#d29c56',
            borderColor: 'transparent',
            editable: false,
          });
        }
      }
    return result;
  }, [data, filter, subject, range]);
  return (
    <>
      <PageHeading
        eyebrow="SEE THE WEEK AHEAD"
        title="Space for everything that matters."
        description={`Classes, deadlines, and focus time in one place. Calendar grid uses your device timezone; recurring classes use ${data.preferences.timezone}.`}
        action={
          <Button onClick={() => setEvent(null)}>
            <Plus size={17} />
            Create event
          </Button>
        }
      />
      <div className="toolbar">
        <div className="calendar-legend">
          <span>
            <i style={{ background: '#766bd3' }} />
            Deadlines
          </span>
          <span>
            <i style={{ background: '#d29c56' }} />
            Classes
          </span>
          <span>
            <i style={{ background: '#5c9d87' }} />
            Study time
          </span>
          <span>
            <i style={{ background: '#5c9dba' }} />
            Events
          </span>
        </div>
        <select
          aria-label="Calendar type"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
        >
          <option value="all">All activities</option>
          <option value="deadlines">Deadlines</option>
          <option value="classes">Classes</option>
          <option value="study">Study sessions</option>
          <option value="events">Events</option>
        </select>
        <select
          aria-label="Calendar subject"
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
      </div>
      <section className="panel calendar-panel">
        <FullCalendar
          ref={ref}
          plugins={[dayGridPlugin, timeGridPlugin, interactionPlugin]}
          initialView="dayGridMonth"
          headerToolbar={{
            left: 'prev,next today',
            center: 'title',
            right: 'dayGridMonth,timeGridWeek,timeGridDay',
          }}
          buttonText={{ today: 'Today', month: 'Month', week: 'Week', day: 'Day' }}
          firstDay={data.preferences.week_start}
          height="auto"
          editable
          selectable
          dayMaxEvents={3}
          events={events}
          eventTimeFormat={{
            hour: 'numeric',
            minute: '2-digit',
            hour12: data.preferences.time_format === '12h',
          }}
          datesSet={(arg) =>
            setRange((old) =>
              old.start === arg.startStr && old.end === arg.endStr
                ? old
                : { start: arg.startStr, end: arg.endStr },
            )
          }
          select={(arg) => {
            setInitial(arg.start.toISOString());
            setEvent(null);
          }}
          eventClick={(arg) => {
            const [type, id] = arg.event.id.split(':');
            if (type === 'task') {
              const t = data.tasks.find((t) => t.id === id);
              if (t) editTask(t);
            } else if (type === 'event') setEvent(data.calendar_events.find((e) => e.id === id));
            else if (type === 'session') setSession(data.study_sessions.find((s) => s.id === id));
            else notify('Manage recurring classes from the subject details page.');
          }}
          eventDrop={async (arg) => {
            const [type, id] = arg.event.id.split(':');
            if (!arg.event.start) {
              arg.revert();
              return;
            }
            if (type === 'task') {
              const t = data.tasks.find((t) => t.id === id);
              if (
                !t ||
                !confirm(
                  `Change the actual submission deadline for “${t.title}” to ${arg.event.start.toLocaleString()}?`,
                )
              ) {
                arg.revert();
                return;
              }
              const delta = +arg.event.start - +new Date(t.due_at);
              if (
                !(await save('tasks', {
                  ...t,
                  due_at: arg.event.start.toISOString(),
                  target_at: t.target_at
                    ? new Date(+new Date(t.target_at) + delta).toISOString()
                    : null,
                }))
              )
                arg.revert();
            } else if (type === 'event') {
              const e = data.calendar_events.find((e) => e.id === id);
              if (
                e &&
                !(await save('calendar_events', {
                  ...e,
                  starts_at: arg.event.start.toISOString(),
                  ends_at: (arg.event.end || new Date(+arg.event.start + 3600000)).toISOString(),
                }))
              )
                arg.revert();
            } else if (type === 'session') {
              const s = data.study_sessions.find((s) => s.id === id);
              if (
                s &&
                !(await save('study_sessions', {
                  ...s,
                  starts_at: arg.event.start.toISOString(),
                  ends_at: (arg.event.end || new Date(+arg.event.start + 1500000)).toISOString(),
                }))
              )
                arg.revert();
            }
          }}
          eventResize={async (arg) => {
            const [type, id] = arg.event.id.split(':');
            if (!arg.event.start || !arg.event.end) {
              arg.revert();
              return;
            }
            if (type === 'event') {
              const e = data.calendar_events.find((e) => e.id === id);
              if (
                e &&
                !(await save('calendar_events', {
                  ...e,
                  starts_at: arg.event.start.toISOString(),
                  ends_at: arg.event.end.toISOString(),
                }))
              )
                arg.revert();
            } else if (type === 'session') {
              const s = data.study_sessions.find((s) => s.id === id);
              if (
                s &&
                !(await save('study_sessions', {
                  ...s,
                  starts_at: arg.event.start.toISOString(),
                  ends_at: arg.event.end.toISOString(),
                }))
              )
                arg.revert();
            } else arg.revert();
          }}
        />
      </section>
      {event !== undefined && (
        <EventEditor
          key={event?.id || initial || 'new'}
          event={event}
          initial={initial}
          onClose={() => {
            setEvent(undefined);
            setInitial(undefined);
          }}
        />
      )}
      {session !== undefined && (
        <SessionEditor session={session} onClose={() => setSession(undefined)} />
      )}
    </>
  );
}
