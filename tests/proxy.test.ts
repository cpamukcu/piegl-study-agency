import { NextRequest } from "next/server";
import { describe, expect, it } from "vitest";
import { proxy } from "@/proxy";

function requestWithHost(host: string): NextRequest {
  return new NextRequest("http://127.0.0.1:3100/settings", { headers: { host } });
}

describe("proxy (DNS rebinding guard)", () => {
  it("lets local requests through", () => {
    const response = proxy(requestWithHost("127.0.0.1:3100"));
    expect(response.status).toBe(200);
    expect(response.headers.get("x-middleware-next")).toBe("1");
  });

  it("refuses a request whose Host is another site pointed at this machine", async () => {
    const response = proxy(requestWithHost("evil.example:3100"));
    expect(response.status).toBe(403);
    expect(await response.text()).not.toContain("PIEGL-data");
  });
});
