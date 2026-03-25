import { NextRequest, NextResponse } from "next/server";
import { attachViewerCookie, ensureViewerId, readViewerId } from "@/lib/api-auth";
import { createSession, listSessionsForUser } from "@/lib/session-service";

export async function GET(request: NextRequest) {
  const viewerId = readViewerId(request);
  const sessions = await listSessionsForUser(viewerId);
  return NextResponse.json({ sessions });
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as Record<string, unknown>;
    const viewerId = ensureViewerId(request);
    const session = await createSession({
      orchestratorModel: typeof body.orchestratorModel === "string" ? body.orchestratorModel : undefined,
      participantModels: Array.isArray(body.participantModels)
        ? body.participantModels.filter((value): value is string => typeof value === "string")
        : undefined,
      visibility: body.visibility === "link" || body.visibility === "public" ? body.visibility : "private",
      maxTurns: typeof body.maxTurns === "number" ? body.maxTurns : undefined,
      autoExtend: typeof body.autoExtend === "boolean" ? body.autoExtend : undefined,
      stopPolicy: typeof body.stopPolicy === "string" ? body.stopPolicy : undefined,
      userId: viewerId,
    });

    const response = NextResponse.json({ session, viewerId }, { status: 201 });
    return attachViewerCookie(response, viewerId);
  } catch (error) {
    const message = error instanceof Error ? error.message : "UNKNOWN_ERROR";
    const status = message === "INVALID_PARTICIPANT_COUNT" || message === "INVALID_ORCHESTRATOR_MODEL" ? 400 : 500;
    return NextResponse.json({ error: { code: message, message } }, { status });
  }
}
