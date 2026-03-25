import { subscribeSessionEvent } from "@/lib/session-events";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ sessionId: string }> },
) {
  const { sessionId } = await params;

  const stream = new ReadableStream({
    start(controller) {
      const encoder = new TextEncoder();

      const send = (payload: unknown) => {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(payload)}\n\n`));
      };

      send({ type: "connected", sessionId });

      const unsubscribe = subscribeSessionEvent(sessionId, (payload) => {
        send(payload);
      });

      const heartbeat = setInterval(() => {
        controller.enqueue(encoder.encode(": ping\n\n"));
      }, 15000);

      return () => {
        clearInterval(heartbeat);
        unsubscribe();
      };
    },
    cancel() {
      // noop: handled by ReadableStream cleanup above in runtime
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}
