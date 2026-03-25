import { NextRequest, NextResponse } from "next/server";
import { appendUserMessage, listMessages } from "@/lib/session-service";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ sessionId: string }> },
) {
  const { sessionId } = await params;
  const messages = await listMessages(sessionId);
  return NextResponse.json({ messages, nextCursor: null });
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ sessionId: string }> },
) {
  const { sessionId } = await params;

  try {
    const body = (await request.json()) as { content?: string };
    const result = await appendUserMessage(sessionId, body.content ?? "");
    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "UNKNOWN_ERROR";
    const status = message === "EMPTY_MESSAGE" || message === "SESSION_FINISHED" ? 400 : message === "SESSION_NOT_FOUND" ? 404 : 500;
    return NextResponse.json({ error: { code: message, message } }, { status });
  }
}
