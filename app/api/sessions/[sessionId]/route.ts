import { NextRequest, NextResponse } from "next/server";
import { canReadSession } from "@/lib/auth";
import { readViewerId } from "@/lib/api-auth";
import { getSession } from "@/lib/session-service";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ sessionId: string }> },
) {
  const { sessionId } = await params;
  const session = await getSession(sessionId);

  if (!session) {
    return NextResponse.json({ error: { code: "SESSION_NOT_FOUND", message: "SESSION_NOT_FOUND" } }, { status: 404 });
  }

  if (!canReadSession(session, readViewerId(request))) {
    return NextResponse.json({ error: { code: "FORBIDDEN", message: "FORBIDDEN" } }, { status: 403 });
  }

  return NextResponse.json({ session });
}
