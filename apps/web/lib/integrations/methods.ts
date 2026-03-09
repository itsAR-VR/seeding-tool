export const integrationProviders = [
  "gmail",
  "instagram",
  "shopify",
  "unipile",
] as const;

export type IntegrationProvider = (typeof integrationProviders)[number];

export const integrationMethods = ["oauth", "manual"] as const;
export type IntegrationMethod = (typeof integrationMethods)[number];

export const providerCredentialTypes = [
  "oauth_refresh_token",
  "oauth_access_token",
  "api_key",
  "shopify_admin_token",
] as const;

export type ProviderCredentialType = (typeof providerCredentialTypes)[number];

export type ConnectionOverviewItem = {
  provider: IntegrationProvider;
  label: string;
  description: string;
  connected: boolean;
  status: string;
  availableMethods: readonly IntegrationMethod[];
  activeMethod: IntegrationMethod;
  credentialConfigured: boolean;
  externalId?: string | null;
  summary?: string;
  details?: {
    gmailAddress?: string | null;
    instagramUsername?: string | null;
    storeDomain?: string | null;
    accountId?: string | null;
    lastSyncAt?: string | null;
    lastSyncError?: string | null;
    lastSyncedCount?: number | null;
    truncated?: boolean;
  };
};

export type ConnectionsOverviewResponse = {
  brand: {
    id: string;
    name: string;
  };
  providers: ConnectionOverviewItem[];
};

type ProviderCapability = {
  label: string;
  description: string;
  methods: readonly IntegrationMethod[];
  defaultMethod: IntegrationMethod;
};

export const providerCapabilities: Record<IntegrationProvider, ProviderCapability> = {
  gmail: {
    label: "Gmail",
    description: "Send outreach emails through your Gmail account.",
    methods: ["oauth"],
    defaultMethod: "oauth",
  },
  instagram: {
    label: "Instagram",
    description: "Monitor tagged posts and mentions from Instagram creators.",
    methods: ["oauth"],
    defaultMethod: "oauth",
  },
  shopify: {
    label: "Shopify",
    description: "Automate product seeding and order fulfillment.",
    methods: ["oauth", "manual"],
    defaultMethod: "manual",
  },
  unipile: {
    label: "Unipile",
    description: "Send Instagram DMs through Unipile.",
    methods: ["manual"],
    defaultMethod: "manual",
  },
};

const allowedCredentialTypesByMethod: Record<
  IntegrationProvider,
  Record<IntegrationMethod, readonly ProviderCredentialType[]>
> = {
  gmail: {
    oauth: ["oauth_refresh_token"],
    manual: [],
  },
  instagram: {
    oauth: ["oauth_access_token"],
    manual: [],
  },
  shopify: {
    oauth: ["oauth_access_token"],
    manual: ["shopify_admin_token"],
  },
  unipile: {
    oauth: [],
    manual: ["api_key"],
  },
};

export function isIntegrationProvider(value: string): value is IntegrationProvider {
  return integrationProviders.includes(value as IntegrationProvider);
}

export function isIntegrationMethod(value: string): value is IntegrationMethod {
  return integrationMethods.includes(value as IntegrationMethod);
}

export function isProviderCredentialType(
  value: string
): value is ProviderCredentialType {
  return providerCredentialTypes.includes(value as ProviderCredentialType);
}

export function getProviderCapability(provider: IntegrationProvider) {
  return providerCapabilities[provider];
}

export function getDefaultConnectionMethod(
  provider: IntegrationProvider
): IntegrationMethod {
  return providerCapabilities[provider].defaultMethod;
}

export function getSupportedMethods(
  provider: IntegrationProvider
): readonly IntegrationMethod[] {
  return providerCapabilities[provider].methods;
}

export function supportsMethod(
  provider: IntegrationProvider,
  method: IntegrationMethod
) {
  return providerCapabilities[provider].methods.includes(method);
}

export function getAllowedCredentialTypes(
  provider: IntegrationProvider,
  method: IntegrationMethod
): readonly ProviderCredentialType[] {
  return allowedCredentialTypesByMethod[provider][method];
}
