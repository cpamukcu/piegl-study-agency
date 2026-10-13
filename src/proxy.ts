import { NextResponse, type NextRequest } from "next/server";
import { isLocalHost } from "@/lib/host";

// No matcher: every request, including static files, must come from this machine.
export function proxy(request: NextRequest) {
  if (!isLocalHost(request.headers.get("host"))) {
    return new NextResponse("This app only answers on 127.0.0.1.", { status: 403 });
  }
  return NextResponse.next();
}
