import Link from "next/link";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

// Seed Scale is invite-only: accounts come from invite links, not self-serve signup.
export default function SignupPage() {
  return (
    <div className="flex min-h-screen items-center justify-center p-4">
      <Card className="w-full max-w-md text-center">
        <CardHeader>
          <p className="text-sm font-semibold tracking-tight text-muted-foreground">Seed Scale</p>
          <CardTitle className="text-2xl font-bold">Access is by invitation</CardTitle>
          <CardDescription>Open the invite link you were sent to create your account.</CardDescription>
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
