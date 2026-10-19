/**
 * Confirmations whose wait timed out but whose card is still answerable.
 *
 * The gate can only hold a request open for so long — the MCP tool call and
 * Node's own server timeout both cap it — but a card going unanswered for three
 * minutes is an ordinary thing for a user to do, and killing the card at that
 * point is what left them told to click something already retired.
 *
 * Detaching separates the two: the waiting call ends, the card stays live, and
 * the request it stands for is parked here until the user answers. A late
 * approval replays it over the bridge's own loopback interface carrying the id
 * as a one-shot token, because GatedAction describes what is being asked, not
 * the HTTP call that would carry it out.
 *
 * Pure and import-free, like actionGate.ts beside it, so the bridge's testable
 * state does not drag better-sqlite3 and electron into a unit test.
 */

/** Everything needed to re-issue a gated request once the user says yes. */
export interface DetachedApproval {
  /** The confirm id the card was shown with; also the replay token. */
  id: string;
  /** Command name, for the card and for log lines. */
  command: string;
  method: string;
  path: string;
  body: unknown;
}

const detached = new Map<string, DetachedApproval>();

/**
 * The abort reason the bridge uses to tell the approver "stop waiting, but
 * leave the card up". Any other abort reason still means the question is dead
 * and the card should retire, which is what a caller hanging up implies.
 */
export const DETACH_REASON = 'downlodr:detach-prompt';

export function registerDetachedApproval(record: DetachedApproval): void {
  detached.set(record.id, record);
}

/**
 * Claim a detached request for replay. One-shot: the record is removed as it is
 * handed over, so a double-click or a replayed token cannot run the action
 * twice.
 */
export function takeDetachedApproval(id: string): DetachedApproval | null {
  const record = detached.get(id) ?? null;
  if (record) detached.delete(id);
  return record;
}

/**
 * Read a record without claiming it.
 *
 * The late-answer handler needs the parked method, path and body to build the
 * replay request, but it must leave the token in place: the replay itself is
 * what consumes it, inside the gate. Taking it here would make the gate find
 * nothing and raise a second card for the action the user just approved.
 */
export function peekDetachedApproval(id: string): DetachedApproval | null {
  return detached.get(id) ?? null;
}

/** Forget a record without running it — the user declined, or it went stale. */
export function dropDetachedApproval(id: string): void {
  detached.delete(id);
}

export function detachedApprovalCount(): number {
  return detached.size;
}

/** Test seam; also used when the last chat window goes away. */
export function clearDetachedApprovals(): void {
  detached.clear();
}

/**
 * What the agent is told when a wait detaches.
 *
 * Deliberately not phrased as an expiry. The old timeout message said the card
 * "has expired and can no longer be answered — do not ask the user to click
 * it", which is now false: clicking is exactly what finishes this. It must also
 * stop the agent re-issuing the command, or the user ends up with two cards for
 * one action.
 */
export function describeDetachedWait(command: string): string {
  return (
    `"${command}" has not been answered yet, so this call stopped waiting. The ` +
    `confirmation card is still open and the user can answer it whenever they ` +
    `like — approving it runs the command and picks this work back up. Do not ` +
    `re-issue the command and do not raise another card: tell the user the card ` +
    `is waiting for them, then stop.`
  );
}
