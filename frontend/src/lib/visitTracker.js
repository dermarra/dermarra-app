/** Anonymous shop-visit counting (see backend analytics_service.py).
 *
 * A random visitor id lives in this browser's storage -- no name, account,
 * IP address or cookie. We ping on each page view and once a minute while
 * the tab is visible; the server turns pings into visits (30-minute idle
 * timeout). Admins browsing the shop aren't counted (caller decides). */
import client from "../api/client";

const KEY = "dermarra.vid";
let memoryId = null;

function visitorId() {
  try {
    let id = localStorage.getItem(KEY);
    if (!id) {
      id = crypto.randomUUID();
      localStorage.setItem(KEY, id);
    }
    return id;
  } catch {
    // Private mode / storage blocked: count this tab only.
    memoryId ||= crypto.randomUUID?.() || null;
    return memoryId;
  }
}

export function ping(path, newPage) {
  const id = visitorId();
  if (!id) return;
  client
    .post("/analytics/ping", {
      visitor_id: id,
      path,
      new_page: newPage,
      referrer: newPage ? document.referrer : undefined,
    })
    .catch(() => {});
}
