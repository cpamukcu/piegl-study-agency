// Fake data for the public demo. Every name, course and file here is invented; none of it is real student data.
// Dates are relative to `now`, so the demo always looks current.
import { generateBrief } from "@/ai/brief";
import { assessAnswer } from "@/ai/assess";
import type { AIProvider, AiKind, AiRequest, AiResult } from "@/ai/provider";
import { generatePlan } from "@/ai/research";
import type { Db } from "@/db/connection";
import { createCourse, type Course } from "@/db/courses";
import { addMaterial } from "@/db/materials";
import { addMeetingTime, listMeetingTimes } from "@/db/meetings";
import { addNote, addSource, createProject, setSourceVerified } from "@/db/research";
import { saveReview } from "@/db/reviews";
import { createRule, materializePrepTasks } from "@/db/rules";
import { listConcepts, listQuestions, setConceptStatus } from "@/db/study";
import { createTask, setTaskStatus } from "@/db/tasks";
import { listTerms, upsertTerm } from "@/db/terms";
import { sessionsBetween } from "@/lib/sessions";
import { DAY_MS, HOUR_MS, MINUTE_MS, shanghaiParts, startOfShanghaiDay, startOfShanghaiWeek } from "@/lib/time";
import { makePdf, makePptx } from "../../tests/helpers/files";

// Answers the AI features with fixed text, so the demo shows real-looking results without calling any API.
class DemoProvider implements AIProvider {
  readonly name = "Demo";
  constructor(private readonly answers: Partial<Record<AiKind, unknown>>) {}
  modelFor(): string {
    return "claude-sonnet-5-5";
  }
  async generate<T>(request: AiRequest<T>): Promise<AiResult<T>> {
    return { value: request.schema.parse(this.answers[request.kind]), model: this.modelFor() };
  }
}

const pad = (n: number) => String(n).padStart(2, "0");

