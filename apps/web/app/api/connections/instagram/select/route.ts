import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { decrypt, encrypt } from "@/lib/encryption";
import { subscribePageToWebhooks } from "@/lib/instagram/client";
import {
  BrandAccessError,
  getCurrentBrandMembership,
  requireAdminAccess,
} from "@/lib/integrations/brand-access";

type Page = { igId: string; username: string | null; pageId: string; pageToken: string };
type Meta = {
  igOptions?: Array<{ igId: string; username: string | null }>;
  adAccountOptions?: Array<{ id: string; name: string | null }>;
  adAccountId?: string | null;
  [key: string]: unknown;
};

/**
 * POST /api/connections/instagram/select — pick which Instagram account and
 * which ad account this brand uses, from the ones its Facebook login can see.
 * Body: { igUserId?, adAccountId? }
 */
export async function POST(request: Request) {
  try {
    const membership = requireAdminAccess(await getCurrentBrandMembership());
    const brandId = membership.brandId;
    const body = (await request.json().catch(() => ({}))) as { igUserId?: unknown; adAccountId?: unknown };

    const [connection, credential] = await Promise.all([
      prisma.brandConnection.findFirst({ where: { brandId, provider: "instagram", status: "connected" } }),
      prisma.providerCredential.findFirst({ where: { brandId, provider: "instagram", isValid: true } }),
    ]);
    if (!connection || !credential) {
      return NextResponse.json({ error: "Connect Instagram first." }, { status: 400 });
    }
    const meta = (connection.metadata ?? {}) as Meta;
    const updates: Meta = {};

    if (typeof body.igUserId === "string") {
      const payload = JSON.parse(decrypt(credential.encryptedValue)) as Record<string, unknown> & { pages?: Page[] };
      const page = payload.pages?.find((p) => p.igId === body.igUserId);
      if (!page) {
        return NextResponse.json({ error: "Reconnect Instagram to see that account." }, { status: 400 });
      }
      await prisma.providerCredential.update({
        where: { id: credential.id },
        data: {
          label: page.username ?? page.igId,
          encryptedValue: encrypt(
            JSON.stringify({ ...payload, accessToken: page.pageToken, igUserId: page.igId, igUsername: page.username })
          ),
        },
      });
      Object.assign(updates, { igUserId: page.igId, igUsername: page.username, pageId: page.pageId });
      await subscribePageToWebhooks(page.pageId, page.pageToken).catch((error) =>
        console.error("[instagram/select] webhook subscription failed", error)
      );
    }

    if (typeof body.adAccountId === "string") {
      const account = meta.adAccountOptions?.find((a) => a.id === body.adAccountId);
      if (!account) {
        return NextResponse.json({ error: "That ad account isn't available." }, { status: 400 });
      }
      if (account.id !== meta.adAccountId) {
        Object.assign(updates, {
          adAccountId: account.id,
          adAccountName: account.name,
          adsCampaignId: null,
          adsAdSetId: null,
        });
      }
    }

    await prisma.brandConnection.update({
      where: { id: connection.id },
      data: {
        metadata: { ...meta, ...updates } as Prisma.InputJsonValue,
        ...(typeof updates.igUsername === "string" ? { externalId: updates.igUsername } : {}),
      },
    });
    return NextResponse.json({ ok: true });
  } catch (error) {
    if (error instanceof BrandAccessError) return NextResponse.json({ error: error.message }, { status: error.status });
    console.error("[instagram/select]", error);
    return NextResponse.json({ error: "Couldn't save your choice" }, { status: 500 });
  }
}
