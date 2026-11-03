// Server-only: turns a course file into text, one entry per page or slide. No OCR: scanned pages come back empty.
import path from "node:path";
import { extractPptx } from "@/extract/pptx";

export type MaterialKind = "pdf" | "pptx" | "text" | "other";

export type Extraction =
  | { status: "ok"; pages: string[] }
  | { status: "no-text"; pageCount: number }
  | { status: "failed"; error: string }
  | { status: "unsupported" };

export function kindOf(fileName: string): MaterialKind {
  const ext = path.extname(fileName).toLowerCase();
  if (ext === ".pdf") return "pdf";
  if (ext === ".pptx") return "pptx";
  if (ext === ".txt" || ext === ".md") return "text";
  return "other";
}

// Collapses the runs of spaces PDF text often has, keeps line breaks.
export function tidy(text: string): string {
  return text
    .replace(/\r\n?/g, "\n")
    .replace(/[ \t\f\v ]+/g, " ")
    .replace(/ *\n */g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

async function extractPdf(bytes: Uint8Array): Promise<string[]> {
  const { extractText } = await import("unpdf");
  // unpdf may detach the buffer it is given, so hand it a copy.
  const { text } = await extractText(new Uint8Array(bytes), { mergePages: false });
  return text;
}

const TEXT_PAGE_CHARS = 4000;

function splitText(text: string): string[] {
  const pages: string[] = [];
  let current = "";
  for (const para of text.split(/\n{2,}/)) {
    if (current && current.length + para.length > TEXT_PAGE_CHARS) {
      pages.push(current);
      current = "";
    }
    current = current ? `${current}\n\n${para}` : para;
  }
  if (current) pages.push(current);
  return pages;
}

export async function extract(kind: MaterialKind, bytes: Uint8Array): Promise<Extraction> {
  if (kind === "other") return { status: "unsupported" };
  let raw: string[];
  try {
    if (kind === "pdf") raw = await extractPdf(bytes);
    else if (kind === "pptx") raw = extractPptx(bytes);
    else raw = splitText(new TextDecoder().decode(bytes));
  } catch (error) {
    return { status: "failed", error: error instanceof Error ? error.message : String(error) };
  }
  const pages = raw.map(tidy);
  if (pages.length === 0 || pages.every((p) => p === "")) return { status: "no-text", pageCount: pages.length };
  return { status: "ok", pages };
}
