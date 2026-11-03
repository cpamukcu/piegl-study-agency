"use client";

import { useActionState, useEffect, useRef } from "react";
import { createCourseAction, updateCourseAction } from "@/app/actions";
import { FieldError, FormMessage, invalidProps } from "@/components/field";
import { BUTTON_PRIMARY, CARD, INPUT, LABEL } from "@/components/ui";
import { INITIAL_ACTION_STATE } from "@/lib/action-state";

type EditableCourse = {
  id: string;
  title: string;
  code: string | null;
  instructor: string | null;
  semester: string | null;
  color: string;
  links: string[];
  notes: string | null;
};

export function CourseForm({ course, defaultColor = "#2f5d62" }: { course?: EditableCourse; defaultColor?: string }) {
  const [state, action, pending] = useActionState(course ? updateCourseAction : createCourseAction, INITIAL_ACTION_STATE);
  const titleRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (course) return;
    const focusIfAsked = () => {
      if (window.location.hash === "#new-course") titleRef.current?.focus();
    };
    focusIfAsked();
    window.addEventListener("hashchange", focusIfAsked);
    return () => window.removeEventListener("hashchange", focusIfAsked);
  }, [course]);

  const saved: Record<string, string> = course
    ? {
        title: course.title,
        code: course.code ?? "",
        instructor: course.instructor ?? "",
        semester: course.semester ?? "",
        color: course.color,
        links: course.links.join("\n"),
        notes: course.notes ?? "",
      }
    : { color: defaultColor };
  const v = state.values ?? saved;
  const e = state.errors;

  return (
    <section id={course ? "edit-course" : "new-course"} aria-labelledby="course-form-heading" className={`${CARD} scroll-mt-8`}>
      <h2 id="course-form-heading" className="text-lg">
        {course ? "Edit course" : "Add a course"}
      </h2>
      <form key={state.nonce} action={action} noValidate className="mt-4 grid gap-4 sm:grid-cols-2">
        {course && <input type="hidden" name="id" value={course.id} />}
        <div className="sm:col-span-2">
          <label htmlFor="course-title" className={LABEL}>
            Title
          </label>
          <input ref={titleRef} id="course-title" name="title" defaultValue={v.title} className={INPUT} {...invalidProps("course", "title", e)} />
          <FieldError form="course" name="title" errors={e} />
        </div>
        <div>
          <label htmlFor="course-code" className={LABEL}>
            Course code
          </label>
          <input id="course-code" name="code" defaultValue={v.code} className={INPUT} />
        </div>
        <div>
          <label htmlFor="course-instructor" className={LABEL}>
            Instructor
          </label>
          <input id="course-instructor" name="instructor" defaultValue={v.instructor} className={INPUT} />
        </div>
        <div>
          <label htmlFor="course-semester" className={LABEL}>
            Semester
          </label>
          <input id="course-semester" name="semester" defaultValue={v.semester} className={INPUT} />
        </div>
        <div>
          <label htmlFor="course-color" className={LABEL}>
            Color
          </label>
          <input id="course-color" name="color" type="color" defaultValue={v.color} className="mt-1.5 h-11 w-20 cursor-pointer rounded-[12px] border border-line-strong bg-surface p-1" {...invalidProps("course", "color", e)} />
          <FieldError form="course" name="color" errors={e} />
        </div>
        <div className="sm:col-span-2">
          <label htmlFor="course-links" className={LABEL}>
            Links (one per line)
          </label>
          <textarea id="course-links" name="links" rows={2} defaultValue={v.links} className={INPUT} {...invalidProps("course", "links", e)} />
          <FieldError form="course" name="links" errors={e} />
        </div>
        <div className="sm:col-span-2">
          <label htmlFor="course-notes" className={LABEL}>
            Notes
          </label>
          <textarea id="course-notes" name="notes" rows={2} defaultValue={v.notes} className={INPUT} />
        </div>
        <div className="flex flex-wrap items-center gap-3 sm:col-span-2">
          <button type="submit" disabled={pending} className={BUTTON_PRIMARY}>
            {pending ? "Saving…" : course ? "Save changes" : "Add course"}
          </button>
          <FormMessage state={state} />
        </div>
      </form>
    </section>
  );
}
