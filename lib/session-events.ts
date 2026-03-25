type SessionEventPayload =
  | {
      type: "session.updated";
      session: Record<string, unknown>;
    }
  | {
      type: "messages.created";
      messages: Record<string, unknown>[];
    }
  | {
      type: "summary.updated";
      summary: Record<string, unknown>;
    };

type Listener = (payload: SessionEventPayload) => void;

const listeners = new Map<string, Set<Listener>>();

export function publishSessionEvent(sessionId: string, payload: SessionEventPayload) {
  const sessionListeners = listeners.get(sessionId);
  if (!sessionListeners) return;

  for (const listener of sessionListeners) {
    listener(payload);
  }
}

export function subscribeSessionEvent(sessionId: string, listener: Listener) {
  const existing = listeners.get(sessionId) ?? new Set<Listener>();
  existing.add(listener);
  listeners.set(sessionId, existing);

  return () => {
    const current = listeners.get(sessionId);
    if (!current) return;
    current.delete(listener);
    if (current.size === 0) {
      listeners.delete(sessionId);
    }
  };
}
