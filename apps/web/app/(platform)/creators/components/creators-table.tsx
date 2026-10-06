"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { InstagramHandleLink } from "@/components/instagram-handle-link";
import type { Creator } from "../hooks/use-creators-state";
import { sourceLabel } from "./creator-filters";
import { cn } from "@/lib/utils";

type TableProps = {
  creators: Creator[];
  loading: boolean;
  total: number;
  page: number;
  totalPages: number;
  setPage: (page: number) => void;
  onAddToCampaign: (creatorId: string) => void;
};

/** Columns that only show on wide screens, so the table fits without scrolling sideways. */
const WIDE_ONLY = "hidden xl:table-cell";

const COLUMNS: { label: string; className?: string }[] = [
  { label: "Creator" },
  { label: "Email" },
  { label: "Followers" },
  { label: "Average views", className: WIDE_ONLY },
  { label: "Category", className: WIDE_ONLY },
  { label: "Found through", className: "hidden lg:table-cell" },
  { label: "Campaigns" },
  { label: "" },
];

export function CreatorsTable({
  creators,
  loading,
  total,
  page,
  totalPages,
  setPage,
  onAddToCampaign,
}: TableProps) {
  const router = useRouter();
  const showSkeleton = loading && creators.length === 0;

  return (
    <section className="min-w-0 rounded-xl border bg-card">
      <div className="flex flex-wrap items-baseline justify-between gap-2 border-b px-5 py-4">
        <h2 className="font-semibold">
          {showSkeleton ? "Your creators" : `${total.toLocaleString()} ${total === 1 ? "creator" : "creators"}`}
        </h2>
        <p className="hidden text-sm text-muted-foreground xl:block">
          Average views come from their latest 12 reels.
        </p>
      </div>

      {creators.length === 0 && !loading ? (
        <div className="space-y-3 px-5 py-10 text-center">
          <p className="font-medium">No creators to show</p>
          <p className="text-sm text-muted-foreground">
            If you set filters above, clear them. Otherwise find creators or import a list you already have.
          </p>
          <div className="flex flex-wrap justify-center gap-2">
            <Button onClick={() => router.push("/creators?find=1")}>
              Find creators
            </Button>
            <Button variant="outline" onClick={() => router.push("/creators/import")}>
              Import a list
            </Button>
          </div>
        </div>
      ) : (
        <div className="w-0 min-w-full overflow-x-auto" aria-busy={loading}>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left text-muted-foreground">
                {COLUMNS.map((col, i) => (
                  <th
                    key={col.label || i}
                    scope="col"
                    className={cn("relative whitespace-nowrap px-4 py-3 font-medium first:pl-5 last:pr-5", col.className)}
                  >
                    {col.label || <span className="sr-only">Actions</span>}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y">
              {showSkeleton
                ? Array.from({ length: 6 }, (_, i) => (
                    <tr key={i}>
                      {COLUMNS.map((col, j) => (
                        <td key={col.label || j} className={cn("px-4 py-3 first:pl-5 last:pr-5", col.className)}>
                          <Skeleton className="h-4 w-20" />
                        </td>
                      ))}
                    </tr>
                  ))
                : creators.map((creator) => {
                    const instagramProfile = creator.profiles.find(
                      (profile) => profile.platform === "instagram"
                    );
                    const showName = creator.name && creator.name !== creator.instagramHandle;

                    return (
                      <tr key={creator.id} className="align-top">
                        <td className="px-4 py-3 pl-5">
                          {showName ? (
                            <Link
                              href={`/creators/${creator.id}`}
                              className="block font-medium hover:underline"
                            >
                              {creator.name}
                            </Link>
                          ) : null}
                          <InstagramHandleLink
                            handle={creator.instagramHandle}
                            url={instagramProfile?.url}
                            className="text-blue-700 hover:underline"
                          />
                        </td>
                        <td className="px-4 py-3">
                          {creator.email ? (
                            <span className="block max-w-[14rem] truncate" title={creator.email}>{creator.email}</span>
                          ) : (
                            <span className="text-muted-foreground">No email yet</span>
                          )}
                        </td>
                        <td className="whitespace-nowrap px-4 py-3 tabular-nums">
                          {creator.followerCount?.toLocaleString() ?? (
                            <span className="text-muted-foreground">Unknown</span>
                          )}
                        </td>
                        <td className={cn("whitespace-nowrap px-4 py-3 tabular-nums", WIDE_ONLY)}>
                          {creator.avgViews?.toLocaleString() ?? (
                            <span className="text-muted-foreground">Unknown</span>
                          )}
                        </td>
                        <td className={cn("px-4 py-3", WIDE_ONLY)}>
                          {creator.bioCategory || <span className="text-muted-foreground">None</span>}
                        </td>
                        <td className="hidden whitespace-nowrap px-4 py-3 lg:table-cell">
                          {sourceLabel(creator.discoverySource)}
                        </td>
                        <td className="px-4 py-3">
                          {creator.campaignCreators.length > 0 ? (
                            <div className="flex flex-wrap gap-1">
                              {creator.campaignCreators.map((cc) => (
                                <Badge key={cc.id} variant="secondary" className="text-sm font-normal">
                                  {cc.campaign.name}
                                </Badge>
                              ))}
                            </div>
                          ) : (
                            <span className="text-muted-foreground">Not in one yet</span>
                          )}
                        </td>
                        <td className="px-4 py-3 pr-5">
                          <div className="flex justify-end gap-2">
                            <Button
                             
                              variant="ghost"
                              onClick={() => router.push(`/creators/${creator.id}`)}
                            >
                              Open
                            </Button>
                            <Button
                             
                              variant="outline"
                              className="whitespace-nowrap"
                              onClick={() => onAddToCampaign(creator.id)}
                            >
                              Add to campaign
                            </Button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
            </tbody>
          </table>
        </div>
      )}

      {totalPages > 1 && (
        <nav aria-label="Pages" className="flex items-center justify-between border-t px-5 py-3">
          <p className="text-sm text-muted-foreground">
            Page {page} of {totalPages}
          </p>
          <div className="flex gap-2">
            <Button variant="outline" disabled={page <= 1} onClick={() => setPage(page - 1)}>
              Previous
            </Button>
            <Button
             
              variant="outline"
              disabled={page >= totalPages}
              onClick={() => setPage(page + 1)}
            >
              Next
            </Button>
          </div>
        </nav>
      )}
    </section>
  );
}
