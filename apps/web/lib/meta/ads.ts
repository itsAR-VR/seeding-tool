import { prisma } from "@/lib/prisma";
import { decrypt } from "@/lib/encryption";

const GRAPH = "https://graph.facebook.com/v21.0";

/** Name of the one campaign that holds every ad the tool makes. */
const CAMPAIGN_NAME = "Seed Scale · Creator content";

/** Default budget for the tool's ad set, in cents. The ad set is created paused. */
const DEFAULT_DAILY_BUDGET_CENTS = 1000;

export class MetaAdsError extends Error {}

type AdsContext = {
  brandId: string;
  connectionId: string;
  token: string;
  adAccountId: string;
  pageId: string;
  igUserId: string;
  campaignId: string | null;
  adSetId: string | null;
};

type ConnectionMetadata = {
  igUserId?: string;
  pageId?: string;
  adAccountId?: string | null;
  adsCampaignId?: string;
  adsAdSetId?: string;
  [key: string]: unknown;
};

async function graph<T>(path: string, token: string, body?: Record<string, unknown>): Promise<T> {
  const url = new URL(`${GRAPH}/${path}`);
  let init: RequestInit | undefined;
  if (body) {
    const form = new URLSearchParams({ access_token: token });
    for (const [key, value] of Object.entries(body)) {
      if (value === undefined) continue;
      form.set(key, typeof value === "string" ? value : JSON.stringify(value));
    }
    init = { method: "POST", body: form };
  } else {
    url.searchParams.set("access_token", token);
  }
  const res = await fetch(url, init);
  const json = (await res.json().catch(() => ({}))) as { error?: { message?: string; error_user_msg?: string } };
  if (!res.ok || json.error) {
    const message = json.error?.error_user_msg || json.error?.message || `Meta API error ${res.status}`;
    throw new MetaAdsError(message);
  }
  return json as T;
}

async function loadAdsContext(brandId: string): Promise<AdsContext> {
  const [credential, connection] = await Promise.all([
    prisma.providerCredential.findFirst({
      where: { brandId, provider: "instagram", isValid: true },
      orderBy: { updatedAt: "desc" },
    }),
    prisma.brandConnection.findFirst({ where: { brandId, provider: "instagram", status: "connected" } }),
  ]);
  if (!credential || !connection) {
    throw new MetaAdsError("Connect Instagram in Settings first.");
  }
  const payload = JSON.parse(decrypt(credential.encryptedValue)) as {
    userAccessToken?: string;
    igUserId?: string;
  };
  const meta = (connection.metadata ?? {}) as ConnectionMetadata;
  if (!meta.adAccountId) {
    throw new MetaAdsError("No ad account found. Reconnect Instagram in Settings to allow ads.");
  }
  if (!payload.userAccessToken || !meta.pageId) {
    throw new MetaAdsError("Reconnect Instagram in Settings to allow ads.");
  }
  return {
    brandId,
    connectionId: connection.id,
    token: payload.userAccessToken,
    adAccountId: meta.adAccountId,
    pageId: meta.pageId,
    igUserId: meta.igUserId ?? payload.igUserId ?? "",
    campaignId: meta.adsCampaignId ?? null,
    adSetId: meta.adsAdSetId ?? null,
  };
}

async function saveAdsIds(ctx: AdsContext, ids: { adsCampaignId: string; adsAdSetId: string }) {
  const connection = await prisma.brandConnection.findUniqueOrThrow({ where: { id: ctx.connectionId } });
  await prisma.brandConnection.update({
    where: { id: ctx.connectionId },
    data: { metadata: { ...((connection.metadata ?? {}) as object), ...ids } },
  });
}

/**
 * One paused campaign + ad set holds every ad the tool makes, so they're easy
 * to find in Ads Manager. Created on first use.
 */
