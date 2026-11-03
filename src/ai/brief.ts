// Class Ready Brief: what is sent, what comes back, and how page references are checked.
import { z } from "zod";
import { AiError, type AIProvider } from "@/ai/provider";
import type { Db } from "@/db/connection";
import type { Course } from "@/db/courses";
import { getMaterial, pagesFor, type PageRef } from "@/db/materials";
import { QUESTION_KINDS, createBrief, type Brief, type Cited } from "@/db/study";
import { formatDate } from "@/lib/time";

// About 100k tokens. Larger requests are refused rather than silently cut.
export const MAX_MATERIAL_CHARS = 400_000;

export const PROGRAM_CONTEXT =
  "The student is in Zhejiang University's PIEGL master's programme (Program in Innovation, Entrepreneurship and Global Leadership), " +
  "an English-taught Master of Management run by ZJU's International Campus and School of Management. Students come from many countries.";

export const INTEGRITY_RULES = [
  "You write study aids for the student's own learning. Never write text meant to be submitted as coursework.",
  "Use only the material provided. Do not add facts, authors, cases, statistics or sources that are not in it.",
  "Every item must cite the pages it comes from, using their ref values exactly as given (for example \"2:5\"). Never make up a ref.",
  "If the material is in Chinese, explain in English and keep key Chinese terms in brackets.",
].join("\n");

const refs = z.array(z.string()).describe('Page refs exactly as given in the material, like "1:3"');

export const briefSchema = z.object({
  overview: z.string().describe("3-5 sentences: what this class is about and why it matters"),
  key_points: z.array(z.object({ point: z.string(), refs })).describe("5-8 main points, in teaching order"),
  concepts: z.array(z.object({ term: z.string(), definition: z.string().describe("One or two plain sentences"), refs })).describe("5-12 key terms"),
  ask_in_class: z.array(z.object({ question: z.string(), refs })).describe("3-5 thoughtful questions the student could raise in class"),
  flashcards: z.array(z.object({ front: z.string(), back: z.string(), refs })).describe("8-15 recall cards"),
  practice_questions: z
    .array(z.object({ question: z.string(), kind: z.enum(QUESTION_KINDS), refs }))
    .describe("4-6 questions a professor might ask about this material, from recall to critique"),
});

export type BriefOutput = z.infer<typeof briefSchema>;

export type PromptPage = { ref: string; materialId: string; page: number; title: string; text: string };

export type BriefPreview = {
  pages: PromptPage[];
  chars: number;
  tooLarge: boolean;
  system: string;
  prompt: string;
};

export function briefSystem(): string {
  return `You help a graduate student prepare for a class.\n${PROGRAM_CONTEXT}\n\nRules:\n${INTEGRITY_RULES}`;
}

const escapePage = (text: string) => text.replace(/<\/?page\b/gi, (m) => m.replace("<", "‹"));

// Ref "2:5" means page 5 of the second file chosen.
export function buildBriefPreview(db: Db, course: Course, materialIds: string[], classAt: number | null): BriefPreview {
  const pages: PromptPage[] = [];
  materialIds.forEach((materialId, index) => {
    for (const p of pagesFor(db, [materialId])) {
      if (p.text) pages.push({ ref: `${index + 1}:${p.page}`, materialId, page: p.page, title: p.title, text: p.text });
    }
  });
  const header = [
    `Course: ${course.title}${course.code ? ` (${course.code})` : ""}${course.instructor ? `, taught by ${course.instructor}` : ""}`,
    classAt ? `Class: ${formatDate(classAt)}` : null,
    "",
    "Prepare a Class Ready Brief from the material below. Each page is wrapped in <page ref=\"…\" file=\"…\">…</page>.",
  ]
    .filter((l) => l !== null)
    .join("\n");
  const body = pages.map((p) => `<page ref="${p.ref}" file="${p.title.replace(/"/g, "'")}">\n${escapePage(p.text)}\n</page>`).join("\n\n");
  const prompt = `${header}\n\n${body}`;
  const chars = pages.reduce((n, p) => n + p.text.length, 0);
  return { pages, chars, tooLarge: chars > MAX_MATERIAL_CHARS, system: briefSystem(), prompt };
}

