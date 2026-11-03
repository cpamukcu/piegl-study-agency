import { describe, expect, it } from "vitest";
import { researchPlanSchema, generatePlan, researchSystem } from "@/ai/research";
import { createCourse, getCourse, setCourseAi, type Course } from "@/db/courses";
import { addNote, addSource, createProject, deleteSource, getProject, listNotes, listSources, setSourceVerified } from "@/db/research";
import { FakeProvider } from "./helpers/fake-ai";
import { memoryDb } from "./helpers/db";

const plan = {
  subquestions: ["What drives founder visas?"],
  search_terms: ["startup visa", "创业签证"],
  perspectives: ["Institutional theory"],
  where_to_look: ["Google Scholar", "ZJU library databases"],
  steps: ["Define terms"],
};

describe("research workspace", () => {
  it("gives the AI no way to name or create sources", async () => {
    expect(Object.keys(researchPlanSchema.shape).sort()).toEqual(["perspectives", "search_terms", "steps", "subquestions", "where_to_look"]);
    expect(researchSystem()).toContain("Never name specific papers");
    const db = memoryDb();
    const project = createProject(db, { question: "How do start-up visas shape where founders go?", courseId: null });
    const fake = new FakeProvider({ "research-plan": plan });
    await generatePlan(db, fake, project, null);
    expect(fake.requests[0].prompt).toBe("Research question:\nHow do start-up visas shape where founders go?");
    expect(getProject(db, project.id)).toMatchObject({ planModel: "fake-research-plan", plan: { searchTerms: ["startup visa", "创业签证"] } });
    expect(listSources(db, project.id)).toEqual([]);
  });

  it("sends nothing for a course with AI off", async () => {
    const db = memoryDb();
    const course = createCourse(db, { title: "Leadership" });
    setCourseAi(db, course.id, false);
    const project = createProject(db, { question: "A question about leadership styles", courseId: course.id });
    const fake = new FakeProvider({ "research-plan": plan });
    await expect(generatePlan(db, fake, project, getCourse(db, course.id) as Course)).rejects.toThrow("Nothing was sent");
    expect(fake.requests).toEqual([]);
  });

  it("starts sources unverified; only an explicit owner action verifies them", () => {
    const db = memoryDb();
    const project = createProject(db, { question: "Some question here", courseId: null });
    const source = addSource(db, project.id, { title: "A paper", authors: "Doe", year: "2024", locator: "10.1000/xyz", notes: null, relevance: 3 }, 1000);
    expect(source.verifiedAt).toBeNull();
    setSourceVerified(db, source.id, true, 2000);
    expect(listSources(db, project.id)[0].verifiedAt).toBe(2000);
    setSourceVerified(db, source.id, false);
    expect(listSources(db, project.id)[0].verifiedAt).toBeNull();
  });

  it("labels every note, ties source notes to their source, and removes them with it", () => {
    const db = memoryDb();
    const project = createProject(db, { question: "Some question here", courseId: null });
    const source = addSource(db, project.id, { title: "A paper", authors: null, year: null, locator: null, notes: null, relevance: 2 });
    expect(() => addNote(db, project.id, { body: "quote", label: "from-source", sourceId: null })).toThrow();
    addNote(db, project.id, { body: "quote", label: "from-source", sourceId: source.id }, 1);
    addNote(db, project.id, { body: "my idea", label: "mine", sourceId: source.id }, 2);
    expect(listNotes(db, project.id).map((n) => [n.label, n.sourceId])).toEqual([
      ["mine", null],
      ["from-source", source.id],
    ]);
    deleteSource(db, source.id);
    expect(listNotes(db, project.id).map((n) => n.label)).toEqual(["mine"]);
  });
});