async function ensureCampaignAndAdSet(ctx: AdsContext): Promise<{ campaignId: string; adSetId: string }> {
  if (ctx.campaignId && ctx.adSetId) {
    return { campaignId: ctx.campaignId, adSetId: ctx.adSetId };
  }
  // Reuse the tool's campaign if it already exists in the account.
  const existing = await graph<{ data?: Array<{ id: string; adsets?: { data?: Array<{ id: string }> } }> }>(
    `${ctx.adAccountId}/campaigns?fields=id,adsets{id}&filtering=${encodeURIComponent(
      JSON.stringify([{ field: "name", operator: "EQUAL", value: CAMPAIGN_NAME }])
    )}&limit=5`,
    ctx.token
  ).catch(() => null);
  const found = existing?.data?.find((c) => c.adsets?.data?.length);
  if (found) {
    const ids = { adsCampaignId: found.id, adsAdSetId: found.adsets!.data![0].id };
    await saveAdsIds(ctx, ids);
    return { campaignId: ids.adsCampaignId, adSetId: ids.adsAdSetId };
  }
  const campaign = await graph<{ id: string }>(`${ctx.adAccountId}/campaigns`, ctx.token, {
    name: CAMPAIGN_NAME,
    objective: "OUTCOME_TRAFFIC",
    status: "PAUSED",
    special_ad_categories: [],
    // Budget lives on the ad set, not the campaign; Meta requires saying so.
    is_adset_budget_sharing_enabled: false,
  });
  const adSet = await graph<{ id: string }>(`${ctx.adAccountId}/adsets`, ctx.token, {
    name: "Creator content · US",
    campaign_id: campaign.id,
    daily_budget: String(DEFAULT_DAILY_BUDGET_CENTS),
    billing_event: "IMPRESSIONS",
    optimization_goal: "LANDING_PAGE_VIEWS",
    bid_strategy: "LOWEST_COST_WITHOUT_CAP",
    destination_type: "WEBSITE",
    targeting: {
      geo_locations: { countries: ["US"] },
      age_min: 18,
      targeting_automation: { advantage_audience: 1 },
    },
    status: "PAUSED",
  });
  const ids = { adsCampaignId: campaign.id, adsAdSetId: adSet.id };
  await saveAdsIds(ctx, ids);
  return { campaignId: campaign.id, adSetId: adSet.id };
}

async function waitForVideo(ctx: AdsContext, videoId: string): Promise<void> {
  for (let i = 0; i < 20; i++) {
    const video = await graph<{ status?: { video_status?: string } }>(`${videoId}?fields=status`, ctx.token);
    const status = video.status?.video_status;
    if (status === "ready") return;
    if (status === "error") throw new MetaAdsError("Meta couldn't process the video.");
    await new Promise((r) => setTimeout(r, 2500));
  }
  throw new MetaAdsError("The video is still processing. Try again in a minute.");
}

async function uploadImage(ctx: AdsContext, imageUrl: string): Promise<string> {
  const res = await fetch(imageUrl);
  if (!res.ok) throw new MetaAdsError("Couldn't download the post image. Check for new posts and try again.");
  const bytes = Buffer.from(await res.arrayBuffer()).toString("base64");
  const result = await graph<{ images: Record<string, { hash: string }> }>(
    `${ctx.adAccountId}/adimages`,
    ctx.token,
    { bytes }
  );
  const first = Object.values(result.images)[0];
  if (!first) throw new MetaAdsError("Meta didn't accept the image.");
  return first.hash;
}

export type AdCopy = { message: string; headline: string; link: string };

function adsManagerUrl(ctx: AdsContext, adId: string): string {
  const account = ctx.adAccountId.replace(/^act_/, "");
  return `https://adsmanager.facebook.com/adsmanager/manage/ads?act=${account}&selected_ad_ids=${adId}`;
}

/**
 * Makes a PAUSED ad from an approved post, run from the brand's Page and
 * Instagram account. Nothing spends until someone turns it on in Ads Manager.
 */
export async function createPausedBrandAd(
  postId: string,
  copy: AdCopy
): Promise<{ adId: string; adsManagerUrl: string }> {
  const post = await prisma.contentPost.findUniqueOrThrow({ where: { id: postId } });
  if (post.rightsStatus !== "approved") {
    throw new MetaAdsError("Get usage rights approved before making an ad.");
  }
  if (post.metaAdId) {
    throw new MetaAdsError("This post already has an ad.");
  }
  const isVideo = post.mediaType === "VIDEO" || /\.(mp4|mov|webm)$/i.test(post.mediaUrl ?? "");
  if (!post.mediaUrl) {
    throw new MetaAdsError(
      isVideo
        ? "Instagram didn't share this video's file. Ask the creator to upload the original, or use a partnership ad code."
        : "No image saved for this post yet."
    );
  }

  const ctx = await loadAdsContext(post.brandId);
  const { adSetId } = await ensureCampaignAndAdSet(ctx);
  const cta = { type: "SHOP_NOW", value: { link: copy.link } };
  const identity = ctx.igUserId ? { instagram_user_id: ctx.igUserId } : {};
  const credit = post.username ? ` (@${post.username})` : "";

  let objectStorySpec: Record<string, unknown>;
  if (isVideo) {
    const video = await graph<{ id: string }>(`${ctx.adAccountId}/advideos`, ctx.token, {
      file_url: post.mediaUrl,
      name: `Creator post${credit}`,
    });
    await waitForVideo(ctx, video.id);
    objectStorySpec = {
      page_id: ctx.pageId,
      ...identity,
      video_data: {
        video_id: video.id,
        image_url: post.thumbnailUrl ?? undefined,
        message: copy.message,
        title: copy.headline,
        call_to_action: cta,
      },
    };
  } else {
    const imageHash = await uploadImage(ctx, post.mediaUrl);
    objectStorySpec = {
      page_id: ctx.pageId,
      ...identity,
      link_data: {
        image_hash: imageHash,
        link: copy.link,
        message: copy.message,
        name: copy.headline,
        call_to_action: cta,
      },
    };
  }

  const creative = await graph<{ id: string }>(`${ctx.adAccountId}/adcreatives`, ctx.token, {
    name: `Creator post${credit}`,
    object_story_spec: objectStorySpec,
  });
  const ad = await graph<{ id: string }>(`${ctx.adAccountId}/ads`, ctx.token, {
    name: `Creator post${credit}`,
    adset_id: adSetId,
    creative: { creative_id: creative.id },
    status: "PAUSED",
  });

  await prisma.contentPost.update({
    where: { id: post.id },
    data: { metaAdId: ad.id, metaAdCreatedAt: new Date(), metaAdKind: "brand" },
  });
  return { adId: ad.id, adsManagerUrl: adsManagerUrl(ctx, ad.id) };
}

