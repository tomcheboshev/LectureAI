import { UAParser } from "ua-parser-js";

// Parses a raw User-Agent string into the coarse device/browser/os labels
// the Sessions UI displays — called once at token-issuance time (not
// re-parsed on every list request) and stored alongside the refresh-token
// subdoc itself.
export function parseUserAgent(uaString) {
  if (!uaString) return { device: null, browser: null, os: null };
  const { browser, os, device } = new UAParser(uaString).getResult();
  return {
    device: device?.model || device?.type || null,
    browser: browser?.name || null,
    os: os?.name && os?.version ? `${os.name} ${os.version}` : os?.name || null,
  };
}

// Maps refreshTokens subdocs to the shape the Sessions UI needs, omitting
// tokenHash (never sent to the client) and flagging which one is the
// caller's own current session.
export function listSessions(user, currentSessionId) {
  return (user.refreshTokens || [])
    .map((t) => ({
      sessionId: t.sessionId,
      device: t.device,
      browser: t.browser,
      os: t.os,
      ip: t.ip,
      lastActiveAt: t.lastActiveAt,
      createdAt: t.createdAt,
      isCurrent: t.sessionId === currentSessionId,
    }))
    .sort((a, b) => (b.lastActiveAt || 0) - (a.lastActiveAt || 0));
}

// Returns true if a session with this id existed and was removed.
export function revokeSession(user, sessionId) {
  const before = user.refreshTokens.length;
  user.refreshTokens = user.refreshTokens.filter((t) => t.sessionId !== sessionId);
  return user.refreshTokens.length < before;
}

export function revokeOtherSessions(user, currentSessionId) {
  user.refreshTokens = user.refreshTokens.filter((t) => t.sessionId === currentSessionId);
}

export function revokeAllSessions(user) {
  user.refreshTokens = [];
}
