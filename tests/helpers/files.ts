// Builds small real PDF and PPTX files in memory. The repo never holds course files (.gitignore blocks them).
import { strToU8, zipSync } from "fflate";

const escapePdf = (s: string) => s.replace(/\\/g, "\\\\").replace(/\(/g, "\\(").replace(/\)/g, "\\)");

export function makePdf(pages: string[][]): Uint8Array {
  const objects: string[] = [];
  const pageIds = pages.map((_, i) => 4 + i * 2);
  objects[1] = "<< /Type /Catalog /Pages 2 0 R >>";
  objects[2] = `<< /Type /Pages /Kids [${pageIds.map((id) => `${id} 0 R`).join(" ")}] /Count ${pages.length} >>`;
  objects[3] = "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>";
  pages.forEach((lines, i) => {
    const content = ["BT", "/F1 14 Tf", "72 720 Td", "18 TL", ...lines.map((l) => `(${escapePdf(l)}) Tj T*`), "ET"].join("\n");
    objects[pageIds[i]] =
      `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 3 0 R >> >> /Contents ${pageIds[i] + 1} 0 R >>`;
    objects[pageIds[i] + 1] = `<< /Length ${content.length} >>\nstream\n${content}\nendstream`;
  });

  let out = "%PDF-1.4\n";
  const offsets: number[] = [];
  for (let id = 1; id < objects.length; id++) {
    offsets[id] = out.length;
    out += `${id} 0 obj\n${objects[id]}\nendobj\n`;
  }
  const xref = out.length;
  out += `xref\n0 ${objects.length}\n0000000000 65535 f \n`;
  for (let id = 1; id < objects.length; id++) out += `${String(offsets[id]).padStart(10, "0")} 00000 n \n`;
  out += `trailer\n<< /Size ${objects.length} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  return strToU8(out, true);
}

const slideXml = (lines: string[]) =>
  `<?xml version="1.0" encoding="UTF-8"?><p:sld xmlns:a="a" xmlns:p="p"><p:cSld><p:spTree><p:sp><p:txBody>${lines
    .map((l) => `<a:p><a:r><a:t>${l}</a:t></a:r></a:p>`)
    .join("")}</p:txBody></p:sp></p:spTree></p:cSld></p:sld>`;

// `order` lists slide file numbers in presentation order, so tests can check that order wins over file names.
export function makePptx(slides: { lines: string[]; notes?: string[] }[], order?: number[]): Uint8Array {
  const files: Record<string, Uint8Array> = {};
  const numbers = order ?? slides.map((_, i) => i + 1);
  numbers.forEach((n, i) => {
    const slide = slides[i];
    files[`ppt/slides/slide${n}.xml`] = strToU8(slideXml(slide.lines));
    if (slide.notes) {
      files[`ppt/slides/_rels/slide${n}.xml.rels`] = strToU8(
        `<Relationships><Relationship Id="rId2" Type="notesSlide" Target="../notesSlides/notesSlide${n}.xml"/></Relationships>`,
      );
      files[`ppt/notesSlides/notesSlide${n}.xml`] = strToU8(
        `<p:notes xmlns:a="a" xmlns:p="p"><p:cSld><p:spTree><p:sp><p:nvSpPr><p:nvPr><p:ph type="sldNum"/></p:nvPr></p:nvSpPr><p:txBody><a:p><a:r><a:t>${n}</a:t></a:r></a:p></p:txBody></p:sp>${slideXml(slide.notes).replace(/^.*<p:spTree>|<\/p:spTree>.*$/g, "")}</p:spTree></p:cSld></p:notes>`,
      );
    }
  });
  files["ppt/presentation.xml"] = strToU8(
    `<p:presentation xmlns:p="p" xmlns:r="r"><p:sldIdLst>${numbers.map((n, i) => `<p:sldId id="${256 + i}" r:id="rId${n + 10}"/>`).join("")}</p:sldIdLst></p:presentation>`,
  );
  files["ppt/_rels/presentation.xml.rels"] = strToU8(
    `<Relationships>${numbers.map((n) => `<Relationship Id="rId${n + 10}" Type="slide" Target="slides/slide${n}.xml"/>`).join("")}</Relationships>`,
  );
  files["[Content_Types].xml"] = strToU8("<Types/>");
  return zipSync(files);
}