/**
 * Makes a PAUSED partnership ad from a creator's partnership ad code. Meta
 * pulls the post itself, so no file is needed (works for reels with music).
 * The ad runs with the creator's and the brand's handles in the header.
 */
export async function createPausedPartnershipAd(
  postId: string,
  adCode: string
): Promise<{ adId: string; adsManagerUrl: string }> {
  const post = await prisma.contentPost.findUniqueOrThrow({ where: { id: postId } });
  if (post.metaAdId) {
    throw new MetaAdsError("This post already has an ad.");
  }
  const code = adCode.trim();
  if (!/^adcode-[A-Za-z0-9_-]{10,}$/.test(code)) {
    throw new MetaAdsError("That doesn't look like a partnership ad code. It starts with adcode-");
  }

  const ctx = await loadAdsContext(post.brandId);
  const { adSetId } = await ensureCampaignAndAdSet(ctx);
  const credit = post.username ? ` (@${post.username})` : "";

  const creative = await graph<{ id: string }>(`${ctx.adAccountId}/adcreatives`, ctx.token, {
    name: `Partnership${credit}`,
    object_id: ctx.pageId,
    branded_content: {
      instagram_boost_post_access_token: code,
      ad_format: 3, // let Meta pick one or both handles, whichever performs better
    },
    facebook_branded_content: { sponsor_page_id: ctx.pageId },
    instagram_branded_content: ctx.igUserId ? { sponsor_id: ctx.igUserId } : undefined,
  });
  const ad = await graph<{ id: string }>(`${ctx.adAccountId}/ads`, ctx.token, {
    name: `Partnership${credit}`,
    adset_id: adSetId,
    creative: { creative_id: creative.id },
    status: "PAUSED",
  });

  await prisma.contentPost.update({
    where: { id: post.id },
    data: { metaAdId: ad.id, metaAdCreatedAt: new Date(), metaAdKind: "partnership" },
  });
  return { adId: ad.id, adsManagerUrl: adsManagerUrl(ctx, ad.id) };
}

export type AdResults = {
  adId: string;
  status: string | null;
  spend: number;
  impressions: number;
  clicks: number;
  ctr: number | null;
  cpc: number | null;
  purchases: number;
  adsManagerUrl: string;
};

/** Status and lifetime results for the brand's ads. */
export async function getAdResults(brandId: string, adIds: string[]): Promise<AdResults[]> {
  if (adIds.length === 0) return [];
  const ctx = await loadAdsContext(brandId);
  return Promise.all(
    adIds.map(async (adId) => {
      const [ad, insights] = await Promise.all([
        graph<{ effective_status?: string }>(`${adId}?fields=effective_status`, ctx.token).catch(() => null),
        graph<{
          data?: Array<{
            spend?: string;
            impressions?: string;
            clicks?: string;
            ctr?: string;
            cpc?: string;
            actions?: Array<{ action_type: string; value: string }>;
          }>;
        }>(`${adId}/insights?fields=spend,impressions,clicks,ctr,cpc,actions&date_preset=maximum`, ctx.token).catch(
          () => null
        ),
      ]);
      const row = insights?.data?.[0];
      const purchases = Number(
        row?.actions?.find((a) => a.action_type === "offsite_conversion.fb_pixel_purchase" || a.action_type === "purchase")
          ?.value ?? 0
      );
      return {
        adId,
        status: ad?.effective_status ?? null,
        spend: Number(row?.spend ?? 0),
        impressions: Number(row?.impressions ?? 0),
        clicks: Number(row?.clicks ?? 0),
        ctr: row?.ctr ? Number(row.ctr) : null,
        cpc: row?.cpc ? Number(row.cpc) : null,
        purchases,
        adsManagerUrl: adsManagerUrl(ctx, adId),
      };
    })
  );
}
