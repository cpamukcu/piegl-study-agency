import { describe, expect, it } from "vitest";
import { extract, kindOf, tidy } from "@/extract";
import { drawingText, extractPptx } from "@/extract/pptx";
import { makePdf, makePptx } from "./helpers/files";

describe("kindOf", () => {
  it("knows PDF, PPTX and text files, in any letter case", () => {
    expect(kindOf("Week 3.PDF")).toBe("pdf");
    expect(kindOf("deck.pptx")).toBe("pptx");
    expect(kindOf("notes.md")).toBe("text");
    expect(kindOf("old.ppt")).toBe("other");
  });
});

describe("PDF extraction", () => {
  it("returns one entry per page with page text", async () => {
    const pdf = makePdf([["Innovation and entrepreneurship", "Lecture 1"], ["Global leadership (part 2)"]]);
    const result = await extract("pdf", pdf);
    expect(result.status).toBe("ok");
    if (result.status !== "ok") return;
    expect(result.pages).toHaveLength(2);
    expect(result.pages[0]).toContain("Innovation and entrepreneurship");
    expect(result.pages[1]).toContain("Global leadership (part 2)");
  });

  it("reports a broken file instead of throwing", async () => {
    const result = await extract("pdf", new TextEncoder().encode("not a pdf"));
    expect(result.status).toBe("failed");
  });

  it("reports pages without text (scanned slides)", async () => {
    const result = await extract("pdf", makePdf([[], []]));
    expect(result).toEqual({ status: "no-text", pageCount: 2 });
  });
});

describe("PPTX extraction", () => {
  it("follows presentation order, not file names, and adds speaker notes", () => {
    const pptx = makePptx(
      [{ lines: ["First slide", "Point A &amp; B"] }, { lines: ["Second slide"], notes: ["Mention the case study"] }],
      [2, 1],
    );
    const slides = extractPptx(pptx);
    expect(slides[0]).toBe("First slide\nPoint A & B");
    expect(slides[1]).toBe("Second slide\n\nSpeaker notes:\nMention the case study");
  });

  it("keeps Chinese text", () => {
    expect(drawingText("<a:p><a:r><a:t>创新</a:t></a:r><a:r><a:t>创业</a:t></a:r></a:p>")).toBe("创新创业");
  });

  it("fails clearly on a zip without slides", async () => {
    const result = await extract("pptx", makePptx([]));
    expect(result.status).toBe("failed");
  });
});

describe("text files", () => {
  it("split long text into pages at paragraph breaks", async () => {
    const para = "word ".repeat(300).trim(); // 1499 characters: two fit on a 4000-character page, three do not
    const result = await extract("text", new TextEncoder().encode([para, para, para].join("\n\n")));
    expect(result.status === "ok" && result.pages.length).toBe(2);
  });

  it("tidy collapses spaces but keeps line breaks", () => {
    expect(tidy("a   b \n\n\n\n c\r\nd")).toBe("a b\n\nc\nd");
  });
});
