import { NextResponse } from "next/server";
import {
  BrandAccessError,
  getCurrentBrandMembership,
  requireAdminAccess,
} from "@/lib/integrations/brand-access";
import { createInvite, InviteError } from "@/lib/invites";

const ROLES = ["owner", "editor", "viewer"] as const;
type Role = (typeof ROLES)[number];

/** POST /api/team/invites — invite a teammate. Body: { email, role } */
export async function POST(request: Request) {
  try {
    const membership = requireAdminAccess(await getCurrentBrandMembership());
    const body = (await request.json().catch(() => ({}))) as { email?: unknown; role?: unknown };
    const role: Role = ROLES.includes(body.role as Role) ? (body.role as Role) : "editor";
    if (role === "owner" && membership.role !== "owner") {
      throw new InviteError("Only owners can invite another owner.", 403);
    }
    const result = await createInvite({
      email: typeof body.email === "string" ? body.email : "",
      role,
      brandId: membership.brandId,
      invitedById: membership.userId,
    });
    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof BrandAccessError || error instanceof InviteError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error("[team/invites POST]", error);
    return NextResponse.json({ error: "Couldn't create the invite" }, { status: 500 });
  }
}