// Maps refs back to real pages; anything that does not match a page that was sent is dropped.
export function resolveRefs(raw: string[], pages: PromptPage[]): PageRef[] {
  const byRef = new Map(pages.map((p) => [p.ref, p]));
  const out: PageRef[] = [];
  for (const r of raw) {
    const page = byRef.get(r.trim().replace(/^ref\s*=?\s*/i, "").replace(/["']/g, ""));
    if (page && !out.some((o) => o.materialId === page.materialId && o.page === page.page)) out.push({ materialId: page.materialId, page: page.page });
  }
  return out;
}

export function citedOnly<T extends { refs: string[] }, U>(items: T[], pages: PromptPage[], map: (item: T, refs: PageRef[]) => U): { kept: U[]; removed: number } {
  const kept: U[] = [];
  let removed = 0;
  for (const item of items) {
    const resolved = resolveRefs(item.refs, pages);
    if (resolved.length === 0) removed += 1;
    else kept.push(map(item, resolved));
  }
  return { kept, removed };
}

export class AiOffError extends AiError {}

export async function generateBrief(
  db: Db,
  provider: AIProvider | null,
  course: Course,
  materialIds: string[],
  classAt: number | null,
  now = Date.now(),
): Promise<Brief> {
  if (!provider) throw new AiOffError("AI is off. Add ANTHROPIC_API_KEY to .env.local to turn it on.");
  if (!course.aiAllowed) throw new AiOffError(`AI is turned off for ${course.title}. Nothing was sent.`);
  const ids = [...new Set(materialIds)].filter((id) => getMaterial(db, id)?.courseId === course.id);
  if (ids.length === 0) throw new AiError("Choose at least one file from this course.");
  const preview = buildBriefPreview(db, course, ids, classAt);
  if (preview.pages.length === 0) throw new AiError("The chosen files have no readable text.");
  if (preview.tooLarge) throw new AiError(`That is ${preview.chars.toLocaleString("en")} characters of text, more than the ${MAX_MATERIAL_CHARS.toLocaleString("en")} limit. Choose fewer files.`);

  const { value, model } = await provider.generate({ kind: "brief", system: preview.system, prompt: preview.prompt, schema: briefSchema });
  const pages = preview.pages;
  const keyPoints = citedOnly(value.key_points, pages, (k, r): Cited => ({ text: k.point, refs: r }));
  const ask = citedOnly(value.ask_in_class, pages, (q, r): Cited => ({ text: q.question, refs: r }));
  const concepts = citedOnly(value.concepts, pages, (c, r) => ({ term: c.term, definition: c.definition, refs: r }));
  const cards = citedOnly(value.flashcards, pages, (f, r) => ({ front: f.front, back: f.back, refs: r }));
  const questions = citedOnly(value.practice_questions, pages, (q, r) => ({ question: q.question, kind: q.kind, refs: r }));
  const removed = keyPoints.removed + ask.removed + concepts.removed + cards.removed + questions.removed;

  const firstTitle = getMaterial(db, ids[0])?.title ?? "Class";
  return createBrief(
    db,
    {
      courseId: course.id,
      title: classAt ? `${course.title}, ${formatDate(classAt)}` : ids.length === 1 ? firstTitle : `${firstTitle} and ${ids.length - 1} more`,
      classAt,
      materialIds: ids,
      model,
      sections: { overview: value.overview, keyPoints: keyPoints.kept, askInClass: ask.kept, removed },
      concepts: concepts.kept,
      flashcards: cards.kept,
      questions: questions.kept,
    },
    now,
  );
}
