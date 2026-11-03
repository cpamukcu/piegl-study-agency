import Link from "next/link";
import { connection } from "next/server";
import { deleteQuestionAction } from "@/app/actions";
import { aiStatus } from "@/ai";
import { AiOffNote } from "@/components/ai-status-note";
import { AnswerForm } from "@/components/answer-form";
import { AssessmentView } from "@/components/assessment-view";
import { CourseDot } from "@/components/course-dot";
import { EmptyState } from "@/components/empty-state";
import { PageRefs } from "@/components/page-refs";
import { QuestionForm } from "@/components/question-form";
import { BUTTON_DANGER, BUTTON_SECONDARY, CARD } from "@/components/ui";
import { getDb } from "@/db/connection";
import { listCourses } from "@/db/courses";
import { getMaterial, type Material } from "@/db/materials";
import { getQuestion, listAttempts, listQuestions } from "@/db/study";
import { requestTime } from "@/lib/clock";
import { formatDue } from "@/lib/time";

const KIND_LABELS = { recall: "Recall", explain: "Explain", apply: "Apply", critique: "Critique" } as const;

export async function PracticeData({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const params = await searchParams;
  await connection();
  const db = getDb();
  const now = requestTime();
  const ai = aiStatus();
  const courses = listCourses(db);
  const byId = new Map(courses.map((c) => [c.id, c]));
  const question = typeof params.q === "string" ? getQuestion(db, params.q) : null;

  if (question) {
    const course = byId.get(question.courseId);
    const attempts = listAttempts(db, { questionId: question.id });
    const materials = new Map<string, Material>();
    for (const r of [...question.refs, ...attempts.flatMap((a) => a.assessment.outline.flatMap((o) => o.refs))]) {
      const m = materials.get(r.materialId) ?? getMaterial(db, r.materialId);
      if (m) materials.set(m.id, m);
    }
    const siblings = listQuestions(db, question.briefId ? { briefId: question.briefId } : { courseId: question.courseId });
    const next = siblings[siblings.findIndex((q) => q.id === question.id) + 1];
    const [latest, ...earlier] = attempts;

    return (
      <div className="space-y-6">
        <p className="text-sm">
          <Link href="/practice" className="text-ink-muted hover:text-ink">
            ← All questions
          </Link>
        </p>
        {!ai.on && <AiOffNote />}
        <section aria-labelledby="question-heading" className={CARD}>
          {course && (
            <p className="flex items-center gap-1.5 text-sm text-ink-muted">
              <CourseDot color={course.color} />
              {course.title} · {KIND_LABELS[question.kind]}
            </p>
          )}
          <h2 id="question-heading" className="mt-2 text-xl">
            {question.question}
          </h2>
          {question.refs.length > 0 && (
            <p className="mt-1 text-sm">
              Read first:
              <PageRefs refs={question.refs} materials={materials} />
            </p>
          )}
          {course && !course.aiAllowed && <p className="mt-2 text-sm text-warn">AI is off for this course, so answers cannot be assessed here.</p>}
          <AnswerForm questionId={question.id} disabled={!ai.on || !course?.aiAllowed} />
        </section>

        {latest && (
          <section aria-labelledby="feedback-heading" className={CARD}>
            <h2 id="feedback-heading" className="text-lg">
              Feedback on your answer ({formatDue(latest.createdAt, now)})
            </h2>
            <blockquote className="my-3 whitespace-pre-line border-l-2 border-line pl-3 text-sm text-ink-muted">{latest.answer}</blockquote>
            <AssessmentView attempt={latest} materials={materials} />
          </section>
        )}

        {earlier.length > 0 && (
          <section aria-labelledby="earlier-heading" className={CARD}>
            <h2 id="earlier-heading" className="text-lg">
              Earlier tries
            </h2>
            {earlier.map((a) => (
              <details key={a.id} className="mt-3 text-sm">
                <summary className="cursor-pointer">
                  {formatDue(a.createdAt, now)}: accuracy {a.assessment.accuracy}/5, clarity {a.assessment.clarity}/5, evidence {a.assessment.evidence}/5
                </summary>
                <blockquote className="my-3 whitespace-pre-line border-l-2 border-line pl-3 text-ink-muted">{a.answer}</blockquote>
                <AssessmentView attempt={a} materials={materials} />
              </details>
            ))}
          </section>
        )}

        <div className="flex flex-wrap gap-3">
          {next && (
            <Link href={`/practice?q=${next.id}`} className={BUTTON_SECONDARY}>
              Next question →
            </Link>
          )}
          <form action={deleteQuestionAction}>
            <input type="hidden" name="id" value={question.id} />
            <button type="submit" className={BUTTON_DANGER}>
              Delete question
            </button>
          </form>
        </div>
      </div>
    );
  }

  const questions = listQuestions(db);
  const tries = new Map<string, number>();
  for (const a of listAttempts(db)) tries.set(a.questionId, (tries.get(a.questionId) ?? 0) + 1);

  return (
    <div className="space-y-6">
      {!ai.on && <AiOffNote />}
      {questions.length === 0 ? (
        <EmptyState title="Nothing to practise yet" art="talk">
          Questions appear here when you make a Class Ready Brief, or add your own below.
        </EmptyState>
      ) : (
        courses
          .filter((c) => questions.some((q) => q.courseId === c.id))
          .map((c) => (
            <section key={c.id} aria-labelledby={`q-${c.id}`} className={CARD}>
              <h2 id={`q-${c.id}`} className="flex items-center gap-2 text-lg">
                <CourseDot color={c.color} />
                {c.title}
              </h2>
              <ul className="mt-2">
                {questions
                  .filter((q) => q.courseId === c.id)
                  .map((q) => (
                    <li key={q.id} className="border-b border-line py-2 text-sm last:border-b-0">
                      <Link href={`/practice?q=${q.id}`} className="underline-offset-2 hover:underline">
                        <span className="mr-2 rounded-full bg-lavender-50 px-2 py-0.5 text-xs">{KIND_LABELS[q.kind]}</span>
                        {q.question}
                      </Link>
                      {tries.get(q.id) ? <span className="ml-2 text-ink-muted">· answered {tries.get(q.id)}×</span> : null}
                    </li>
                  ))}
              </ul>
            </section>
          ))
      )}
      {courses.length > 0 && <QuestionForm courses={courses.map((c) => ({ id: c.id, title: c.title }))} />}
    </div>
  );
}
