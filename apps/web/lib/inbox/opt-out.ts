/**
 * Spotting replies that plainly ask to stop being emailed ("unsubscribe",
 * "take me off your list"). These are handled automatically so they never
 * sit in "Needs your call". Deliberately conservative: anything with a
 * question, a hedge, a redirect or a negation is left for a person.
 */

/** Stored on Message.classification when a reply was auto-handled as an opt-out. */
export const OPT_OUT_CLASSIFICATION = "unsubscribe";

/** Keyword-only matches must be this short; longer replies also need the AI to agree. */
const MAX_WORDS_KEYWORD_ONLY = 25;
const MAX_WORDS_WITH_AI = 60;
const MIN_AI_CONFIDENCE = 0.85;

/** Whole-reply one-word opt-outs ("STOP", "Unsubscribe."). */
const BARE_OPT_OUT = /^(stop|unsubscribe|remove|remove me|opt out)[.!]*$/;

const OPT_OUT_PHRASES: RegExp[] = [
  /\bunsubscribe\b/,
  /\bopt(?:ing)?[\s-]?out\b/,
  /\b(?:take|remove|delete|drop)\s+(?:me|my\s+(?:email|address))\s+(?:off|from)\b/,
  /\bremove\s+me\b/,
  /\bstop\s+(?:emailing|contacting|messaging|sending|reaching\s+out)\b/,
  /\b(?:do\s+not|don'?t)\s+(?:email|contact|message|reach\s+out\s+to)\s+me\b/,
  /\bno\s+more\s+emails\b/,
];

/** Signals that a person should read it: questions, hedges, redirects, negated asks. */
const AMBIGUOUS_SIGNALS: RegExp[] = [
  /\?/,
  /@/,
  /\b(?:but|maybe|later|unless|though|however|instead|actually)\b/,
  /\b(?:would\s+love|love\s+to|happy\s+to|sounds\s+(?:good|great)|yes|sure)\b/,
  /(?<!not\s)(?<!n't\s)\binterested\s+in\b/,
  /\b(?:click|link)\b/,
  /\b(?:manager|agent|agency|team|assistant)\b/,
  /\b(?:how|where)\s+(?:do|can)\s+i\b/,
  /\b(?:don'?t|do\s+not|didn'?t|never|not)\s+(?:want\s+to\s+|mean\s+to\s+)?(?:unsubscribe|opt[\s-]?out|remove)\b/,
];

/** Drop signatures and anything quoted below the reply. */
function replyText(body: string): string {
  const cut = body.split(/\n\s*(?:--\s*\n|sent from my |on .+wrote:)/i)[0] ?? "";
  return cut
    .split("\n")
    .filter((line) => !line.trim().startsWith(">"))
    .join(" ")
    .replace(/[‘’]/g, "'")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

function wordCount(text: string): number {
  return text ? text.split(" ").length : 0;
}

export type ReplyGuess = { intent: string; confidence: number } | null | undefined;

/**
 * True only when the reply is clearly a request to stop being emailed.
 * A short reply needs only the phrase; a longer one also needs the AI to
 * have called it a confident "negative". If the AI read it as anything
 * other than negative, it is never auto-handled.
 */
export function isClearOptOut(body: string, guess?: ReplyGuess): boolean {
  const text = replyText(body);
  if (!text) return false;

  const aiKnown = guess && guess.confidence > 0;
  if (aiKnown && guess.intent !== "negative") return false;

  if (BARE_OPT_OUT.test(text)) return true;
  if (!OPT_OUT_PHRASES.some((p) => p.test(text))) return false;
  if (AMBIGUOUS_SIGNALS.some((p) => p.test(text))) return false;

  const words = wordCount(text);
  if (words <= MAX_WORDS_KEYWORD_ONLY) return true;
  return Boolean(
    aiKnown && guess.confidence >= MIN_AI_CONFIDENCE && words <= MAX_WORDS_WITH_AI
  );
}

/** The stored latest message of a thread, as the backfill reads it. */
export type StoredReply = {
  direction: string;
  body: string;
  classification: string | null;
  confidence: number | null;
};

/**
 * Same conservative rule for replies that arrived before opt-outs were
 * handled automatically. Only the thread's latest message counts, it must be
 * from the creator, and a stored AI label is used the same way a fresh guess is.
 */
export function isStoredOptOut(latest: StoredReply | null | undefined): boolean {
  if (!latest || latest.direction !== "inbound") return false;
  const guess =
    latest.classification && latest.confidence != null && latest.confidence > 0
      ? { intent: latest.classification, confidence: latest.confidence }
      : null;
  return isClearOptOut(latest.body, guess);
}
