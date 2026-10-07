"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { InstagramHandleLink } from "@/components/instagram-handle-link";
import { StackedList, StackedRow, TAP_TARGET, WideOnly } from "@/components/responsive-table";
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
  pageSize: number;
  setPageSize: (size: number) => void;
  onAddToCampaign: (creatorId: string) => void;
};

export const PAGE_SIZES = [25, 50, 100] as const;

type ColumnKey = "creator" | "email" | "followers" | "views" | "category" | "source" | "campaigns" | "actions";

/** Columns that only show on wide screens, so the table fits without scrolling sideways. */
const WIDE_ONLY = "hidden xl:table-cell";

const COLUMNS: { key: ColumnKey; label: string; className?: string }[] = [
  { key: "creator", label: "Creator" },
  { key: "email", label: "Email" },
  { key: "followers", label: "Followers" },
  { key: "views", label: "Average views", className: WIDE_ONLY },
  { key: "category", label: "Category", className: WIDE_ONLY },
  { key: "source", label: "Found through", className: "hidden lg:table-cell" },
  { key: "campaigns", label: "Campaigns" },
  { key: "actions", label: "" },
];

/** The actions column stays in view on the right if the table still has to scroll. */
const STICKY_ACTIONS =
  "sticky right-0 z-10 bg-card shadow-[-8px_0_8px_-8px_rgb(0_0_0/0.12)]";

/** Hide a column when nobody on this page has a value for it: a column of dots says nothing. */
function visibleColumns(creators: Creator[]) {
  const hidden = new Set<ColumnKey>();
  if (creators.length > 0) {
    if (creators.every((c) => c.followerCount == null)) hidden.add("followers");
    if (creators.every((c) => c.avgViews == null)) hidden.add("views");
    if (creators.every((c) => !c.bioCategory)) hidden.add("category");
  }
  return COLUMNS.filter((col) => !hidden.has(col.key));
}

function Unknown({ label }: { label: string }) {
  return (
    <span className="text-muted-foreground/70" aria-label={label}>
      ·
    </span>
  );
}

function CampaignBadges({ creator }: { creator: Creator }) {
  if (creator.campaignCreators.length === 0) {
    return <span className="text-muted-foreground">Not in one yet</span>;
  }
  return (
    <div className="flex flex-wrap gap-1">
      {creator.campaignCreators.map((cc) => (
        <Badge key={cc.id} variant="secondary" className="max-w-[14rem] text-sm font-normal" title={cc.campaign.name}>
          <span className="truncate">{cc.campaign.name}</span>
        </Badge>
      ))}
    </div>
  );
}

function CreatorName({ creator }: { creator: Creator }) {
  const instagramProfile = creator.profiles.find((profile) => profile.platform === "instagram");
  const showName = creator.name && creator.name !== creator.instagramHandle;
  return (
    <>
      {showName ? (
        <Link href={`/creators/${creator.id}`} className="block font-medium hover:underline">
          {creator.name}
        </Link>
      ) : null}
      <InstagramHandleLink
        handle={creator.instagramHandle}
        url={instagramProfile?.url}
        className="text-blue-700 hover:underline"
      />
    </>
  );
}

function Cell({ column, creator }: { column: ColumnKey; creator: Creator }) {
  switch (column) {
    case "creator":
      return <CreatorName creator={creator} />;
    case "email":
      return creator.email ? (
        <span className="block max-w-[13rem] truncate" title={creator.email}>
          {creator.email}
        </span>
      ) : (
        <span className="whitespace-nowrap text-muted-foreground">No email yet</span>
      );
    case "followers":
      return creator.followerCount != null ? <>{creator.followerCount.toLocaleString()}</> : <Unknown label="Unknown" />;
    case "views":
      return creator.avgViews != null ? <>{creator.avgViews.toLocaleString()}</> : <Unknown label="Unknown" />;
    case "category":
      return creator.bioCategory ? (
        <span className="block max-w-[10rem] truncate" title={creator.bioCategory}>
          {creator.bioCategory}
        </span>
      ) : (
        <Unknown label="None" />
      );
    case "source":
      return <>{sourceLabel(creator.discoverySource)}</>;
    case "campaigns":
      return <CampaignBadges creator={creator} />;
    case "actions":
      return null;
    default: {
      const unhandled: never = column;
      return unhandled;
    }
  }
}

const CELL_CLASS: Partial<Record<ColumnKey, string>> = {
  followers: "whitespace-nowrap tabular-nums",
  views: "whitespace-nowrap tabular-nums",
  source: "whitespace-nowrap",
};

