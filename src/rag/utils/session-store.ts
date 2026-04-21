export type ChatHistoryItem = {
  role: 'user' | 'assistant';
  content: string;
};

type SessionData = {
  history: ChatHistoryItem[];
  updatedAt: number;
};

const sessionStore = new Map<string, SessionData>();
const MAX_HISTORY_LENGTH = 10;
const SESSION_TTL = 30 * 60 * 1000; // 30 分钟

function isExpired(session: SessionData) {
  return Date.now() - session.updatedAt > SESSION_TTL;
}

export function createSessionId() {
  return `session_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

export function getSessionHistory(sessionId: string): ChatHistoryItem[] {
  const session = sessionStore.get(sessionId);

  if (!session) {
    return [];
  }

  if (isExpired(session)) {
    sessionStore.delete(sessionId);
    return [];
  }

  return session.history;
}

export function appendSessionMessage(
  sessionId: string,
  message: ChatHistoryItem,
) {
  const session = sessionStore.get(sessionId);
  const history = session?.history ?? [];

  history.push(message);

  const trimmedHistory = history.slice(-MAX_HISTORY_LENGTH);

  sessionStore.set(sessionId, {
    history: trimmedHistory,
    updatedAt: Date.now(),
  });
}

export function setSessionHistory(
  sessionId: string,
  history: ChatHistoryItem[],
) {
  sessionStore.set(sessionId, {
    history: history.slice(-MAX_HISTORY_LENGTH),
    updatedAt: Date.now(),
  });
}

export function hasSession(sessionId: string) {
  const session = sessionStore.get(sessionId);

  if (!session) {
    return false;
  }

  if (isExpired(session)) {
    sessionStore.delete(sessionId);
    return false;
  }

  return true;
}

export function deleteSession(sessionId: string) {
  return sessionStore.delete(sessionId);
}

export function getAllSessions() {
  const result: {
    sessionId: string;
    messageCount: number;
    updatedAt: number;
  }[] = [];

  for (const [sessionId, session] of sessionStore.entries()) {
    if (isExpired(session)) {
      sessionStore.delete(sessionId);
      continue;
    }

    result.push({
      sessionId,
      messageCount: session.history.length,
      updatedAt: session.updatedAt,
    });
  }

  return result;
}
