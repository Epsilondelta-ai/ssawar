import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { VIEWER_COOKIE, createViewerId } from "@/lib/auth";

export function middleware(request: NextRequest) {
  if (request.cookies.get(VIEWER_COOKIE)) {
    return NextResponse.next();
  }

  const response = NextResponse.next();
  response.cookies.set(VIEWER_COOKIE, createViewerId(), {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
  });
  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
