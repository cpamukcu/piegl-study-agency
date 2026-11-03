// Professor Mode: one question, the owner's own answer, an honest rubric assessment.
import { z } from "zod";
import { citedOnly, INTEGRITY_RULES, PROGRAM_CONTEXT, type PromptPage } from "@/ai/brief";
import { AiError, type AIProvider } from "@/ai/provider";
import type { Db } from "@/db/connection";
import type { Course } from "@/db/courses";
import { listPages } from "@/db/materials";
import { getMaterial } from "@/db/materials";
import { addAttempt, type Assessment, type Attempt, type OutlinePoint, type PracticeQuestion } from "@/db/study";

export const MAX_ANSWER_CHARS = 6000;

const score = z.number().int().describe("1 (poor) to 5 (excellent)");

export const assessmentSchema = z.object({
  accuracy: score.describe("Is what the student said correct, judged against the material? 1 to 5"),
  clarity: score.describe("Is the answer well structured and easy to follow? 1 to 5"),
  evidence: score.describe("Does it support claims with concepts, examples or data from the material? 1 to 5"),
  strengths: z.array(z.string()).describe("1-3 things the answer did well"),
  missing: z.array(z.string()).describe("Points a strong answer would include that this one missed or got wrong"),
  outline: z
    .array(
      z.object({
        point: z.string().describe("A short note of at most 15 words, not a full sentence to read out"),
        label: z.enum(["fact", "interpretation"]).describe("fact = stated in the material; interpretation = analysis or opinion"),
        refs: z.array(z.string()).describe('Page refs like "1:3" for facts; empty for interpretation not tied to a page'),
      }),
    )
    .describe("3-6 points a strong answer would cover"),
  follow_up: z.string().describe("One follow-up question the professor might ask next"),
});

export function assessSystem(): string {
  return [
    "You are a fair, demanding professor running an oral practice session with one graduate student.",
    PROGRAM_CONTEXT,
    "",
    "Rules:",
    INTEGRITY_RULES,
    "Assess only what the student actually wrote. Be honest: do not praise a weak answer.",
    "The outline is short notes the student can build their own answer from. Never write a model answer or a script to read out.",
    "Label each outline point: 'fact' if it is stated in the material (cite the page), 'interpretation' if it is analysis or opinion.",
  ].join("\n");
}

const clamp = (n: number) => Math.min(5, Math.max(1, Math.round(n)));

// The cited pages plus their neighbours, so the professor sees the context of each slide.
export function contextPages(db: Db, question: PracticeQuestion): PromptPage[] {
  const wanted = new Map<string, Set<number>>();
  for (const r of question.refs) {
    const set = wanted.get(r.materialId) ?? new Set<number>();
    for (const p of [r.page - 1, r.page, r.page + 1]) if (p > 0) set.add(p);
    wanted.set(r.materialId, set);
  }
  const out: PromptPage[] = [];
  [...wanted.entries()].forEach(([materialId, set], index) => {
    const title = getMaterial(db, materialId)?.title ?? "File";
    for (const p of listPages(db, materialId)) {
      if (set.has(p.page) && p.text) out.push({ ref: `${index + 1}:${p.page}`, materialId, page: p.page, title, text: p.text });
    }
  });
  return out;
}

export function buildAssessPrompt(question: PracticeQuestion, pages: PromptPage[], answer: string): string {
  const material = pages.length
    ? pages.map((p) => `<page ref="${p.ref}" file="${p.title.replace(/"/g, "'")}">\n${p.text}\n</page>`).join("\n\n")
    : "(No course material is attached to this question. Judge on general knowledge and label every outline point 'interpretation'.)";
  return `Course material:\n${material}\n\nQuestion (${question.kind}):\n${question.question}\n\nThe student's answer:\n<answer>\n${answer}\n</answer>`;
}

export async function assessAnswer(
  db: Db,
  provider: AIProvider | null,
  course: Course,
  question: PracticeQuestion,
  answer: string,
  now = Date.now(),
): Promise<Attempt> {
  if (!provider) throw new AiError("AI is off. Add ANTHROPIC_API_KEY to .env.local to turn it on.");
  if (!course.aiAllowed) throw new AiError(`AI is turned off for ${course.title}. Nothing was sent.`);
  const text = answer.trim();
  if (text.length < 20) throw new AiError("Write a real answer first (at least a couple of sentences).");
  if (text.length > MAX_ANSWER_CHARS) throw new AiError(`Keep the answer under ${MAX_ANSWER_CHARS} characters.`);

  const pages = contextPages(db, question);
  const { value, model } = await provider.generate({ kind: "assess", system: assessSystem(), prompt: buildAssessPrompt(question, pages, text), schema: assessmentSchema });
  // A "fact" must point at a real page; one that does not is shown as interpretation instead.
  const outline: OutlinePoint[] = value.outline.map((o) => {
    const { kept } = citedOnly([o], pages, (_item, refs) => refs);
    const refs = kept[0] ?? [];
    return { point: o.point, label: o.label === "fact" && refs.length ? "fact" : "interpretation", refs };
  });
  const assessment: Assessment = {
    accuracy: clamp(value.accuracy),
    clarity: clamp(value.clarity),
    evidence: clamp(value.evidence),
    strengths: value.strengths,
    missing: value.missing,
    outline,
    followUp: value.follow_up,
  };
  return addAttempt(db, { questionId: question.id, answer: text, assessment, model }, now);
}
