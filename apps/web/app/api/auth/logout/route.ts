import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function POST(request: Request) {
  const supabase = await createClient();
  const redirectUrl = new URL("/login", request.url);

  await supabase.auth.signOut();

  return NextResponse.redirect(redirectUrl, { status: 302 });
}
