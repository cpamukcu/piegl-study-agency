// Research plan: AI breaks a question down and suggests search terms. It never names sources.
import { z } from "zod";
import { INTEGRITY_RULES, PROGRAM_CONTEXT } from "@/ai/brief";
import { AiError, type AIProvider } from "@/ai/provider";
import type { Db } from "@/db/connection";
import type { Course } from "@/db/courses";
import { setPlan, type ResearchPlan, type ResearchProject } from "@/db/research";

// Deliberately no field for papers, authors or links: sources come only from the owner.
export const researchPlanSchema = z.object({
  subquestions: z.array(z.string()).describe("3-6 smaller questions that together answer the main one"),
  search_terms: z.array(z.string()).describe("8-15 search terms or Boolean queries, in English, plus Chinese terms where useful"),
  perspectives: z.array(z.string()).describe("2-5 angles or theoretical lenses worth comparing"),
  where_to_look: z.array(z.string()).describe("Kinds of places to search (databases, report types, data sets), not specific documents"),
  steps: z.array(z.string()).describe("4-7 short steps for doing the research"),
});

export function researchSystem(): string {
  return [
    "You help a graduate student plan their own research. You do not do the research for them.",
    PROGRAM_CONTEXT,
    "",
    "Rules:",
    INTEGRITY_RULES.split("\n").filter((l) => !l.startsWith("Every item must cite")).join("\n"),
    "Never name specific papers, books, authors, articles, URLs or DOIs, and never invent findings. The student finds and checks every source themselves.",
  ].join("\n");
}

export function researchPrompt(project: ResearchProject, course: Course | null): string {
  return `${course ? `Course: ${course.title}\n` : ""}Research question:\n${project.question}`;
}

export async function generatePlan(db: Db, provider: AIProvider | null, project: ResearchProject, course: Course | null): Promise<ResearchPlan> {
  if (!provider) throw new AiError("AI is off. Add ANTHROPIC_API_KEY to .env.local to turn it on.");
  if (course && !course.aiAllowed) throw new AiError(`AI is turned off for ${course.title}. Nothing was sent.`);
  const { value, model } = await provider.generate({ kind: "research-plan", system: researchSystem(), prompt: researchPrompt(project, course), schema: researchPlanSchema });
  const plan: ResearchPlan = {
    subquestions: value.subquestions,
    searchTerms: value.search_terms,
    perspectives: value.perspectives,
    whereToLook: value.where_to_look,
    steps: value.steps,
  };
  setPlan(db, project.id, plan, model);
  return plan;
}
