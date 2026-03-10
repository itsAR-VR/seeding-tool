type BrandProfileSignalSource = {
  targetAudience?: unknown;
  audience?: unknown;
  target_audience?: unknown;
  niche?: unknown;
  category?: unknown;
  industry?: unknown;
  tone?: unknown;
  brandVoice?: unknown;
};

export function deriveBrandProfileSignals(
  profile: BrandProfileSignalSource | null,
  settingsBrandVoice?: string | null
) {
  const targetAudience =
    toStringOrNull(profile?.targetAudience) ??
    toStringOrNull(profile?.audience) ??
    toStringOrNull(profile?.target_audience) ??
    null;

  const niche =
    toStringOrNull(profile?.niche) ??
    toStringOrNull(profile?.category) ??
    toStringOrNull(profile?.industry) ??
    null;

  const brandVoice =
    settingsBrandVoice ??
    toStringOrNull(profile?.tone) ??
    toStringOrNull(profile?.brandVoice) ??
    null;

  return {
    targetAudience,
    niche,
    brandVoice,
  };
}

function toStringOrNull(value: unknown) {
  if (typeof value === "string" && value.trim()) {
    return value.trim();
  }

  return null;
}
