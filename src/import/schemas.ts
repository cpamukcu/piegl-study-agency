import { z } from "zod";
import { shanghaiToMs } from "@/lib/time";

const time = z.string().nullable();

const realDate = z.string().refine(
  (value) => {
    try {
      shanghaiToMs(value);
      return true;
    } catch {
      return false;
    }
  },
  { error: "must be a real date like 2026-09-14" },
);

export const tronclassSnapshotSchema = z.object({
  source: z.string(),
  fetched_at: z.string(),
  todos: z.array(
    z.object({
      id: z.number(),
      type: z.string(),
      title: z.string(),
      course_id: z.number(),
      course_name: z.string(),
      end_time: time,
    }),
  ),
  courses: z.array(
    z.object({
      id: z.number(),
      name: z.string(),
      code: z.string().nullable(),
      credit: z.number().nullable(),
      department: z.string().nullable(),
      semester: z.string().nullable(),
      academic_year: z.string().nullable(),
      start_date: z.string().nullable(),
      end_date: z.string().nullable(),
      instructors: z.array(z.string()),
      activities: z.array(
        z.object({
          id: z.number(),
          type: z.string(),
          title: z.string(),
          start_time: time,
          end_time: time,
          is_closed: z.boolean().nullable(),
          published: z.boolean().nullable(),
          module_id: z.number().nullable(),
          uploads: z.array(
            z.object({ id: z.number(), name: z.string(), size: z.number().nullable(), type: z.string().nullable() }),
          ),
        }),
      ),
      exams: z.array(
        z.object({
          id: z.number(),
          type: z.string(),
          title: z.string(),
          start_time: time,
          end_time: time,
          is_closed: z.boolean().nullable(),
        }),
      ),
    }),
  ),
});

export type TronclassSnapshot = z.infer<typeof tronclassSnapshotSchema>;

export const yjsySnapshotSchema = z.object({
  source: z.string(),
  fetched_at: z.string(),
  calendar: z.object({
    year: z.string(),
    term_code: z.string(),
    start: realDate,
    end: z.string().nullable(),
    weeks: z.number().int().positive(),
    teaching_weeks: z.number().nullable(),
    exam_weeks: z.number().nullable(),
    periods: z.array(z.object({ period: z.number(), start: z.number(), end: z.number(), part: z.string().nullable() })),
  }),
  classes: z.array(
    z.object({
      course: z.string(),
      class_no: z.string(),
      teacher: z.string().nullable(),
      weekday: z.number().int().min(1).max(7),
      start_period: z.number(),
      end_period: z.number(),
      weeks: z.string(),
      term: z.string().nullable(),
      campus: z.string().nullable(),
      building: z.string().nullable(),
      room: z.string().nullable(),
    }),
  ),
  notices: z.array(
    z.object({
      course: z.string(),
      course_code: z.string().nullable(),
      class_no: z.string(),
      college: z.string().nullable(),
      teacher: z.string().nullable(),
      credit: z.number().nullable(),
      hours: z.number().nullable(),
      term: z.string().nullable(),
      note: z.string().nullable(),
      time_place: z.string().nullable(),
      status: z.string().nullable(),
    }),
  ),
});

export type YjsySnapshot = z.infer<typeof yjsySnapshotSchema>;
