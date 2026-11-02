import { emptyData, type Task } from './types';
export function sampleData() {
  const d = emptyData(),
    now = new Date(),
    date = (days: number, hour = 18) => {
      const n = new Date(+now + days * 86400000);
      n.setHours(hour, 0, 0, 0);
      return n.toISOString();
    };
  d.subjects = [
    {
      id: crypto.randomUUID(),
      name: 'Human–Computer Interaction',
      code: 'CS 304',
      instructor: 'Dr. Isabel Reyes',
      color: '#7964dc',
      semester: '1st Semester',
      academic_year: '2026–2027',
      notes: 'Design thoughtful, human-centered experiences.',
      archived: false,
    },
    {
      id: crypto.randomUUID(),
      name: 'Data Structures & Algorithms',
      code: 'CS 201',
      instructor: 'Prof. Adrian Cruz',
      color: '#4e8bc9',
      semester: '1st Semester',
      academic_year: '2026–2027',
      notes: 'Monday and Wednesday lectures.',
      archived: false,
    },
    {
      id: crypto.randomUUID(),
      name: 'Applied Mathematics',
      code: 'MATH 203',
      instructor: 'Dr. Sofia Santos',
      color: '#d3984c',
      semester: '1st Semester',
      academic_year: '2026–2027',
      notes: 'Bring a scientific calculator.',
      archived: false,
    },
    {
      id: crypto.randomUUID(),
      name: 'Software Engineering',
      code: 'CS 302',
      instructor: 'Prof. Lucas Tan',
      color: '#4b9a86',
      semester: '1st Semester',
      academic_year: '2026–2027',
      notes: 'Semester team project.',
      archived: false,
    },
  ];
  const specs: [string, number, number, Task['category'], Task['status'], number][] = [
    ['User research & persona report', 0, 1, 'Project', 'In Progress', 65],
    ['Binary search tree implementation', 1, 2, 'Assignment', 'In Progress', 35],
    ['Problem set: differential equations', 2, 3, 'Assignment', 'Not Started', 0],
    ['Sprint 2 presentation', 3, 4, 'Presentation', 'For Review', 90],
    ['Read chapter 4: interaction design', 0, 5, 'Other', 'Not Started', 0],
    ['Algorithm complexity quiz', 1, 6, 'Quiz', 'Not Started', 0],
    ['Project proposal', 3, -2, 'Project', 'Completed', 100],
    ['Linear algebra problem set', 2, -3, 'Assignment', 'Completed', 100],
    ['Usability test plan', 0, -4, 'Research', 'Completed', 100],
    ['Sorting algorithms exercise', 1, -1, 'Assignment', 'Completed', 100],
  ];
  d.tasks = specs.map(([title, s, days, category, status, progress]) => ({
    id: crypto.randomUUID(),
    title,
    subject_id: d.subjects[s].id,
    description: 'Review the course requirements and prepare your submission.',
    category,
    status,
    progress,
    assigned_at: date(-7),
    created_at: date(-7),
    due_at: date(days),
    target_at: null,
    estimated_minutes: category === 'Project' ? 180 : 90,
    difficulty: 3,
    priority: 'Auto',
    auto_progress: false,
    notes: '',
    completed_at: status === 'Completed' ? date(days) : null,
  }));
  d.study_sessions = [
    {
      id: crypto.randomUUID(),
      task_id: d.tasks[0].id,
      title: 'Deep work · Persona report',
      starts_at: date(0, 17),
      ends_at: date(0, 18),
      status: 'Planned',
      actual_minutes: 0,
      kind: 'Study',
    },
    {
      id: crypto.randomUUID(),
      task_id: d.tasks[1].id,
      title: 'Practice · Binary trees',
      starts_at: date(0, 19),
      ends_at: date(0, 20),
      status: 'Planned',
      actual_minutes: 0,
      kind: 'Study',
    },
    ...[-1, -2, -3, -4, -5].map((day, i) => ({
      id: crypto.randomUUID(),
      task_id: d.tasks[i].id,
      title: 'Focus session',
      starts_at: date(day, 17),
      ends_at: date(day, 18),
      status: 'Completed' as const,
      actual_minutes: 40 + i * 5,
      kind: 'Focus' as const,
    })),
  ];
  d.grade_categories = d.subjects.flatMap((s) => [
    { id: crypto.randomUUID(), subject_id: s.id, name: 'Assignments', weight: 40 },
    { id: crypto.randomUUID(), subject_id: s.id, name: 'Examinations', weight: 60 },
  ]);
  d.grades = d.grade_categories.map((c, i) => ({
    id: crypto.randomUUID(),
    subject_id: c.subject_id,
    category_id: c.id,
    title: 'Assessment 1',
    score: [92, 88, 85, 90, 87, 82, 96, 93][i],
    maximum: 100,
    assessed_at: date(-i - 1),
  }));
  d.class_schedules = [
    {
      id: crypto.randomUUID(),
      subject_id: d.subjects[0].id,
      weekday: 1,
      start_time: '09:00',
      end_time: '10:30',
      location: 'Room 302',
    },
    {
      id: crypto.randomUUID(),
      subject_id: d.subjects[1].id,
      weekday: 3,
      start_time: '10:00',
      end_time: '11:30',
      location: 'Computer lab',
    },
  ];
  d.activity_history = [
    {
      id: crypto.randomUUID(),
      title: 'Completed Sorting algorithms exercise',
      created_at: date(-1),
    },
    {
      id: crypto.randomUUID(),
      title: 'Updated User research & persona report',
      created_at: new Date().toISOString(),
    },
  ];
  return d;
}
