import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function POST(request: Request) {
  const supabase = await createClient();
  await supabase.auth.signOut();

  // 303 so the browser follows with a GET. Clear the chosen company too, so
  // the next person to sign in on this browser starts from their own.
  const response = NextResponse.redirect(new URL("/login", request.url), { status: 303 });
  response.cookies.delete("seed-active-brand");
  return response;
}
