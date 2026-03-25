import { NextRequest, NextResponse } from "next/server";
import { renameSession } from "@/lib/session-service";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ sessionId: string }> },
) {
  const { sessionId } = await params;

  try {
    const body = (await request.json()) as { title?: string };
    const session = await renameSession(sessionId, body.title ?? "");
    return NextResponse.json({ session });
  } catch (error) {
    const message = error instanceof Error ? error.message : "UNKNOWN_ERROR";
    const status = message === "INVALID_TITLE" ? 400 : message === "SESSION_NOT_FOUND" ? 404 : 500;
    return NextResponse.json({ error: { code: message, message } }, { status });
  }
}
