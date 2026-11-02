'use client';
import { useState } from 'react';
import { Plus, Trash2, TrendingUp, Target, BookOpen } from 'lucide-react';
import { useWorkspace } from './workspace-provider';
import { Button } from './ui/button';
import { Dialog } from './ui/dialog';
import { Field, SubjectSelect } from './editors';
import { PageHeading, Empty, Progress } from './dashboard';
import { weightedGrade, requiredScore } from '@/lib/academic';
import { uid, dateLabel } from '@/lib/utils';
import type { Grade, GradeCategory } from '@/lib/types';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from 'recharts';
export function Grades() {
  const { data, remove } = useWorkspace(),
    [subject, setSubject] = useState(''),
    [editor, setEditor] = useState<Grade | null | undefined>(),
    [category, setCategory] = useState<GradeCategory | null | undefined>();
  const subjects = data.subjects.filter((s) => !s.archived),
    active = subject || subjects[0]?.id || '',
    s = data.subjects.find((s) => s.id === active),
    cats = data.grade_categories.filter((c) => c.subject_id === active),
    grades = data.grades.filter((g) => g.subject_id === active),
    result = weightedGrade(cats, grades),
    needed = requiredScore(data.preferences.target_grade, result.earned, result.remainingWeight),
    total = cats.reduce((n, c) => n + c.weight, 0);
  const sorted = [...grades].sort((a, b) => a.assessed_at.localeCompare(b.assessed_at));
  const trend = sorted.map((g, i) => ({
    date: dateLabel(g.assessed_at, data.preferences.timezone),
    grade: weightedGrade(cats, sorted.slice(0, i + 1)).current,
  }));
  return (
    <>
      <PageHeading
        eyebrow="EFFORT YOU CAN SEE"
        title="Know where you stand."
        description="Track your results, understand your progress, and plan for your goals."
        action={
          <Button disabled={!active || !cats.length} onClick={() => setEditor(null)}>
            <Plus size={17} />
            Record a grade
          </Button>
        }
      />
      {!subjects.length ? (
        <section className="panel">
          <Empty
            title="Start with a subject"
            body="Add your subjects, then define the grade categories your course uses."
          />
        </section>
      ) : (
        <>
          <div className="toolbar">
            <select
              aria-label="Grade subject"
              value={active}
              onChange={(e) => setSubject(e.target.value)}
            >
              {subjects.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.code} · {s.name}
                </option>
              ))}
            </select>
            <span className="small muted">{s?.instructor}</span>
          </div>
          <div className="stats-grid">
            <div className="stat-card">
              <span>Current weighted grade</span>
              <strong>{result.current === null ? '—' : `${result.current.toFixed(1)}%`}</strong>
              <p>Normalized to assessed categories</p>
            </div>
            <div className="stat-card">
              <span>Your target</span>
              <strong>{data.preferences.target_grade}%</strong>
              <p>Customize in settings</p>
            </div>
            <div className="stat-card">
              <span>Remaining category weight</span>
              <strong>{result.remainingWeight}%</strong>
              <p>Categories without recorded scores</p>
            </div>
            <div className="stat-card">
              <span>Required remaining average</span>
              <strong>
                {needed === null
                  ? '—'
                  : needed > 100
                    ? '>100%'
                    : `${Math.max(0, needed).toFixed(1)}%`}
              </strong>
              <p>
                {needed !== null && needed > 100
                  ? 'Target exceeds available weight'
                  : 'To reach your target grade'}
              </p>
            </div>
          </div>
          <div className="two-columns">
            <section className="panel">
              <div className="panel-heading">
                <h2>Grading components</h2>
                <Button size="sm" variant="outline" onClick={() => setCategory(null)}>
                  <Plus size={14} />
                  Category
                </Button>
              </div>
              <p className="panel-padding small muted">
                Weights: {total}% / 100%.{' '}
                {total !== 100
                  ? 'Define the full 100% for a reliable final projection.'
                  : 'All course weights accounted for.'}
              </p>
              {cats.map((c) => (
                <div className="category-row" key={c.id}>
                  <button onClick={() => setCategory(c)}>
                    <strong>{c.name}</strong>
                    <span>{c.weight}% of final grade</span>
                  </button>
                  <button
                    className="icon-button"
                    aria-label={`Delete ${c.name}`}
                    onClick={() => {
                      if (confirm('Delete this category and its recorded grades?'))
                        void remove('grade_categories', c.id);
                    }}
                  >
                    <Trash2 size={15} />
                  </button>
                </div>
              ))}
              {!cats.length && (
                <Empty
                  title="Your course, your grading system"
                  body="Add weighted components such as quizzes, exams, projects, or participation."
                />
              )}
              <div className="panel-padding small muted">{data.preferences.grading_scale}</div>
            </section>
            <section className="panel panel-padding">
              <h2>Performance trend</h2>
              <div className="chart-container tall">
                {trend.length ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={trend}>
                      <CartesianGrid vertical={false} stroke="var(--line)" />
                      <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                      <YAxis domain={[0, 100]} tick={{ fontSize: 11 }} />
                      <Tooltip />
                      <Line
                        dataKey="grade"
                        type="monotone"
                        stroke={s?.color || '#766bd3'}
                        strokeWidth={3}
                        dot={{ r: 4 }}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                ) : (
                  <Empty
                    title="A story in the making"
                    body="Your performance trend appears when you record grades."
                  />
                )}
              </div>
            </section>
          </div>
          <section className="panel">
            <div className="panel-heading">
              <h2>Recorded assessments</h2>
              <span className="count-pill">{grades.length}</span>
            </div>
            <div className="table-scroll">
              <table>
                <thead>
                  <tr>
                    <th>Assessment</th>
                    <th>Category</th>
                    <th>Score</th>
                    <th>Result</th>
                    <th>Date</th>
                    <th>
                      <span className="sr-only">Actions</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {[...grades]
                    .sort((a, b) => b.assessed_at.localeCompare(a.assessed_at))
                    .map((g) => (
                      <tr key={g.id}>
                        <td>
                          <button className="link-button" onClick={() => setEditor(g)}>
                            {g.title}
                          </button>
                        </td>
                        <td>{cats.find((c) => c.id === g.category_id)?.name}</td>
                        <td>
                          {g.score} / {g.maximum}
                        </td>
                        <td>{((g.score / g.maximum) * 100).toFixed(1)}%</td>
                        <td>{dateLabel(g.assessed_at, data.preferences.timezone)}</td>
                        <td>
                          <button
                            className="icon-button"
                            aria-label={`Delete ${g.title}`}
                            onClick={() => {
                              if (confirm('Delete grade?')) void remove('grades', g.id);
                            }}
                          >
                            <Trash2 size={15} />
                          </button>
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
              {!grades.length && (
                <p className="panel-padding muted">
                  No scores yet. Record your first assessment to get started.
                </p>
              )}
            </div>
          </section>
          <p className="small muted">
            Scores within a category are pooled by points. A category counts as assessed once it has
            a score. Required-score projections apply to unassessed categories and assume total
            weights of 100%.
          </p>
        </>
      )}
      {editor !== undefined && (
        <GradeEditor
          key={editor?.id || active}
          value={editor}
          subjectId={active}
          onClose={() => setEditor(undefined)}
        />
      )}{' '}
      {category !== undefined && (
        <CategoryEditor
          key={category?.id || active}
          value={category}
          subjectId={active}
          onClose={() => setCategory(undefined)}
        />
      )}
    </>
  );
}
function GradeEditor({
  value,
  subjectId,
  onClose,
}: {
  value: Grade | null;
  subjectId: string;
  onClose: () => void;
}) {
  const { data, save } = useWorkspace(),
    [v, setV] = useState<Grade>(
      value || {
        id: uid(),
        subject_id: subjectId,
        category_id: data.grade_categories.find((c) => c.subject_id === subjectId)?.id || '',
        title: '',
        score: 0,
        maximum: 100,
        assessed_at: new Date().toISOString(),
      },
    ),
    [busy, setBusy] = useState(false);
  return (
    <Dialog
      open
      onOpenChange={(o) => !o && onClose()}
      title={value ? 'Edit grade' : 'Record a grade'}
    >
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          setBusy(true);
          if (await save('grades', v)) onClose();
          setBusy(false);
        }}
      >
        <div className="form-grid">
          <Field label="Assessment name" wide>
            <input
              autoFocus
              required
              value={v.title}
              onChange={(e) => setV({ ...v, title: e.target.value })}
            />
          </Field>
          <Field label="Category" wide>
            <select
              required
              value={v.category_id}
              onChange={(e) => setV({ ...v, category_id: e.target.value })}
            >
              <option value="">Select category</option>
              {data.grade_categories
                .filter((c) => c.subject_id === subjectId)
                .map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name} ({c.weight}%)
                  </option>
                ))}
            </select>
          </Field>
          <Field label="Score">
            <input
              type="number"
              step="any"
              min={0}
              required
              value={v.score}
              onChange={(e) => setV({ ...v, score: +e.target.value })}
            />
          </Field>
          <Field label="Maximum points">
            <input
              type="number"
              step="any"
              min={0.01}
              required
              value={v.maximum}
              onChange={(e) => setV({ ...v, maximum: +e.target.value })}
            />
          </Field>
          <Field label="Assessment date">
            <input
              type="date"
              required
              value={v.assessed_at.slice(0, 10)}
              onChange={(e) =>
                e.target.value &&
                setV({ ...v, assessed_at: new Date(`${e.target.value}T12:00:00`).toISOString() })
              }
            />
          </Field>
        </div>
        <div className="dialog-footer">
          <Button disabled={busy}>Save grade</Button>
        </div>
      </form>
    </Dialog>
  );
}
function CategoryEditor({
  value,
  subjectId,
  onClose,
}: {
  value: GradeCategory | null;
  subjectId: string;
  onClose: () => void;
}) {
  const { save } = useWorkspace(),
    [v, setV] = useState<GradeCategory>(
      value || { id: uid(), subject_id: subjectId, name: '', weight: 20 },
    );
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()} title="Grading category">
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          if (await save('grade_categories', v)) onClose();
        }}
      >
        <div className="form-grid">
          <Field label="Category name">
            <input
              required
              value={v.name}
              onChange={(e) => setV({ ...v, name: e.target.value })}
              placeholder="e.g. Examinations"
            />
          </Field>
          <Field label="Weight (%)">
            <input
              type="number"
              required
              min={0.01}
              max={100}
              step="any"
              value={v.weight}
              onChange={(e) => setV({ ...v, weight: +e.target.value })}
            />
          </Field>
        </div>
        <div className="dialog-footer">
          <Button>Save category</Button>
        </div>
      </form>
    </Dialog>
  );
}
