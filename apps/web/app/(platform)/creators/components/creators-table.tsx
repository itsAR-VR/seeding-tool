"use client";

import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { InstagramHandleLink } from "@/components/instagram-handle-link";
import type { Creator } from "../hooks/use-creators-state";

type TableProps = {
  creators: Creator[];
  loading: boolean;
  total: number;
  page: number;
  totalPages: number;
  setPage: (page: number) => void;
  onAddToCampaign: (creatorId: string) => void;
};

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

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">
          {loading ? "Loading..." : `${total} Creators`}
        </CardTitle>
        <p className="text-xs text-muted-foreground">
          Avg Views means the average of the latest 12 reels/video posts when
          that enrichment has completed.
        </p>
      </CardHeader>
      <CardContent>
        {creators.length === 0 && !loading ? (
          <p className="text-sm text-muted-foreground py-8 text-center">
            No creators found. Try adjusting your filters or{" "}
            <button
              className="underline"
              onClick={() => router.push("/creators/import")}
            >
              import from CSV
            </button>
            .
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left">
                  <th className="pb-2 pr-4 font-medium">Handle</th>
                  <th className="pb-2 pr-4 font-medium">Email</th>
                  <th className="pb-2 pr-4 font-medium">Followers</th>
                  <th className="pb-2 pr-4 font-medium">Avg Views</th>
                  <th className="pb-2 pr-4 font-medium">Category</th>
                  <th className="pb-2 pr-4 font-medium">Source</th>
                  <th className="pb-2 pr-4 font-medium">Campaigns</th>
                  <th className="pb-2 font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {creators.map((creator) => {
                  const instagramProfile = creator.profiles.find(
                    (profile) => profile.platform === "instagram"
                  );

                  return (
                    <tr key={creator.id} className="border-b">
                      <td className="py-2 pr-4">
                        <div>
                          <InstagramHandleLink
                            handle={creator.instagramHandle}
                            url={instagramProfile?.url}
                            className="font-mono text-xs text-blue-600 hover:underline"
                          />
                          {creator.name &&
                            creator.name !== creator.instagramHandle && (
                              <p className="text-xs text-muted-foreground">
                                {creator.instagramHandle ? (
                                  <InstagramHandleLink
                                    handle={creator.instagramHandle}
                                    url={instagramProfile?.url}
                                    className="hover:text-foreground hover:underline"
                                  >
                                    {creator.name}
                                  </InstagramHandleLink>
                                ) : (
                                  creator.name
                                )}
                              </p>
                            )}
                        </div>
                      </td>
                      <td className="py-2 pr-4 text-xs">
                        {creator.email ? (
                          <span className="text-green-600">{creator.email}</span>
                        ) : (
                          <span className="text-muted-foreground">&mdash;</span>
                        )}
                      </td>
                      <td className="py-2 pr-4 text-xs">
                        {creator.followerCount?.toLocaleString() ?? "\u2014"}
                      </td>
                      <td className="py-2 pr-4 text-xs">
                        {creator.avgViews?.toLocaleString() ?? "\u2014"}
                      </td>
                      <td className="py-2 pr-4 text-xs">
                        {creator.bioCategory || "\u2014"}
                      </td>
                      <td className="py-2 pr-4">
                        <Badge variant="outline" className="text-xs">
                          {creator.discoverySource}
                        </Badge>
                      </td>
                      <td className="py-2 pr-4">
                        {creator.campaignCreators.length > 0 ? (
                          <div className="flex flex-wrap gap-1">
                            {creator.campaignCreators.map((cc) => (
                              <Badge
                                key={cc.id}
                                variant="secondary"
                                className="text-xs"
                              >
                                {cc.campaign.name}
                              </Badge>
                            ))}
                          </div>
                        ) : (
                          <span className="text-xs text-muted-foreground">
                            None
                          </span>
                        )}
                      </td>
                      <td className="py-2">
                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => router.push(`/creators/${creator.id}`)}
                          >
                            Explain
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => onAddToCampaign(creator.id)}
                          >
                            Add to Campaign
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

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="mt-4 flex items-center justify-between">
            <p className="text-xs text-muted-foreground">
              Page {page} of {totalPages}
            </p>
            <div className="flex gap-2">
              <Button
                size="sm"
                variant="outline"
                disabled={page <= 1}
                onClick={() => setPage(page - 1)}
              >
                Previous
              </Button>
              <Button
                size="sm"
                variant="outline"
                disabled={page >= totalPages}
                onClick={() => setPage(page + 1)}
              >
                Next
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
