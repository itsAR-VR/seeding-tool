"use client";

import Link from "next/link";
import { useState, useEffect, useCallback } from "react";
import { Input } from "@/components/ui/input";
import { Button, buttonVariants } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

interface Variant {
  id: string;
  shopifyVariantId: string;
  title: string;
  price: string;
  sku: string | null;
  inventoryQuantity: number | null;
  imageUrl: string | null;
}

interface Product {
  id: string;
  shopifyId: string;
  title: string;
  description: string | null;
  handle: string | null;
  productType: string | null;
  imageUrl: string | null;
  status: string;
  variants: Variant[];
  syncedAt: string;
}

interface ProductPickerProps {
  selectedProductIds: Set<string>;
  onSelectionChange: (productIds: Set<string>) => void;
  /** Show/hide the sync CTA */
  showSyncButton?: boolean;
  campaignId?: string;
}

interface ShopifyStatus {
  connected: boolean;
  storeDomain?: string;
  lastSyncAt?: string | null;
  lastSyncError?: string | null;
  lastSyncedCount?: number | null;
  truncated?: boolean;
}

function normalizeErrorMessage(message: string) {
  if (message.includes("No valid Shopify credential found")) {
    return "Shopify is not connected for this brand yet.";
  }

  if (message.includes("No connected Shopify store found")) {
    return "Shopify is connected without a store domain. Reconnect it from Settings.";
  }

  return message;
}

