"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ProductPicker } from "@/components/product-picker";

interface ShopifyProductData {
  id: string;
  title: string;
  imageUrl: string | null;
  variants: Array<{
    id: string;
    title: string;
    price: string;
  }>;
}

interface CampaignProductData {
  id: string;
  shopifyProductId: string | null;
  shopifyProduct: ShopifyProductData | null;
  product: { name: string };
}

export default function CampaignProductsPage() {
  const params = useParams<{ campaignId: string }>();
  const campaignId = params.campaignId;

  const [campaignProducts, setCampaignProducts] = useState<CampaignProductData[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saveSuccess, setSaveSuccess] = useState(false);

  const fetchCampaignProducts = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch(`/api/campaigns/${campaignId}/products`);
      if (!res.ok) throw new Error("Couldn't load products");
      const data = (await res.json()) as { products: CampaignProductData[] };
      setCampaignProducts(data.products);

      // Initialize selected IDs from existing campaign products
      const ids = new Set<string>();
      for (const cp of data.products) {
        if (cp.shopifyProductId) ids.add(cp.shopifyProductId);
      }
      setSelectedIds(ids);
    } catch {
      setError("Couldn't load this campaign's products. Refresh the page to try again.");
    } finally {
      setLoading(false);
    }
  }, [campaignId]);

  useEffect(() => {
    fetchCampaignProducts();
  }, [fetchCampaignProducts]);

  function handleSelectionChange(newIds: Set<string>) {
    setSelectedIds(newIds);
    setDirty(true);
    setSaveSuccess(false);
  }

  async function handleSave() {
    try {
      setSaving(true);
      setError(null);
      setSaveSuccess(false);

      const res = await fetch(`/api/campaigns/${campaignId}/products`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          shopifyProductIds: Array.from(selectedIds),
        }),
      });

      if (!res.ok) {
        const data = (await res.json()) as { error?: string };
        throw new Error(data.error ?? "Couldn't save your products. Try again.");
      }

      const data = (await res.json()) as { products: CampaignProductData[] };
      setCampaignProducts(data.products);
      setDirty(false);
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't save your products. Try again.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Products</h1>
          <p className="mt-1 text-muted-foreground">
            Pick the Shopify products you&apos;re gifting in this campaign. Their names and prices
            can go into your emails.
          </p>
        </div>
        <div className="flex items-center gap-3">
          {saveSuccess && (
            <span className="text-sm font-medium text-green-800">Saved</span>
          )}
          {dirty && (
            <Button
              onClick={handleSave}
              disabled={saving}
            >
              {saving ? "Saving…" : "Save products"}
            </Button>
          )}
        </div>
      </div>

      {error && (
        <div role="alert" className="rounded-xl border border-red-200 bg-red-50 px-5 py-4 text-sm text-red-800">
          {error}
        </div>
      )}

      {/* Currently selected products summary */}
      {campaignProducts.length > 0 && !dirty && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-lg">In this campaign</CardTitle>
            <CardDescription>
              Drafted emails mention these products by name.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-3">
              {campaignProducts.map((cp) => (
                <div
                  key={cp.id}
                  className="flex items-center gap-2 rounded-lg border bg-card px-3 py-2"
                >
                  {cp.shopifyProduct?.imageUrl && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={cp.shopifyProduct.imageUrl}
                      alt=""
                      className="h-8 w-8 rounded object-cover"
                    />
                  )}
                  <span className="text-sm font-medium">
                    {cp.shopifyProduct?.title || cp.product.name}
                  </span>
                  {cp.shopifyProduct?.variants &&
                    cp.shopifyProduct.variants.length > 0 && (
                      <Badge variant="outline" className="text-sm">
                        ${parseFloat(
                          cp.shopifyProduct.variants[0].price
                        ).toFixed(2)}
                      </Badge>
                    )}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Product Picker */}
      {!loading && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Your Shopify products</CardTitle>
            <CardDescription>
              Click a product to add it or take it out, then save.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ProductPicker
              campaignId={campaignId}
              selectedProductIds={selectedIds}
              onSelectionChange={handleSelectionChange}
            />
          </CardContent>
        </Card>
      )}
    </div>
  );
}
