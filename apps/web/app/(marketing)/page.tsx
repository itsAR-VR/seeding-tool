import { redirect } from "next/navigation";

// Kalm's instance is an internal tool, not a marketing site: the root address
// opens the dashboard. The platform layout sends signed-out visitors to /login.
export default function HomePage() {
  redirect("/dashboard");
}
