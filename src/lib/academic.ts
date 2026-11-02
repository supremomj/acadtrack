import type { Task, Data, Priority, StudySession, Grade, GradeCategory } from './types';
export function effectivePriority(task: Task, now = new Date()): Exclude<Priority, 'Auto'> {
  if (task.priority !== 'Auto') return task.priority;
  const hours = (+new Date(task.due_at) - +now) / 3600000;
  return hours <= 24 ? 'Critical' : hours <= 72 ? 'High' : hours <= 168 ? 'Medium' : 'Low';
}
export function isOverdue(task: Task, now = new Date()) {
  return task.status !== 'Completed' && +new Date(task.due_at) < +now;
}
export function taskProgress(task: Task, data: Data) {
  const subs = data.subtasks.filter((s) => s.task_id === task.id);
  return task.status === 'Completed'
    ? 100
    : task.auto_progress && subs.length
      ? Math.round((subs.filter((s) => s.completed).length / subs.length) * 100)
      : task.progress;
}
export function rankTask(task: Task, data: Data, now = new Date()) {
  if (task.status === 'Completed') return -Infinity;
  const remaining = task.estimated_minutes * (1 - taskProgress(task, data) / 100);
  const hours = Math.max(0.25, (+new Date(task.target_at || task.due_at) - +now) / 3600000);
  const base = { Critical: 100, High: 65, Medium: 30, Low: 10 }[effectivePriority(task, now)];
  return (
    base + (remaining / (hours * 60)) * 100 + task.difficulty * 3 + (isOverdue(task, now) ? 150 : 0)
  );
}
export function atRisk(task: Task, data: Data, now = new Date()) {
  const days = Math.max(0, (+new Date(task.due_at) - +now) / 86400000);
  return (
    task.status !== 'Completed' &&
    (isOverdue(task, now) ||
      task.estimated_minutes * (1 - taskProgress(task, data) / 100) >
        days * data.preferences.daily_hours * 60)
  );
}
export function overlaps(
  a: { starts_at: string; ends_at: string },
  b: { starts_at: string; ends_at: string },
) {
  return (
    +new Date(a.starts_at) < +new Date(b.ends_at) && +new Date(b.starts_at) < +new Date(a.ends_at)
  );
}
export function weightedGrade(categories: GradeCategory[], grades: Grade[]) {
  const scored = categories.map((c) => {
    const g = grades.filter((g) => g.category_id === c.id);
    return {
      weight: c.weight,
      value: g.length
        ? (g.reduce((s, g) => s + g.score, 0) / g.reduce((s, g) => s + g.maximum, 0)) * 100
        : null,
    };
  });
  const used = scored.filter((c) => c.value !== null),
    weight = used.reduce((s, c) => s + c.weight, 0);
  const earned = used.reduce((s, c) => s + ((c.value || 0) * c.weight) / 100, 0);
  return {
    current: weight ? (earned / weight) * 100 : null,
    earned,
    assessedWeight: weight,
    remainingWeight: Math.max(0, 100 - weight),
  };
}
export function requiredScore(target: number, earned: number, remainingWeight: number) {
  return remainingWeight > 0 ? ((target - earned) / remainingWeight) * 100 : null;
}
export function zonedParts(date: Date, zone: string) {
  return Object.fromEntries(
    new Intl.DateTimeFormat('en-CA', {
      timeZone: zone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hourCycle: 'h23',
    })
      .formatToParts(date)
      .map((p) => [p.type, p.value]),
  );
}
export function zonedDate(day: string, time: string, zone: string) {
  const target = new Date(`${day}T${time}:00Z`);
  let result = target;
  for (let i = 0; i < 3; i++) {
    const p = zonedParts(result, zone);
    const local = Date.parse(`${p.year}-${p.month}-${p.day}T${p.hour}:${p.minute}:00Z`);
    result = new Date(+result + (+target - local));
  }
  return result;
}
export function suggestSessions(data: Data, now = new Date()): StudySession[] {
  const p = data.preferences,
    zone = p.timezone;
  const result: StudySession[] = [];
  const work = data.tasks
    .filter((t) => t.status !== 'Completed')
    .sort((a, b) => rankTask(b, data, now) - rankTask(a, data, now))
    .map((t) => ({
      task: t,
      remaining: Math.max(
        0,
        t.estimated_minutes * (1 - taskProgress(t, data) / 100) -
          data.study_sessions
            .filter((s) => s.task_id === t.id && s.status === 'Planned')
            .reduce((n, s) => n + (+new Date(s.ends_at) - +new Date(s.starts_at)) / 60000, 0),
      ),
    }));
  for (let offset = 0; offset < 14; offset++) {
    const parts = zonedParts(new Date(+now + offset * 86400000), zone),
      day = `${parts.year}-${parts.month}-${parts.day}`,
      weekday = new Date(`${day}T12:00:00Z`).getUTCDay();
    if (!p.study_days.includes(weekday)) continue;
    let cursor = zonedDate(day, p.study_start, zone),
      end = zonedDate(day, p.study_end, zone),
      allocated = data.study_sessions
        .filter(
          (s) =>
            s.status === 'Planned' &&
            new Intl.DateTimeFormat('en-CA', { timeZone: zone }).format(new Date(s.starts_at)) ===
              new Intl.DateTimeFormat('en-CA', { timeZone: zone }).format(cursor),
        )
        .reduce((n, s) => n + (+new Date(s.ends_at) - +new Date(s.starts_at)) / 60000, 0);
    const blocks = [
      ...data.calendar_events,
      ...data.study_sessions.filter((s) => s.status === 'Planned'),
      ...data.class_schedules
        .filter((c) => c.weekday === weekday)
        .map((c) => ({
          starts_at: zonedDate(day, c.start_time, zone).toISOString(),
          ends_at: zonedDate(day, c.end_time, zone).toISOString(),
        })),
    ];
    while (+cursor < +end && allocated < p.daily_hours * 60) {
      if (+cursor < +now) {
        cursor = new Date(+cursor + 15 * 60000);
        continue;
      }
      const item = work.find(
        (w) => w.remaining > 0 && +new Date(w.task.target_at || w.task.due_at) > +cursor,
      );
      if (!item) break;
      const minutes = Math.min(p.session_minutes, item.remaining, p.daily_hours * 60 - allocated),
        finish = new Date(+cursor + minutes * 60000);
      if (+finish > +end) break;
      const span = { starts_at: cursor.toISOString(), ends_at: finish.toISOString() };
      if (blocks.some((b) => overlaps(span, b))) {
        cursor = new Date(+cursor + 15 * 60000);
        continue;
      }
      result.push({
        id: crypto.randomUUID(),
        task_id: item.task.id,
        title: item.task.title,
        ...span,
        status: 'Suggested',
        actual_minutes: 0,
        kind: 'Study',
      });
      allocated += minutes;
      item.remaining -= minutes;
      cursor = new Date(+finish + p.break_minutes * 60000);
    }
  }
  return result;
}
