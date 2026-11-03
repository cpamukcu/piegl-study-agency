import { describe, expect, it } from "vitest";
import { tronclassSnapshotSchema } from "@/import/schemas";
import { NeedsLoginError } from "@/sync/errors";
import { describeDownloads, downloadFiles, remoteFiles, type RemoteFile } from "@/sync/materials";
import { downloadsEnabled } from "@/sync/run";

const NOW = Date.parse("2026-10-26T04:00:00Z");

const upload = (id: number, name: string, extra: Record<string, unknown> = {}) => ({ id, reference_id: id + 1000, name, size: 2048, type: "document", ...extra });

const snapshot = tronclassSnapshotSchema.parse({
  source: "test",
  fetched_at: "2026-10-26T04:00:00Z",
  todos: [],
  courses: [
    {
      id: 1,
      name: "Live course",
      code: null,
      credit: null,
      department: null,
      semester: null,
      academic_year: null,
      start_date: null,
      end_date: null,
      instructors: [],
      activities: [
        {
          id: 10,
          type: "material",
          title: "Week 1",
          start_time: null,
          end_time: null,
          is_closed: false,
          published: true,
          module_id: null,
          uploads: [upload(100, "Week 1.pdf"), upload(101, "Week 1.pptx"), upload(102, "video.mp4"), upload(103, "old.pdf", { reference_id: null })],
        },
        { id: 11, type: "material", title: "Draft", start_time: null, end_time: null, is_closed: false, published: false, module_id: null, uploads: [upload(104, "hidden.pdf")] },
        { id: 12, type: "forum", title: "Talk", start_time: null, end_time: null, is_closed: false, published: true, module_id: null, uploads: [upload(105, "post.pdf")] },
        { id: 13, type: "homework", title: "Essay", start_time: null, end_time: null, is_closed: false, published: true, module_id: null, uploads: [upload(106, "brief.pdf", { size: 60 * 1024 * 1024 }), upload(100, "Week 1.pdf")] },
      ],
      exams: [],
    },
    {
      id: 2,
      name: "Ended course",
      code: null,
      credit: null,
      department: null,
      semester: null,
      academic_year: null,
      start_date: null,
      end_date: "2025-06-01",
      instructors: [],
      activities: [{ id: 20, type: "material", title: "Old", start_time: null, end_time: null, is_closed: true, published: true, module_id: null, uploads: [upload(200, "old.pdf")] }],
      exams: [],
    },
  ],
});

describe("which ZJU files to download", () => {
  it("keeps readable, published, reasonably sized files from current courses, once each", () => {
    const files = remoteFiles(snapshot, NOW);
    expect(files.map((f) => f.name)).toEqual(["Week 1.pdf", "Week 1.pptx"]);
    expect(files[0]).toEqual({ externalId: "tc:upload:100", courseExternalId: "tc:course:1", referenceId: 1100, name: "Week 1.pdf", size: 2048, activity: "Week 1" });
  });

  it("reads old snapshots without reference ids", () => {
    const old = tronclassSnapshotSchema.parse({
      ...snapshot,
      courses: [{ ...snapshot.courses[0], activities: [{ ...snapshot.courses[0].activities[0], uploads: [{ id: 1, name: "a.pdf", size: 1, type: null }] }] }],
    });
    expect(old.courses[0].activities[0].uploads[0].reference_id).toBeNull();
    expect(remoteFiles(old, NOW)).toEqual([]);
  });

  it("can be turned off", () => {
    expect(downloadsEnabled(undefined)).toBe(true);
    expect(downloadsEnabled("0")).toBe(false);
    expect(downloadsEnabled("Off")).toBe(false);
  });
});

describe("downloading", () => {
  const files: RemoteFile[] = remoteFiles(snapshot, NOW);

  it("asks for a link, fetches it, saves it, and respects the limit", async () => {
    const asked: string[] = [];
    const saved: string[] = [];
    const report = await downloadFiles(
      files,
      async (p) => {
        asked.push(p);
        return { url: `https://files.example/${p.split("/")[5]}` };
      },
      async (url) => new TextEncoder().encode(url),
      async (file, bytes) => {
        saved.push(`${file.name}=${new TextDecoder().decode(bytes)}`);
      },
      1,
    );
    expect(asked).toEqual(["/api/uploads/reference/document/1100/url?preview=false"]);
    expect(saved).toEqual(["Week 1.pdf=https://files.example/1100"]);
    expect(report).toEqual({ downloaded: 1, failed: [], left: 1 });
    expect(describeDownloads(report)).toBe("1 course file downloaded, 1 more next time.");
  });

  it("records one bad file and carries on", async () => {
    const report = await downloadFiles(
      files,
      async (p) => (p.includes("1100") ? {} : { url: "https://files.example/x" }),
      async () => new Uint8Array([1]),
      async () => {},
      10,
    );
    expect(report.downloaded).toBe(1);
    expect(report.failed).toEqual(["Week 1.pdf: no download link"]);
  });

  it("stops at once when ZJU wants a new login", async () => {
    await expect(
      downloadFiles(
        files,
        async () => {
          throw new NeedsLoginError("login");
        },
        async () => new Uint8Array(),
        async () => {},
        10,
      ),
    ).rejects.toBeInstanceOf(NeedsLoginError);
  });
});