export function CreatorsTable({
  creators,
  loading,
  total,
  page,
  totalPages,
  setPage,
  pageSize,
  setPageSize,
  onAddToCampaign,
}: TableProps) {
  const router = useRouter();
  const showSkeleton = loading && creators.length === 0;
  const columns = visibleColumns(creators);

  const actions = (creator: Creator, className?: string) => (
    <div className={cn("flex gap-2", className)}>
      <Button variant="ghost" className={TAP_TARGET} onClick={() => router.push(`/creators/${creator.id}`)}>
        Open
      </Button>
      <Button
        variant="outline"
        className={cn("whitespace-nowrap", TAP_TARGET)}
        onClick={() => onAddToCampaign(creator.id)}
      >
        Add to campaign
      </Button>
    </div>
  );

  return (
    <section className="min-w-0 rounded-xl border bg-card">
      <div className="flex flex-wrap items-baseline justify-between gap-2 border-b px-4 py-4 sm:px-5">
        <h2 className="font-semibold">
          {showSkeleton ? "Your creators" : `${total.toLocaleString()} ${total === 1 ? "creator" : "creators"}`}
        </h2>
        {columns.some((col) => col.key === "views") && (
          <p className="hidden text-sm text-muted-foreground xl:block">Average views come from their latest 12 reels.</p>
        )}
      </div>

      {creators.length === 0 && !loading ? (
        <div className="space-y-3 px-5 py-10 text-center">
          <p className="font-medium">No creators to show</p>
          <p className="text-sm text-muted-foreground">
            If you set filters above, clear them. Otherwise find creators or import a list you already have.
          </p>
          <div className="flex flex-wrap justify-center gap-2">
            <Button onClick={() => router.push("/creators?find=1")}>Find creators</Button>
            <Button variant="outline" onClick={() => router.push("/creators/import")}>
              Import a list
            </Button>
          </div>
        </div>
      ) : (
        <>
          {/* Phones: one stacked card per creator. */}
          <StackedList label="Creators" className="px-4 py-4" aria-busy={loading}>
            {showSkeleton
              ? Array.from({ length: 4 }, (_, i) => (
                  <StackedRow key={i}>
                    <Skeleton className="h-4 w-32" />
                    <Skeleton className="h-4 w-48" />
                  </StackedRow>
                ))
              : creators.map((creator) => (
                  <StackedRow key={creator.id} className="space-y-3">
                    <div className="min-w-0">
                      <CreatorName creator={creator} />
                    </div>
                    <div className="min-w-0 text-sm">
                      {creator.email ? (
                        <span className="block truncate" title={creator.email}>
                          {creator.email}
                        </span>
                      ) : (
                        <span className="text-muted-foreground">No email yet</span>
                      )}
                    </div>
                    <div className="text-sm">
                      <CampaignBadges creator={creator} />
                    </div>
                    {actions(creator, "[&>*]:flex-1")}
                  </StackedRow>
                ))}
          </StackedList>

          {/* md and up: the table. */}
          <WideOnly className="w-0 min-w-full overflow-x-auto" aria-busy={loading}>
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-muted-foreground">
                  {columns.map((col) => (
                    <th
                      key={col.key}
                      scope="col"
                      className={cn(
                        "whitespace-nowrap px-4 py-3 font-medium first:pl-5 last:pr-5",
                        col.className,
                        col.key === "actions" && STICKY_ACTIONS,
                      )}
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
                        {columns.map((col) => (
                          <td key={col.key} className={cn("px-4 py-3 first:pl-5 last:pr-5", col.className)}>
                            <Skeleton className="h-4 w-20" />
                          </td>
                        ))}
                      </tr>
                    ))
                  : creators.map((creator) => (
                      <tr key={creator.id} className="align-top">
                        {columns.map((col) =>
                          col.key === "actions" ? (
                            <td key={col.key} className={cn("px-4 py-3 pr-5", STICKY_ACTIONS)}>
                              {actions(creator, "justify-end")}
                            </td>
                          ) : (
                            <td
                              key={col.key}
                              className={cn("px-4 py-3 first:pl-5", CELL_CLASS[col.key], col.className)}
                            >
                              <Cell column={col.key} creator={creator} />
                            </td>
                          ),
                        )}
                      </tr>
                    ))}
              </tbody>
            </table>
          </WideOnly>
        </>
      )}

      {total > PAGE_SIZES[0] && (
        <nav
          aria-label="Pages"
          className="flex flex-wrap items-center justify-between gap-3 border-t px-4 py-3 sm:px-5"
        >
          <div className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
            {totalPages > 1 && (
              <p>
                Page {page} of {totalPages}
              </p>
            )}
            <label className="flex items-center gap-2">
              Show
              <select
                value={pageSize}
                onChange={(e) => setPageSize(Number(e.target.value))}
                className={cn("rounded-md border bg-background px-2 text-sm text-foreground", TAP_TARGET)}
              >
                {PAGE_SIZES.map((size) => (
                  <option key={size} value={size}>
                    {size}
                  </option>
                ))}
              </select>
              per page
            </label>
          </div>
          {totalPages > 1 && (
            <div className="flex gap-2">
              <Button variant="outline" className={TAP_TARGET} disabled={page <= 1} onClick={() => setPage(page - 1)}>
                Previous
              </Button>
              <Button
                variant="outline"
                className={TAP_TARGET}
                disabled={page >= totalPages}
                onClick={() => setPage(page + 1)}
              >
                Next
              </Button>
            </div>
          )}
        </nav>
      )}
    </section>
  );
}
