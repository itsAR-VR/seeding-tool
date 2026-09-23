import Link from "next/link";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

// Kalm's instance is invite-only: accounts are created by Kalm, not self-serve.
export default function SignupPage() {
  return (
    <div className="flex min-h-screen items-center justify-center p-4">
      <Card className="w-full max-w-md text-center">
        <CardHeader>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/kalm-logo.png" alt="Kalm" className="mx-auto h-8 w-auto" />
          <CardTitle className="text-2xl font-bold">Access is by invitation</CardTitle>
          <CardDescription>Ask Kam to add you to Kalm&apos;s creator seeding workspace.</CardDescription>
        </CardHeader>
        <CardContent>
          <Link href="/login" className="text-sm font-medium underline underline-offset-4">
            Back to sign in
          </Link>
        </CardContent>
      </Card>
    </div>
  );
}
