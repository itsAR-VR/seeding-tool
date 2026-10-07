import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { prisma } from "@/lib/prisma";
import {
  BrandAccessError,
  getCurrentBrandMembership,
  requireAdminAccess,
} from "@/lib/integrations/brand-access";

const TYPES: Record<string, string> = { "image/png": "png", "image/jpeg": "jpg", "image/svg+xml": "svg", "image/webp": "webp" };
const MAX_BYTES = 2 * 1024 * 1024;

/** POST /api/brand-kit/logo — upload the brand's logo (PNG, JPG, SVG or WebP, up to 2 MB). */
export async function POST(request: Request) {
  try {
    const { brandId } = requireAdminAccess(await getCurrentBrandMembership());
    const form = await request.formData();
    const file = form.get("logo");
    if (!(file instanceof File)) return NextResponse.json({ error: "Choose a logo file." }, { status: 400 });
    const ext = TYPES[file.type];
    if (!ext) return NextResponse.json({ error: "Use a PNG, JPG, SVG or WebP file." }, { status: 400 });
    if (file.size > MAX_BYTES) return NextResponse.json({ error: "Logos must be under 2 MB." }, { status: 400 });

    const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
      auth: { persistSession: false },
    });
    // New name each time so browsers don't keep showing the old logo.
    const path = `${brandId}/branding/logo-${Date.now()}.${ext}`;
    const { error } = await supabase.storage
      .from("mention-media")
      .upload(path, Buffer.from(await file.arrayBuffer()), { contentType: file.type, upsert: true });
    if (error) throw error;
    const { data } = supabase.storage.from("mention-media").getPublicUrl(path);

    await prisma.brand.update({ where: { id: brandId }, data: { logoUrl: data.publicUrl } });
    return NextResponse.json({ logoUrl: data.publicUrl });
  } catch (error) {
    if (error instanceof BrandAccessError) return NextResponse.json({ error: error.message }, { status: error.status });
    console.error("[brand-kit/logo]", error);
    return NextResponse.json({ error: "Couldn't upload the logo" }, { status: 500 });
  }
}
