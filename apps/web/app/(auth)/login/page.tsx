import { safeNextPath } from "@/lib/auth/safe-next";
import { LoginForm } from "./login-form";

const LINK_ERRORS: Record<string, string> = {
  link: "That sign-in link was already used or has expired. Open your invite email and use its link to get a new one.",
  auth: "We couldn't sign you in with that link. Sign in with your password, or open your invite email and get a new link.",
};

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; error?: string }>;
}) {
  const { next, error } = await searchParams;
  return <LoginForm next={safeNextPath(next, "/dashboard")} initialError={(error && LINK_ERRORS[error]) || null} />;
}