export function ProductPicker({
  selectedProductIds,
  onSelectionChange,
  showSyncButton = true,
  campaignId,
}: ProductPickerProps) {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [statusLoading, setStatusLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [expandedProduct, setExpandedProduct] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [shopifyStatus, setShopifyStatus] = useState<ShopifyStatus>({
    connected: false,
  });
  const queryString = campaignId
    ? `?campaignId=${encodeURIComponent(campaignId)}`
    : "";

  const fetchStatus = useCallback(async () => {
    try {
      const res = await fetch(`/api/connections/shopify/status${queryString}`);
      if (res.ok) {
        setShopifyStatus((await res.json()) as ShopifyStatus);
      }
    } catch {
      // ignore
    } finally {
      setStatusLoading(false);
    }
  }, [queryString]);

  const fetchProducts = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await fetch(`/api/products/sync${queryString}`);
      if (!res.ok) {
        const data = (await res.json()) as { error?: string };
        throw new Error(
          normalizeErrorMessage(data.error ?? "Failed to fetch products")
        );
      }
      const data = (await res.json()) as { products: Product[] };
      setProducts(data.products);
    } catch (err) {
      setError(
        err instanceof Error ? normalizeErrorMessage(err.message) : "Failed to load products"
      );
    } finally {
      setLoading(false);
    }
  }, [queryString]);

  useEffect(() => {
    fetchProducts();
    fetchStatus();
  }, [fetchProducts, fetchStatus]);

  async function handleSync() {
    try {
      setSyncing(true);
      setError(null);
      const res = await fetch(`/api/products/sync${queryString}`, {
        method: "POST",
      });
      if (!res.ok) {
        const data = (await res.json()) as { error?: string };
        throw new Error(normalizeErrorMessage(data.error ?? "Sync failed"));
      }
      await fetchProducts();
      await fetchStatus();
    } catch (err) {
      setError(
        err instanceof Error ? normalizeErrorMessage(err.message) : "Sync failed"
      );
      await fetchStatus();
    } finally {
      setSyncing(false);
    }
  }

  function toggleProduct(productId: string) {
    const next = new Set(selectedProductIds);
    if (next.has(productId)) {
      next.delete(productId);
    } else {
      next.add(productId);
    }
    onSelectionChange(next);
  }

  const filtered = products.filter((p) =>
    p.title.toLowerCase().includes(search.toLowerCase()) ||
    (p.productType?.toLowerCase().includes(search.toLowerCase()) ?? false)
  );

  function priceRange(variants: Variant[]): string {
    if (variants.length === 0) return "N/A";
    const prices = variants.map((v) => parseFloat(v.price)).filter((p) => !isNaN(p));
    if (prices.length === 0) return "N/A";
    const min = Math.min(...prices);
    const max = Math.max(...prices);
    if (min === max) return `$${min.toFixed(2)}`;
    return `$${min.toFixed(2)} – $${max.toFixed(2)}`;
  }

  function variantSummary(variants: Variant[]): string {
    if (variants.length <= 1) return "";
    // Group by option type — simplify "Default Title" variants
    const titles = variants
      .map((v) => v.title)
      .filter((t) => t !== "Default Title");
    if (titles.length === 0) return "";
    return `${titles.length} option${titles.length !== 1 ? "s" : ""}`;
  }

  // Loading skeleton
  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-10 w-full" />
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="space-y-3">
              <Skeleton className="aspect-square w-full rounded-lg" />
              <Skeleton className="h-4 w-3/4" />
              <Skeleton className="h-3 w-1/2" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (!loading && products.length === 0 && !error && !statusLoading && !shopifyStatus.connected) {
    return (
      <Card className="border-dashed">
        <CardContent className="flex flex-col items-center justify-center py-16">
          <div className="rounded-full bg-muted p-4 mb-4">
            <svg
              className="h-8 w-8 text-muted-foreground"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={1.5}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M3 7.5h18M6.75 3.75h10.5A2.25 2.25 0 0119.5 6v12A2.25 2.25 0 0117.25 20.25H6.75A2.25 2.25 0 014.5 18V6a2.25 2.25 0 012.25-2.25z"
              />
            </svg>
          </div>
          <h3 className="text-lg font-semibold">Shopify not connected</h3>
          <p className="mt-1 max-w-sm text-center text-sm text-muted-foreground">
            Connect your Shopify admin domain and access token before syncing
            products into this campaign.
          </p>
          {showSyncButton && (
            <Link
              href="/settings/connections"
              className={buttonVariants({ className: "mt-4" })}
            >
              Open Shopify settings
            </Link>
          )}
        </CardContent>
      </Card>
    );
  }

  // Empty state — no products synced
  if (products.length === 0 && !error) {
    return (
      <Card className="border-dashed">
        <CardContent className="flex flex-col items-center justify-center py-16">
          <div className="rounded-full bg-muted p-4 mb-4">
            <svg
              className="h-8 w-8 text-muted-foreground"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={1.5}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M20.25 7.5l-.625 10.632a2.25 2.25 0 01-2.247 2.118H6.622a2.25 2.25 0 01-2.247-2.118L3.75 7.5M10 11.25h4M3.375 7.5h17.25c.621 0 1.125-.504 1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125H3.375c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125z"
              />
            </svg>
          </div>
          <h3 className="text-lg font-semibold">No products synced</h3>
          <p className="mt-1 text-sm text-muted-foreground text-center max-w-sm">
            Sync your Shopify product catalog to select products for this campaign.
          </p>
          {showSyncButton && (
            <Button
              onClick={handleSync}
              disabled={syncing || !shopifyStatus.connected}
              className="mt-4"
            >
              {syncing ? (
                <>
                  <svg
                    className="mr-2 h-4 w-4 animate-spin"
                    viewBox="0 0 24 24"
                    fill="none"
                  >
                    <circle
                      className="opacity-25"
                      cx="12"
                      cy="12"
                      r="10"
                      stroke="currentColor"
                      strokeWidth="4"
                    />
                    <path
                      className="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                    />
                  </svg>
                  Syncing…
                </>
              ) : (
                "Sync Products from Shopify"
              )}
            </Button>
          )}
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {error && (
        <div className="flex items-center justify-between gap-3 rounded-md bg-destructive/10 px-4 py-3 text-sm text-destructive">
          <span>{error}</span>
          {showSyncButton && (
            shopifyStatus.connected ? (
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={handleSync}
                disabled={syncing}
              >
                {syncing ? "Retrying…" : "Retry sync"}
              </Button>
            ) : (
              <Link
                href="/settings/connections"
                className={buttonVariants({ size: "sm", variant: "outline" })}
              >
                Open Shopify settings
              </Link>
            )
          )}
        </div>
      )}

      {shopifyStatus.connected && (
        <div className="rounded-md border bg-muted/20 px-4 py-3 text-sm text-muted-foreground">
          <div className="flex flex-wrap items-center gap-2">
            <span>
              Store: <strong>{shopifyStatus.storeDomain ?? "Connected"}</strong>
            </span>
            {shopifyStatus.lastSyncAt && (
              <span>
                Last sync:{" "}
                <strong>
                  {new Date(shopifyStatus.lastSyncAt).toLocaleString()}
                </strong>
              </span>
            )}
            {typeof shopifyStatus.lastSyncedCount === "number" && (
              <span>{shopifyStatus.lastSyncedCount} products</span>
            )}
            {shopifyStatus.truncated && <span>Partial sync</span>}
          </div>
          {shopifyStatus.lastSyncError && (
            <p className="mt-2 text-red-700">
              Last sync failed: {shopifyStatus.lastSyncError}
            </p>
          )}
        </div>
      )}

      {/* Search + Sync controls */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1">
          <svg
            className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z"
            />
          </svg>
          <Input
            placeholder="Search products…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10"
          />
        </div>
        {showSyncButton && (
          <Button
            variant="outline"
            size="sm"
            onClick={handleSync}
            disabled={syncing || !shopifyStatus.connected}
          >
            {syncing ? "Syncing…" : "Re-sync"}
          </Button>
        )}
        {selectedProductIds.size > 0 && (
          <Badge variant="secondary">
            {selectedProductIds.size} selected
          </Badge>
        )}
      </div>

      {/* Product Grid */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
        {filtered.map((product) => {
          const isSelected = selectedProductIds.has(product.id);
          const isExpanded = expandedProduct === product.id;

          return (
            <div key={product.id} className="group">
              <Card
                className={`cursor-pointer overflow-hidden transition-all hover:shadow-md ${
                  isSelected
                    ? "ring-2 ring-primary shadow-md"
                    : "hover:ring-1 hover:ring-border"
                }`}
                onClick={() => toggleProduct(product.id)}
              >
                {/* Product Image */}
                <div className="relative aspect-square bg-muted">
                  {product.imageUrl ? (
                    <img
                      src={product.imageUrl}
                      alt={product.title}
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center">
                      <svg
                        className="h-12 w-12 text-muted-foreground/40"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                        strokeWidth={1}
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909M3.75 21h16.5A2.25 2.25 0 0022.5 18.75V5.25A2.25 2.25 0 0020.25 3H3.75A2.25 2.25 0 001.5 5.25v13.5A2.25 2.25 0 003.75 21z"
                        />
                      </svg>
                    </div>
                  )}

                  {/* Selection indicator */}
                  <div
                    className={`absolute top-2 right-2 flex h-6 w-6 items-center justify-center rounded-full border-2 transition-colors ${
                      isSelected
                        ? "border-primary bg-primary text-primary-foreground"
                        : "border-white/80 bg-white/60 text-transparent group-hover:border-gray-300"
                    }`}
                  >
                    {isSelected && (
                      <svg
                        className="h-3.5 w-3.5"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                        strokeWidth={3}
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          d="M4.5 12.75l6 6 9-13.5"
                        />
                      </svg>
                    )}
                  </div>

                  {/* Product type badge */}
                  {product.productType && (
                    <div className="absolute bottom-2 left-2">
                      <Badge
                        variant="secondary"
                        className="bg-black/60 text-white text-[10px] backdrop-blur-sm border-0"
                      >
                        {product.productType}
                      </Badge>
                    </div>
                  )}
                </div>

                <CardContent className="p-3">
                  <h3 className="font-medium text-sm leading-tight line-clamp-2">
                    {product.title}
                  </h3>
                  <div className="mt-1 flex items-center justify-between">
                    <span className="text-sm font-semibold text-foreground">
                      {priceRange(product.variants)}
                    </span>
                    {product.variants.length > 1 && (
                      <span className="text-xs text-muted-foreground">
                        {variantSummary(product.variants) ||
                          `${product.variants.length} variants`}
                      </span>
                    )}
                  </div>

                  {/* Expand variants */}
                  {product.variants.length > 1 && (
                    <button
                      type="button"
                      className="mt-2 text-xs text-primary hover:underline"
                      onClick={(e) => {
                        e.stopPropagation();
                        setExpandedProduct(isExpanded ? null : product.id);
                      }}
                    >
                      {isExpanded ? "Hide options" : "View options"}
                    </button>
                  )}

                  {/* Variant details */}
                  {isExpanded && (
                    <div className="mt-2 space-y-1.5 border-t pt-2">
                      {product.variants.map((v) => (
                        <div
                          key={v.id}
                          className="flex items-center justify-between text-xs"
                        >
                          <span className="text-muted-foreground truncate max-w-[60%]">
                            {v.title === "Default Title" ? "Standard" : v.title}
                          </span>
                          <div className="flex items-center gap-2">
                            <span className="font-medium">
                              ${parseFloat(v.price).toFixed(2)}
                            </span>
                            {v.inventoryQuantity !== null && (
                              <span
                                className={`${
                                  v.inventoryQuantity > 0
                                    ? "text-green-600"
                                    : "text-red-500"
                                }`}
                              >
                                {v.inventoryQuantity > 0
                                  ? `${v.inventoryQuantity} in stock`
                                  : "Out of stock"}
                              </span>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          );
        })}
      </div>

      {/* No search results */}
      {filtered.length === 0 && search && (
        <div className="py-12 text-center text-muted-foreground">
          <p className="text-sm">No products matching &ldquo;{search}&rdquo;</p>
          <button
            type="button"
            className="mt-2 text-sm text-primary hover:underline"
            onClick={() => setSearch("")}
          >
            Clear search
          </button>
        </div>
      )}
    </div>
  );
}
