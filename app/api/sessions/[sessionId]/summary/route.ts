import { NextRequest, NextResponse } from "next/server";
import { getSession, getSummary } from "@/lib/session-service";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ sessionId: string }> },
) {
  const { sessionId } = await params;
  const session = await getSession(sessionId);
  if (!session) {
    return NextResponse.json({ error: { code: "SESSION_NOT_FOUND", message: "SESSION_NOT_FOUND" } }, { status: 404 });
  }
  const summary = await getSummary(sessionId);

  if (!summary) {
    return NextResponse.json({ error: { code: "SUMMARY_NOT_FOUND", message: "SUMMARY_NOT_FOUND" } }, { status: 404 });
  }

  return NextResponse.json({ summary });
}
