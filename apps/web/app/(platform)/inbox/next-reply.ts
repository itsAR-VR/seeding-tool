/**
 * "Needs your answer" queue helpers, shared by the inbox list, the thread page
 * and GET /api/inbox/queue so "Next reply" walks the same order as the tab.
 */

/** A reply needs her answer when nobody has answered it and the creator wrote last. */
export function needsYourCall(decision: string | null, lastMessageDirection: string | null | undefined): boolean {
  return !decision && lastMessageDirection === "inbound";
}

export type QueueDirection = "next" | "previous";

/**
 * The reply to open after (or before) the current one.
 *
 * `order` is the queue as it was when the thread opened, so deciding on the
 * current thread (which drops it from the queue and bumps its updatedAt)
 * doesn't lose our place. `waiting` is the live queue: only those ids are
 * still worth opening.
 *
 * Next: the first still-waiting reply after this one, then any new replies
 * that arrived since, then wrap to ones she skipped earlier.
 * Previous: the closest still-waiting reply before this one, no wrapping.
 */
export function adjacentReply(
  order: readonly string[],
  waiting: readonly string[],
  currentId: string,
  direction: QueueDirection,
): string | null {
  const open = new Set(waiting);
  open.delete(currentId);
  if (open.size === 0) return null;

  const index = order.indexOf(currentId);
  switch (direction) {
    case "next": {
      if (index < 0) return waiting.find((id) => open.has(id)) ?? null;
      const after = order.slice(index + 1).find((id) => open.has(id));
      if (after) return after;
      const known = new Set(order);
      const arrived = waiting.find((id) => open.has(id) && !known.has(id));
      if (arrived) return arrived;
      return order.slice(0, index).find((id) => open.has(id)) ?? null;
    }
    case "previous": {
      if (index < 0) return null;
      return [...order.slice(0, index)].reverse().find((id) => open.has(id)) ?? null;
    }
    default: {
      const unhandled: never = direction;
      return unhandled;
    }
  }
}
