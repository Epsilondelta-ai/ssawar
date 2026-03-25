import { NextRequest, NextResponse } from "next/server";
import { endSession, getSession } from "@/lib/session-service";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ sessionId: string }> },
) {
  const { sessionId } = await params;

  try {
    const currentSession = await getSession(sessionId);
    if (!currentSession) {
      return NextResponse.json({ error: { code: "SESSION_NOT_FOUND", message: "SESSION_NOT_FOUND" } }, { status: 404 });
    }
    const body = (await request.json().catch(() => ({}))) as { reason?: string };
    const result = await endSession(sessionId, body.reason ?? "user_requested");
    return NextResponse.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "UNKNOWN_ERROR";
    const status = message === "SESSION_NOT_FOUND" ? 404 : 500;
    return NextResponse.json({ error: { code: message, message } }, { status });
  }
}
