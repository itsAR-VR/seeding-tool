import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  productUpsert: vi.fn(),
  productFindMany: vi.fn(),
  productDeleteMany: vi.fn(),
  variantUpsert: vi.fn(),
  variantFindMany: vi.fn(),
  variantDeleteMany: vi.fn(),
  getShopifyClient: vi.fn(),
  fetch: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    shopifyProduct: {
      upsert: mocks.productUpsert,
      findMany: mocks.productFindMany,
      deleteMany: mocks.productDeleteMany,
    },
    shopifyVariant: {
      upsert: mocks.variantUpsert,
      findMany: mocks.variantFindMany,
      deleteMany: mocks.variantDeleteMany,
    },
  },
}));

vi.mock("@/lib/shopify/client", () => ({
  getShopifyClient: mocks.getShopifyClient,
}));

function makeResponse(
  products: unknown[],
  nextUrl: string | null = null,
  ok = true,
) {
  return {
    ok,
    json: async () => ({ products }),
    text: async () => "request failed",
    headers: {
      get: (name: string) => {
        if (name.toLowerCase() !== "link" || !nextUrl) {
          return null;
        }
        return `<https://test-store.myshopify.com/admin/api/2024-01${nextUrl}>; rel="next"`;
      },
    },
  };
}

function makeProduct(id: number, overrides: Record<string, unknown> = {}) {
  return {
    id,
    title: `Product ${id}`,
    body_html: "<p>Great &amp; useful</p>",
    handle: `product-${id}`,
    product_type: "Skincare",
    status: "active",
    image: { src: `https://cdn.example.com/product-${id}.jpg` },
    images: [{ id: id * 10, src: `https://cdn.example.com/variant-${id}.jpg` }],
    variants: [
      {
        id: id * 100,
        title: "Default",
        price: "29.99",
        sku: `SKU-${id}`,
        inventory_quantity: 5,
        image_id: id * 10,
      },
    ],
    ...overrides,
  };
}

describe("shopify products", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getShopifyClient.mockResolvedValue({
      fetch: mocks.fetch,
    });
    mocks.productUpsert.mockImplementation(async ({ where }: { where: { brandId_shopifyId: { shopifyId: string } } }) => ({
      id: `db-${where.brandId_shopifyId.shopifyId}`,
      brandId: "brand-1",
      shopifyId: where.brandId_shopifyId.shopifyId,
    }));
    mocks.variantUpsert.mockResolvedValue({});
    mocks.variantFindMany.mockResolvedValue([]);
    mocks.productFindMany.mockResolvedValue([]);
  });

  it("syncs paginated products and upserts variants with cleaned descriptions", async () => {
    mocks.fetch
      .mockResolvedValueOnce(
        makeResponse([makeProduct(1)], "/products.json?page_info=abc&limit=250"),
      )
      .mockResolvedValueOnce(makeResponse([makeProduct(2)], null));

    const { syncProducts } = await import("@/lib/shopify/products");
    const result = await syncProducts("brand-1");

    expect(result).toEqual({ synced: 2, truncated: false });
    expect(mocks.fetch).toHaveBeenNthCalledWith(
      1,
      "/products.json?limit=250&status=active",
      expect.objectContaining({ signal: expect.any(AbortSignal) }),
    );
    expect(mocks.fetch).toHaveBeenNthCalledWith(
      2,
      "/products.json?page_info=abc&limit=250",
      expect.objectContaining({ signal: expect.any(AbortSignal) }),
    );

    expect(mocks.productUpsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({
          description: "Great & useful",
          imageUrl: "https://cdn.example.com/product-1.jpg",
          brandId: "brand-1",
        }),
      }),
    );
    expect(mocks.variantUpsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({
          shopifyVariantId: "100",
          imageUrl: "https://cdn.example.com/variant-1.jpg",
        }),
      }),
    );
  });

  it("deletes stale variants and stale products after a full sync", async () => {
    mocks.fetch.mockResolvedValueOnce(makeResponse([makeProduct(1)], null));
    mocks.variantFindMany.mockResolvedValue([
      { id: "variant-keep", shopifyVariantId: "100" },
      { id: "variant-stale", shopifyVariantId: "999" },
    ]);
    mocks.productFindMany.mockResolvedValue([
      { id: "db-1", shopifyId: "1" },
      { id: "db-stale", shopifyId: "999" },
    ]);

    const { syncProducts } = await import("@/lib/shopify/products");
    await syncProducts("brand-1");

    expect(mocks.variantDeleteMany).toHaveBeenCalledWith({
      where: { id: { in: ["variant-stale"] } },
    });
    expect(mocks.productDeleteMany).toHaveBeenCalledWith({
      where: { id: { in: ["db-stale"] } },
    });
  });

  it("flattens synced products for UI reads", async () => {
    mocks.productFindMany.mockResolvedValue([
      {
        id: "db-2",
        shopifyId: "2",
        title: "A Product",
        description: "Desc",
        handle: "a-product",
        productType: "Skincare",
        imageUrl: "https://cdn.example.com/product.jpg",
        status: "active",
        syncedAt: new Date("2026-04-10T00:00:00.000Z"),
        variants: [
          {
            id: "variant-2",
            shopifyVariantId: "200",
            title: "Size A",
            price: "12.00",
            sku: "SKU-2",
            inventoryQuantity: 9,
            imageUrl: "https://cdn.example.com/variant.jpg",
          },
        ],
      },
    ]);

    const { getProducts } = await import("@/lib/shopify/products");
    const products = await getProducts("brand-1");

    expect(mocks.productFindMany).toHaveBeenCalledWith({
      where: { brandId: "brand-1" },
      include: { variants: true },
      orderBy: { title: "asc" },
    });
    expect(products).toEqual([
      {
        id: "db-2",
        shopifyId: "2",
        title: "A Product",
        description: "Desc",
        handle: "a-product",
        productType: "Skincare",
        imageUrl: "https://cdn.example.com/product.jpg",
        status: "active",
        syncedAt: new Date("2026-04-10T00:00:00.000Z"),
        variants: [
          {
            id: "variant-2",
            shopifyVariantId: "200",
            title: "Size A",
            price: "12.00",
            sku: "SKU-2",
            inventoryQuantity: 9,
            imageUrl: "https://cdn.example.com/variant.jpg",
          },
        ],
      },
    ]);
  });
});
