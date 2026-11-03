// Reads slide text (and speaker notes) from a .pptx file, one entry per slide, in presentation order.
import { strFromU8, unzipSync, type Unzipped } from "fflate";

const decodeEntities = (s: string) =>
  s
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, n: string) => String.fromCodePoint(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, n: string) => String.fromCodePoint(parseInt(n, 16)))
    .replace(/&amp;/g, "&");

// Each <a:p> paragraph becomes one line; <a:t> runs inside it are joined.
export function drawingText(xml: string): string {
  const lines: string[] = [];
  for (const para of xml.match(/<a:p[\s>][\s\S]*?<\/a:p>/g) ?? []) {
    const runs = [...para.matchAll(/<a:t(?:\s[^>]*)?>([\s\S]*?)<\/a:t>/g)].map((m) => decodeEntities(m[1]));
    const line = runs.join("").trim();
    if (line) lines.push(line);
  }
  return lines.join("\n");
}

function read(files: Unzipped, name: string): string | null {
  const data = files[name];
  return data ? strFromU8(data) : null;
}

const resolveTarget = (target: string) => (target.startsWith("/") ? target.slice(1) : `ppt/${target.replace(/^\.\.\//, "")}`);

// Slide order comes from presentation.xml (sldIdLst → relationship → file). Falls back to file numbers.
function slideFiles(files: Unzipped): string[] {
  const presentation = read(files, "ppt/presentation.xml");
  const rels = read(files, "ppt/_rels/presentation.xml.rels");
  if (presentation && rels) {
    const targets = new Map<string, string>();
    for (const m of rels.matchAll(/<Relationship\b[^>]*>/g)) {
      const id = /\bId="([^"]+)"/.exec(m[0])?.[1];
      const target = /\bTarget="([^"]+)"/.exec(m[0])?.[1];
      if (id && target) targets.set(id, resolveTarget(target));
    }
    const ordered = [...presentation.matchAll(/<p:sldId\b[^>]*\br:id="([^"]+)"/g)]
      .map((m) => targets.get(m[1]))
      .filter((f): f is string => Boolean(f && files[f]));
    if (ordered.length) return ordered;
  }
  const num = (f: string) => Number(/slide(\d+)\.xml$/.exec(f)?.[1] ?? 0);
  return Object.keys(files)
    .filter((f) => /^ppt\/slides\/slide\d+\.xml$/.test(f))
    .sort((a, b) => num(a) - num(b));
}

function notesFor(files: Unzipped, slideFile: string): string {
  const rels = read(files, slideFile.replace(/slides\/(slide\d+\.xml)$/, "slides/_rels/$1.rels"));
  const target = rels && /Target="([^"]*notesSlide\d+\.xml)"/.exec(rels)?.[1];
  if (!target) return "";
  const xml = read(files, `ppt/${target.replace(/^\.\.\//, "")}`);
  if (!xml) return "";
  // Drop the slide-number placeholder that every notes page carries.
  const withoutNumber = xml.replace(/<p:sp>(?:(?!<\/p:sp>)[\s\S])*?type="sldNum"[\s\S]*?<\/p:sp>/g, "");
  return drawingText(withoutNumber);
}

export function extractPptx(bytes: Uint8Array): string[] {
  const files = unzipSync(bytes, { filter: (f) => f.name.startsWith("ppt/") && (f.name.endsWith(".xml") || f.name.endsWith(".rels")) });
  const slides = slideFiles(files);
  if (slides.length === 0) throw new Error("This file has no slides. Is it really a .pptx?");
  return slides.map((file) => {
    const body = drawingText(read(files, file) ?? "");
    const notes = notesFor(files, file);
    return notes ? `${body}\n\nSpeaker notes:\n${notes}`.trim() : body;
  });
}
