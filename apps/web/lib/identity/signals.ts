function normalizeText(value: string | null | undefined) {
  return value?.trim().toLowerCase() ?? "";
}

function tokenize(value: string | null | undefined) {
  return normalizeText(value)
    .replace(/[^a-z0-9]+/g, " ")
    .split(" ")
    .filter(Boolean);
}

function overlapScore(a: string[], b: string[]) {
  if (a.length === 0 || b.length === 0) {
    return 0;
  }

  const aSet = new Set(a);
  const bSet = new Set(b);
  let shared = 0;
  for (const token of aSet) {
    if (bSet.has(token)) {
      shared += 1;
    }
  }

  return shared / Math.max(aSet.size, bSet.size);
}

function normalizeDomain(value: string | null | undefined) {
  if (!value) {
    return null;
  }

  try {
    const url = value.includes("://") ? new URL(value) : new URL(`https://${value}`);
    return url.hostname.replace(/^www\./, "").toLowerCase();
  } catch {
    return value.replace(/^@/, "").toLowerCase();
  }
}

export type IdentitySignal = {
  signal: string;
  value: number;
  weight: number;
};

export function computeHandleMatchSignal(
  a: string,
  b: string,
  platformA: string,
  platformB: string
): IdentitySignal {
  const value = normalizeText(a) === normalizeText(b) ? 1 : 0;
  return {
    signal: platformA === platformB ? "handle_exact_same_platform" : "handle_exact_cross_platform",
    value,
    weight: 0.25,
  };
}

export function computeNameSimilaritySignal(
  nameA: string | null,
  nameB: string | null
): IdentitySignal {
  return {
    signal: "name_similarity",
    value: overlapScore(tokenize(nameA), tokenize(nameB)),
    weight: 0.15,
  };
}

export function computeWebsiteOverlapSignal(
  urlA: string | null,
  urlB: string | null
): IdentitySignal {
  const domainA = normalizeDomain(urlA);
  const domainB = normalizeDomain(urlB);
  return {
    signal: "website_overlap",
    value: domainA && domainB && domainA === domainB ? 1 : 0,
    weight: 0.2,
  };
}

export function computeEmailDomainSignal(
  emailA: string | null,
  emailB: string | null
): IdentitySignal {
  const domainA = normalizeDomain(emailA?.split("@")[1] ?? null);
  const domainB = normalizeDomain(emailB?.split("@")[1] ?? null);
  return {
    signal: "email_domain",
    value: domainA && domainB && domainA === domainB ? 1 : 0,
    weight: 0.15,
  };
}

export function computeLocationSignal(
  regionA: string | null,
  regionB: string | null
): IdentitySignal {
  return {
    signal: "location_overlap",
    value: normalizeText(regionA) && normalizeText(regionA) === normalizeText(regionB) ? 1 : 0,
    weight: 0.05,
  };
}

export function computeBioSimilaritySignal(
  bioA: string | null,
  bioB: string | null
): IdentitySignal {
  return {
    signal: "bio_similarity",
    value: overlapScore(tokenize(bioA), tokenize(bioB)),
    weight: 0.1,
  };
}
