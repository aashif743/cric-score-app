// Lightweight, fire-and-forget usage analytics for the web app.
//
// Sends a view/open "event" to the backend so we can measure traffic to the
// public pages (live scorecards, overlay, TV boards, landing) that have no
// per-user login. A stable anonymous `visitorId` (localStorage) lets us count
// unique visitors; a signed-in viewer's token is attached so they're attributed
// to their account. Analytics must NEVER break or slow the app — every path is
// wrapped and failures are swallowed.

const API_URL = import.meta.env.VITE_API_BASE_URL || "http://localhost:5000";
const VISITOR_KEY = "cz_visitor_id";

function getVisitorId() {
  try {
    let id = localStorage.getItem(VISITOR_KEY);
    if (!id) {
      id =
        typeof crypto !== "undefined" && crypto.randomUUID
          ? crypto.randomUUID()
          : Date.now().toString(36) + Math.random().toString(36).slice(2);
      localStorage.setItem(VISITOR_KEY, id);
    }
    return id;
  } catch (_) {
    return "";
  }
}

function getToken() {
  try {
    const raw = localStorage.getItem("user");
    return raw ? JSON.parse(raw)?.token || "" : "";
  } catch (_) {
    return "";
  }
}

// De-dupe the same view within a single page session so a re-render doesn't
// double-count.
const sent = new Set();

export function trackView(type, meta = {}) {
  try {
    const path = meta.path || (typeof window !== "undefined" ? window.location.pathname : "");
    const key = `${type}|${path}`;
    if (sent.has(key)) return;
    sent.add(key);

    const headers = { "Content-Type": "application/json" };
    const token = getToken();
    if (token) headers.Authorization = `Bearer ${token}`;

    fetch(`${API_URL}/api/analytics/event`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        type,
        visitorId: getVisitorId(),
        path,
        tournamentId: meta.tournamentId || null,
        platform: "web",
      }),
      keepalive: true,
    }).catch(() => {});
  } catch (_) {
    /* never throw from analytics */
  }
}

export default { trackView };
