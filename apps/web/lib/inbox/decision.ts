/** Operator's call on a creator's reply. */
export type ReplyDecision = "yes" | "no";

/** The AI's guess, in the same terms the operator decides in. */
export type AiReplyGuess = "yes" | "no" | "unclear";

/** Map the classifier's intent onto the yes / no / unclear the operator sees. */
export function guessFromIntent(intent: string | null | undefined): AiReplyGuess | null {
  switch (intent) {
    case "positive":
    case "address":
      return "yes";
    case "negative":
      return "no";
    case "question":
    case "other":
      return "unclear";
    case null:
    case undefined:
      return null;
    default:
      return "unclear";
  }
}

/** Only label replies with AI when a key is configured; never create noise otherwise. */
export function aiLabelingEnabled(): boolean {
  return Boolean(process.env.OPENAI_API_KEY);
}
