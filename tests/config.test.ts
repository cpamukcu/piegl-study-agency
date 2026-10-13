import { describe, expect, it } from "vitest";
import nextConfig from "../next.config";

describe("next.config", () => {
  it("sends the home page to Today without rendering a page", async () => {
    expect(await nextConfig.redirects?.()).toEqual([{ source: "/", destination: "/today", permanent: false }]);
  });
});
