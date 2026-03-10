"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
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
      if (!res.ok) throw new Error("Failed to load");
      const data = (await res.json()) as { products: CampaignProductData[] };
      setCampaignProducts(data.products);

      // Initialize selected IDs from existing campaign products
      const ids = new Set<string>();
      for (const cp of data.products) {
        if (cp.shopifyProductId) ids.add(cp.shopifyProductId);
      }
      setSelectedIds(ids);
    } catch {
      setError("Failed to load campaign products");
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
        throw new Error(data.error ?? "Failed to save");
      }

      const data = (await res.json()) as { products: CampaignProductData[] };
      setCampaignProducts(data.products);
      setDirty(false);
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
            <Link
              href={`/campaigns/${campaignId}`}
              className="hover:text-foreground"
            >
              ← Back to Campaign
            </Link>
          </div>
          <h1 className="text-2xl font-bold tracking-tight">
            Campaign Products
          </h1>
          <p className="text-muted-foreground">
            Select products from your Shopify catalog to include in this campaign.
            Selected products will be available as template variables in outreach messages.
          </p>
        </div>
        <div className="flex items-center gap-3">
          {saveSuccess && (
            <span className="text-sm text-green-600 font-medium">
              ✓ Saved
            </span>
          )}
          {dirty && (
            <Button
              onClick={handleSave}
              disabled={saving}
            >
              {saving ? "Saving…" : "Save Selection"}
            </Button>
          )}
        </div>
      </div>

      {error && (
        <div className="rounded-md bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {error}
        </div>
      )}

      {/* Currently selected products summary */}
      {campaignProducts.length > 0 && !dirty && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Selected Products</CardTitle>
            <CardDescription>
              These products are associated with this campaign and available as
              template variables: {"{{product_name}}"}, {"{{product_price}}"}, {"{{product_image}}"}
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
                      <Badge variant="outline" className="text-xs">
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
            <CardTitle className="text-base">Product Catalog</CardTitle>
            <CardDescription>
              Click products to select or deselect them for this campaign.
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
