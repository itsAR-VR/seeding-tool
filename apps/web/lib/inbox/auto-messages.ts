/**
 * Emails that come back without a person behind them: out-of-office and
 * "thanks for your email" auto-replies, and bounces ("address not found").
 *
 * Neither is a reply. An auto-reply is kept on the conversation (stored with
 * direction "auto") so it never lands in "Needs your answer". A bounce marks
 * the creator "Email bounced" so nobody waits on an email that never arrived.
 */

/** Stored as Message.direction for both kinds, so "latest message is inbound" rules skip them. */
export const AUTO_DIRECTION = "auto";
export const AUTO_REPLY_CLASSIFICATION = "auto_reply";
export const BOUNCE_CLASSIFICATION = "bounce";
/** Set when someone says an auto-reply guess was wrong, so it's never re-guessed. */
export const HUMAN_REPLY_CLASSIFICATION = "human_reply";

/** The headers mail servers set on automatic mail (RFC 3834 and common vendor ones). */
export type AutoHeaders = {
  autoSubmitted?: string;
  precedence?: string;
  xAutoreply?: string;
  xAutoresponse?: string;
  failedRecipients?: string;
};

type IncomingMail = {
  from: string;
  subject?: string;
  body?: string;
  headers?: AutoHeaders;
};

const BOUNCE_SENDER = /(mailer-daemon|postmaster|mail delivery (subsystem|system))/i;
const BOUNCE_SUBJECT =
  /(delivery status notification|undeliverable|undelivered mail|mail delivery (failed|failure)|returned mail|delivery (has )?failed|failure notice|message not delivered|address not found)/i;

/** A delivery failure notice from a mail server. */
export function isBounce(mail: IncomingMail): boolean {
  if (mail.headers?.failedRecipients) return true;
  if (BOUNCE_SENDER.test(mail.from)) return true;
  // Some servers send from an ordinary-looking address; then the subject and body must both say so.
  return BOUNCE_SUBJECT.test(mail.subject ?? "") && BOUNCE_BODY.test(mail.body ?? "");
}

const BOUNCE_BODY = /(wasn't delivered|was not delivered|couldn't be delivered|could not be delivered|delivery to the following recipient|permanent(ly)? fail|address couldn't be found|user unknown|no such user)/i;

const EMAIL = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi;

/** Every address a bounce mentions, lowercased, leaving out the mail server's own. */
export function bouncedAddresses(mail: IncomingMail): string[] {
  const found = new Set<string>();
  for (const part of (mail.headers?.failedRecipients ?? "").split(",")) {
    const address = part.trim().toLowerCase();
    if (address) found.add(address);
  }
  for (const match of (mail.body ?? "").matchAll(EMAIL)) {
    const address = match[0].toLowerCase().replace(/\.$/, "");
    if (!BOUNCE_SENDER.test(address)) found.add(address);
  }
  return [...found];
}

const AUTO_SUBJECT = /^\s*(automatic reply|auto[\s-]?reply|autoreply|auto[\s-]?response|out of (the )?office|ooo\b|away from|on vacation|auto:)/i;

const AUTO_BODY = [
  /out of (the )?office/i,
  /away from (my )?(email|desk|the office)/i,
  /(limited|no) access to (my )?email/i,
  /(i am|i'm) (currently )?(away|travell?ing|on (vacation|holiday|leave|maternity leave))/i,
  /this is an automat(ed|ic) (reply|response|message)/i,
  /auto[\s-]?(reply|response|responder)/i,
  /(will|'ll) (respond|reply|get back to you) (as soon as|when|upon) (possible|i return|i'm back)/i,
];

/** Openers typical of canned "thanks for writing" responders. */
const CANNED_THANKS = /^\W*(hi|hello|hey)?[^.!?\n]{0,40}?\b(thank you|thanks) for (your (email|message|interest|note)|reaching out|contacting|getting in touch)/i;

/** What responders say next ("…I'll get back to you within 48 hours"). A person saying thanks rarely does. */
const RESPONDER_PROMISE =
  /(get(ting)? back to you|respond (to you )?(within|as soon|shortly)|reply (within|as soon|shortly)|within \d+ (business )?(hours|days)|in the meantime|connected to email|please (fill out|complete|visit|see)|for (urgent|immediate) (matters|questions|help))/i;

/** Within this long of our email, a canned thank-you is a responder, not a person. */
export const INSTANT_MS = 3 * 60 * 1000;

/**
 * An automatic reply. Headers are the strongest sign; without them (older
 * stored mail) the subject, typical out-of-office wording, or a canned
 * thank-you with a responder's promise that arrived within minutes of our
 * email. The thread view can move one back to "Needs your answer".
 */
export function isAutoReply(
  mail: IncomingMail,
  opts: { sinceOurEmailMs?: number | null; withinMs?: number } = {},
): boolean {
  const h = mail.headers ?? {};
  if (h.autoSubmitted && h.autoSubmitted.trim().toLowerCase() !== "no") return true;
  if (h.xAutoreply || h.xAutoresponse) return true;
  if (h.precedence && /^(auto_reply|bulk|junk)$/i.test(h.precedence.trim())) return true;
  if (AUTO_SUBJECT.test(mail.subject ?? "")) return true;

  // Without headers or a telltale subject, wording alone only counts when it came back
  // within minutes: a person can write "I'm out of office this week, but yes!" or
  // "Thank you for reaching out! I'd love one", and those must never be hidden.
  const body = mail.body ?? "";
  const window = opts.withinMs ?? INSTANT_MS;
  const instant = opts.sinceOurEmailMs != null && opts.sinceOurEmailMs >= 0 && opts.sinceOurEmailMs <= window;
  if (!instant) return false;
  if (AUTO_BODY.some((pattern) => pattern.test(body))) return true;
  return CANNED_THANKS.test(body) && RESPONDER_PROMISE.test(body);
}
