import { describe, expect, it } from "vitest";
import { isLocalHost } from "@/lib/host";

describe("isLocalHost", () => {
  it.each(["127.0.0.1:3100", "localhost:3100", "LocalHost:3100", "[::1]:3100", "127.0.0.1", "localhost"])(
    "allows %s",
    (host) => {
      expect(isLocalHost(host)).toBe(true);
    },
  );

  it.each([
    "evil.example:3100",
    "127.0.0.1.evil.example:3100",
    "localhost.evil.example",
    "192.168.1.20:3100",
    "0.0.0.0:3100",
    "",
    null,
  ])("refuses %s", (host) => {
    expect(isLocalHost(host)).toBe(false);
  });
});
