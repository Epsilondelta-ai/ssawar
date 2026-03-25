import { NextResponse } from "next/server";
import { getSession } from "@/lib/session-service";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ sessionId: string }> },
) {
  const { sessionId } = await params;
  const session = await getSession(sessionId);

  if (!session) {
    return NextResponse.json({ error: { code: "SESSION_NOT_FOUND", message: "SESSION_NOT_FOUND" } }, { status: 404 });
  }

  return NextResponse.json({ session });
}
