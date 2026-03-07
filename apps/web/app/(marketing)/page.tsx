import type { Metadata } from "next";
import HomeContent from "./components/HomeContent";

export const metadata: Metadata = {
  title: "Seeding OS | Run Seeding Like a System",
  description:
    "See how Seeding OS helps teams find the right creators, run the workflow, and verify what actually posted.",
  openGraph: {
    title: "Seeding OS | Run Seeding Like a System",
    description:
      "See how Seeding OS helps teams find the right creators, run the workflow, and verify what actually posted.",
    type: "website",
  },
};

export default function HomePage() {
  return <HomeContent />;
}
