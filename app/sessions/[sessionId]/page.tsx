import { notFound } from "next/navigation";
import { SessionRoom } from "@/components/session-room";
import { getSession, getSummary, listMessages } from "@/lib/session-service";

export default async function SessionPage({
  params,
}: {
  params: Promise<{ sessionId: string }>;
}) {
  const { sessionId } = await params;
  const [session, messages, summary] = await Promise.all([
    getSession(sessionId),
    listMessages(sessionId),
    getSummary(sessionId),
  ]);

  if (!session) {
    notFound();
  }

  return (
    <SessionRoom
      initialMessages={messages.map((message) => ({
        id: message.id,
        role: message.role,
        speakerModel: message.speakerModel,
        speakerLabel: message.speakerLabel,
        content: message.content,
        turnIndex: message.turnIndex,
      }))}
      initialSession={{
        id: session.id,
        title: session.title,
        titleState: session.titleState,
        lifecycleState: session.lifecycleState,
        orchestratorModel: session.orchestratorModel,
        participants: session.participants.map((participant) => ({
          id: participant.id,
          modelName: participant.modelName,
          displayName: participant.displayName,
        })),
      }}
      initialSummary={
        summary
          ? {
              headline: summary.headline,
              bullets: summary.bullets as string[],
              highlights: summary.highlights as Array<{
                messageId: string;
                speakerModel: string | null;
                content: string;
              }>,
            }
          : null
      }
    />
  );
}
