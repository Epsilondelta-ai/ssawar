import { NextResponse } from "next/server";
import { getSummary } from "@/lib/session-service";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ sessionId: string }> },
) {
  const { sessionId } = await params;
  const summary = await getSummary(sessionId);

  if (!summary) {
    return NextResponse.json({ error: { code: "SUMMARY_NOT_FOUND", message: "SUMMARY_NOT_FOUND" } }, { status: 404 });
  }

  return NextResponse.json({ summary });
}
