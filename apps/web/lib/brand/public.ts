/**
 * Remove secrets from a brand row before it goes to the browser: the
 * company's encrypted Apify key and any encrypted secret in a connection's
 * metadata (e.g. the Shopify webhook secret).
 */
export function publicBrand<T extends { apifyTokenEnc?: string | null; connections?: Array<{ metadata?: unknown }> }>(
  brand: T,
): Omit<T, "apifyTokenEnc"> {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { apifyTokenEnc, ...rest } = brand;
  if (!rest.connections) return rest;
  return {
    ...rest,
    connections: rest.connections.map((connection) => {
      const metadata = connection.metadata;
      if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) return connection;
      const safe = Object.fromEntries(Object.entries(metadata).filter(([key]) => !/Enc$|secret/i.test(key)));
      return { ...connection, metadata: safe };
    }),
  };
}
