// Serves an original course file from DATA_DIR. The proxy already refuses any host but this machine.
import { readFile } from "node:fs/promises";
import type { NextRequest } from "next/server";
import { getDb } from "@/db/connection";
import { getMaterial, materialFile } from "@/db/materials";
import { getDataDir } from "@/lib/data-dir";

const TYPES: Record<string, string> = {
  pdf: "application/pdf",
  pptx: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  text: "text/plain; charset=utf-8",
};

export async function GET(request: NextRequest, ctx: RouteContext<"/materials/[id]/file">) {
  const { id } = await ctx.params;
  const material = getMaterial(getDb(), id);
  if (!material) return new Response("Not found", { status: 404 });
  let bytes: Buffer;
  try {
    bytes = await readFile(materialFile(getDataDir(), material));
  } catch {
    return new Response("The file is missing from your data folder.", { status: 404 });
  }
  const download = request.nextUrl.searchParams.has("download") || material.kind === "pptx" || material.kind === "other";
  return new Response(new Uint8Array(bytes), {
    headers: {
      "Content-Type": TYPES[material.kind] ?? "application/octet-stream",
      "Content-Disposition": `${download ? "attachment" : "inline"}; filename*=UTF-8''${encodeURIComponent(material.fileName)}`,
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
