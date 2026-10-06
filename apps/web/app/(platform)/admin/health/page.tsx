import { redirect } from "next/navigation";

/** System status was merged into Problems; old links and bookmarks land there. */
export default function AdminHealthPage() {
  redirect("/interventions");
}
