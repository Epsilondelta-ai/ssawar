import { NextRequest, NextResponse } from "next/server";
import { VIEWER_COOKIE, createViewerId } from "@/lib/auth";

export function readViewerId(request: NextRequest) {
  return request.headers.get("x-ssawar-viewer") || request.nextUrl.searchParams.get("viewerId") || request.cookies.get(VIEWER_COOKIE)?.value || null;
}

export function ensureViewerId(request: NextRequest) {
  return readViewerId(request) ?? createViewerId();
}

export function attachViewerCookie(response: NextResponse, viewerId: string) {
  response.cookies.set(VIEWER_COOKIE, viewerId, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
  });

  return response;
}
