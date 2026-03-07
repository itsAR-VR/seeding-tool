import type { Metadata } from "next";
import PricingContent from "../components/PricingContent";

export const metadata: Metadata = {
  title: "Pricing | Seeding OS",
  description:
    "Choose the rollout path that matches your creator operation and talk through the right starting point.",
  openGraph: {
    title: "Pricing | Seeding OS",
    description:
      "Choose the rollout path that matches your creator operation and talk through the right starting point.",
    type: "website",
  },
};

export default function PricingPage() {
  return <PricingContent />;
}
