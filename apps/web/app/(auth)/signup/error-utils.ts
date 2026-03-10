export function getFriendlySignupError(message: string): string {
  const normalized = message.toLowerCase();

  if (normalized.includes("rate limit")) {
    return "Signup email limit reached. If this address was just registered, wait a minute and check the inbox instead of retrying. If you need immediate access, recover or confirm the pending Supabase user.";
  }

  if (normalized.includes("email address not authorized")) {
    return "This Supabase project is still using the default SMTP allowlist. Add a custom SMTP provider or authorize this address in the Supabase org before using email signup.";
  }

  return message;
}