export async function seedDemo(db: Db, dataDir: string, now: number): Promise<void> {
  const today = startOfShanghaiDay(now);
  const monday = startOfShanghaiWeek(now);
  const termStart = monday - 7 * 7 * DAY_MS;
  const p = shanghaiParts(termStart);
  upsertTerm(db, { id: "demo-term", name: "Autumn–Winter (demo)", startDate: `${p.year}-${pad(p.month)}-${pad(p.day)}`, weeks: 18, periods: [] });
  const at = (dayOffset: number, hour: number, minute = 0) => today + dayOffset * DAY_MS + hour * HOUR_MS + minute * MINUTE_MS;

  const course = (title: string, code: string, instructor: string, color: string, notes: string | null = null): Course =>
    createCourse(db, { title, code, instructor, semester: "Autumn–Winter (demo)", color, notes, links: [] });
  const innovation = course("Innovation Management", "DEMO-501", "Dr. Demo Lin", "#6978e8", "Bring a laptop for the case workshop.");
  const leadership = course("Global Leadership", "DEMO-502", "Dr. Demo Okafor", "#ec6cb6");
  const finance = course("Entrepreneurial Finance", "DEMO-503", "Dr. Demo Weber", "#68bca8");
  const chinese = course("Chinese Language I", "DEMO-110", "Demo Teacher Wang", "#d8a24b");

  const meet = (c: Course, weekday: number, from: [number, number], to: [number, number], room: string) =>
    addMeetingTime(db, { courseId: c.id, termId: "demo-term", weekday, startMinute: from[0] * 60 + from[1], endMinute: to[0] * 60 + to[1], room });
  // Weekdays are placed relative to today: a class this morning, Innovation Management first thing tomorrow.
  const wd = (offset: number) => shanghaiParts(today + offset * DAY_MS).weekday;
  meet(chinese, wd(0), [8, 0], [9, 35], "Language Centre 204");
  meet(chinese, wd(2), [8, 0], [9, 35], "Language Centre 204");
  meet(innovation, wd(1), [8, 50], [11, 35], "Haining Campus, East 2-201");
  meet(innovation, wd(3), [13, 25], [15, 0], "Haining Campus, East 2-201");
  meet(leadership, wd(2), [10, 0], [11, 35], "Haining Campus, West 1-105");
  meet(finance, wd(4), [14, 15], [16, 40], "Haining Campus, East 3-310");
  createRule(db, { courseId: innovation.id, title: "Read the slides before class", leadMinutes: 12 * 60, estMinutes: 45, importance: 2 });
  createRule(db, { courseId: leadership.id, title: "Prepare for class", leadMinutes: 18 * 60, estMinutes: 30, importance: 2 });

  const task = (c: Course | null, title: string, type: "assignment" | "reading" | "presentation" | "exam" | "personal", dueAt: number | null, est: number | null, importance: 1 | 2 | 3 = 2) =>
    createTask(db, { courseId: c?.id ?? null, title, type, dueAt, estMinutes: est, importance }, { now: now - 3 * DAY_MS });
  const essay = task(innovation, "Case essay: diffusion of a new product", "assignment", at(2, 23, 59), 180, 3);
  task(leadership, "Team presentation: leading across cultures", "presentation", at(6, 10, 0), 240, 3);
  task(finance, "Problem set 3: venture valuation", "assignment", at(1, 23, 59), 90, 2);
  task(finance, "Read: term sheets explained", "reading", at(4, 14, 0), 40, 1);
  task(chinese, "Characters lesson 7", "assignment", at(0, 20, 0), 30, 2);
  task(chinese, "Mid-term oral test", "exam", at(9, 8, 0), 120, 3);
  task(leadership, "Reflection log week 8", "assignment", at(-1, 23, 59), 30, 2);
  task(null, "Apply for library database access", "personal", null, 20, 3);
  const done1 = task(innovation, "Quiz 2: open innovation", "exam", at(-2, 12, 0), 30, 2);
  setTaskStatus(db, done1.id, "done", at(-2, 11, 0));
  const done2 = task(finance, "Problem set 2", "assignment", at(-3, 23, 59), 90, 2);
  setTaskStatus(db, done2.id, "done", at(-3, 21, 0));
  materializePrepTasks(db, now);

  // Course files: small generated PDF and PPTX files with real text.
  const add = async (c: Course, fileName: string, bytes: Uint8Array) =>
    (await addMaterial(db, dataDir, { courseId: c.id, fileName, bytes, source: "zju", externalId: `demo:${fileName}` }, now - 2 * DAY_MS)).material;
  const diffusion = await add(
    innovation,
    "Week 8 - Diffusion of innovations.pdf",
    makePdf([
      ["Week 8: Diffusion of innovations", "Why do some new products spread quickly and others never take off?"],
      ["Adopter categories", "Innovators, early adopters, early majority, late majority, laggards.", "The chasm sits between early adopters and the early majority."],
      ["Five attributes that speed adoption", "Relative advantage, compatibility, complexity,", "trialability and observability."],
      ["Case: mobile payments in China", "Network effects and QR codes lowered complexity and raised observability.", "Discussion: what slowed adoption in other markets?"],
    ]),
  );
  await add(innovation, "Week 7 - Open innovation.pdf", makePdf([["Week 7: Open innovation"], ["Inbound and outbound flows of knowledge", "Licensing, partnerships, crowdsourcing."]]));
  await add(
    leadership,
    "Leading across cultures.pptx",
    makePptx([
      { lines: ["Leading across cultures", "Session 8"], notes: ["Start with the students' own examples."] },
      { lines: ["Cultural dimensions", "Power distance, individualism, uncertainty avoidance"] },
      { lines: ["High-context and low-context communication", "What is said vs. what is meant"] },
      { lines: ["Global team practices", "Clear norms, rotating meeting times, explicit decisions"] },
    ]),
  );
  await add(finance, "Valuing early-stage ventures.pdf", makePdf([["Valuing early-stage ventures"], ["The VC method", "Exit value / target return = post-money value"], ["Dilution across rounds"]]));
  await add(chinese, "第七课 生词.pptx", makePptx([{ lines: ["第七课", "生词 New words"] }, { lines: ["学习 xuéxí to study", "老师 lǎoshī teacher"] }]));

  const ai = new DemoProvider({
    brief: {
      overview:
        "This class explains how new products and ideas spread through a market. It introduces the five adopter categories, the five attributes that make adoption faster, and applies them to mobile payments in China.",
      key_points: [
        { point: "Adoption follows a bell curve of five adopter categories, from innovators to laggards.", refs: ["1:2"] },
        { point: "Many products stall in the 'chasm' between early adopters and the early majority.", refs: ["1:2"] },
        { point: "Relative advantage, compatibility, low complexity, trialability and observability speed adoption.", refs: ["1:3"] },
        { point: "Mobile payments in China spread fast because network effects and QR codes lowered complexity.", refs: ["1:4"] },
      ],
      concepts: [
        { term: "Diffusion of innovations", definition: "How a new product or idea spreads through a population over time.", refs: ["1:1"] },
        { term: "Early majority", definition: "The pragmatic third of adopters who wait for proof that a product works.", refs: ["1:2"] },
        { term: "The chasm", definition: "The gap between enthusiastic early adopters and the pragmatic early majority.", refs: ["1:2"] },
        { term: "Trialability", definition: "How easily people can try an innovation before committing to it.", refs: ["1:3"] },
        { term: "Network effects", definition: "A product becomes more valuable as more people use it.", refs: ["1:4"] },
      ],
      ask_in_class: [
        { question: "Does the chasm apply to B2B products in the same way as consumer products?", refs: ["1:2"] },
        { question: "Which of the five attributes mattered most for mobile payments outside China?", refs: ["1:3", "1:4"] },
      ],
      flashcards: [
        { front: "Name the five adopter categories.", back: "Innovators, early adopters, early majority, late majority, laggards.", refs: ["1:2"] },
        { front: "What is the chasm?", back: "The gap between early adopters and the early majority.", refs: ["1:2"] },
        { front: "Five attributes that speed adoption?", back: "Relative advantage, compatibility, complexity, trialability, observability.", refs: ["1:3"] },
        { front: "Why did QR codes help mobile payments?", back: "They lowered complexity and made use visible to others.", refs: ["1:4"] },
      ],
      practice_questions: [
        { question: "Explain why many products fail to cross the chasm.", kind: "explain", refs: ["1:2"] },
        { question: "Apply the five attributes to an electric scooter-sharing service.", kind: "apply", refs: ["1:3"] },
        { question: "Critique the claim that network effects alone explain mobile payment adoption in China.", kind: "critique", refs: ["1:4"] },
      ],
    },
    assess: {
      accuracy: 4,
      clarity: 3,
      evidence: 2,
      strengths: ["You named the gap between early adopters and the early majority correctly.", "Your answer is short and to the point."],
      missing: ["Why the early majority needs different proof (references, complete solutions).", "An example from the class case."],
      outline: [
        { point: "Early adopters buy vision; early majority buys proof", label: "fact", refs: ["1:2"] },
        { point: "Few references exist at the start, so pragmatists wait", label: "interpretation", refs: [] },
        { point: "Lower complexity and raise observability to cross", label: "fact", refs: ["1:3"] },
        { point: "Mobile payments: QR codes made use visible", label: "fact", refs: ["1:4"] },
      ],
      follow_up: "What would you change first if your product were stuck in the chasm?",
    },
    "research-plan": {
      subquestions: [
        "Which countries offer start-up visas, and on what terms?",
        "What do founders say drives their choice of country?",
        "How do outcomes of visa-based start-ups compare with others?",
      ],
      search_terms: ["start-up visa", "entrepreneur visa policy", "founder migration", "immigrant entrepreneurship", "创业签证", "人才签证"],
      perspectives: ["Institutional theory", "Talent competition between countries", "Founders' own decision-making"],
      where_to_look: ["Google Scholar and Web of Science", "ZJU library databases, including CNKI", "Government policy documents", "OECD migration reports"],
      steps: ["Define what counts as a start-up visa", "Collect the policies of 5–8 countries", "Read 10–15 peer-reviewed studies", "Compare in a table", "Write your own argument"],
    },
  });

  const nextInnovation = sessionsBetween(listMeetingTimes(db), listTerms(db), now, now + 7 * DAY_MS).find((x) => x.courseId === innovation.id);
  const brief = await generateBrief(db, ai, innovation, [diffusion.id], nextInnovation?.startsAt ?? null, now - 5 * HOUR_MS);
  const concepts = listConcepts(db, { briefId: brief.id });
  setConceptStatus(db, concepts[0].id, "understand", now - 4 * HOUR_MS);
  setConceptStatus(db, concepts[2].id, "confusing", now - 4 * HOUR_MS);
  setConceptStatus(db, concepts[3].id, "understand", now - 4 * HOUR_MS);
  const [question] = listQuestions(db, { briefId: brief.id });
  await assessAnswer(
    db,
    ai,
    innovation,
    question,
    "Products fail to cross the chasm because the early majority is more careful than early adopters. They want to see that it works before they buy.",
    now - 3 * HOUR_MS,
  );

  const project = createProject(db, { question: "How do start-up visa programmes shape where international founders build their companies?", courseId: leadership.id }, now - 6 * DAY_MS);
  await generatePlan(db, ai, project, leadership);
  const verified = addSource(db, project.id, { title: "Example study on start-up visa programmes (demo entry)", authors: "Demo, A.", year: "2024", locator: "https://example.org/demo-source", notes: "Compares policies in several countries.", relevance: 3 }, now - 5 * DAY_MS);
  setSourceVerified(db, verified.id, true, now - 4 * DAY_MS);
  addSource(db, project.id, { title: "Another demo source, not yet checked", authors: "Sample, B.", year: "2023", locator: null, notes: null, relevance: 2 }, now - 2 * DAY_MS);
  addNote(db, project.id, { body: "Visa rules differ a lot in how much proof of funding they ask for.", label: "from-source", sourceId: verified.id }, now - 4 * DAY_MS);
  addNote(db, project.id, { body: "My guess: speed of approval matters more to founders than the visa's length.", label: "mine", sourceId: null }, now - 3 * DAY_MS);

  // Last week's review planned two tasks for today, so Today's study plan shows them first.
  const todayIndex = Math.round((today - monday) / DAY_MS);
  saveReview(
    db,
    {
      weekStart: monday - 7 * DAY_MS,
      wentWell: "Finished problem set 2 early.",
      wasHard: "Reading the long case took longer than planned.",
      reflection: "Start essays two days earlier.",
      plan: [{ taskId: essay.id, title: essay.title, day: todayIndex }],
    },
    now - 3 * DAY_MS,
  );
}
