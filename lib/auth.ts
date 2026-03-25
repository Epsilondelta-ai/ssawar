import { cookies } from "next/headers";

export const VIEWER_COOKIE = "ssawar_viewer";

export function createViewerId() {
  return crypto.randomUUID();
}

export async function getViewerIdFromServer() {
  const store = await cookies();
  return store.get(VIEWER_COOKIE)?.value ?? null;
}

export function canReadSession(session: { visibility: string; userId: string | null }, viewerId: string | null) {
  if (session.visibility === "public" || session.visibility === "link") {
    return true;
  }

  if (!viewerId) {
    return process.env.NODE_ENV !== "production";
  }

  return session.userId === viewerId;
}

export function canWriteSession(session: { userId: string | null }, viewerId: string | null) {
  if (!viewerId) {
    return process.env.NODE_ENV !== "production";
  }

  return session.userId === viewerId;
}
