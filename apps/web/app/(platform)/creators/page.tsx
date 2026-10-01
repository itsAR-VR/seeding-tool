"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { useCreatorsState } from "./hooks/use-creators-state";
import { CreatorFilters } from "./components/creator-filters";
import { CreatorsTable } from "./components/creators-table";
import { CampaignModal, SearchModal } from "./components/creator-modals";

function CreatorsContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const state = useCreatorsState();
  const [notice, setNotice] = useState<{ ok: boolean; text: string } | null>(null);
  const missingEmail = state.creators.filter((c) => !c.email);
  const { resetSearchState, setShowSearchModal } = state;

  // "Find creators" in the menu opens the search straight away.
  const openFind = searchParams.get("find") === "1";
  const openedFind = useRef(false);
  useEffect(() => {
    if (!openFind) {
      openedFind.current = false;
      return;
    }
    if (openedFind.current) return;
    openedFind.current = true;
    resetSearchState();
    setShowSearchModal(true);
    router.replace("/creators");
  }, [openFind, resetSearchState, setShowSearchModal, router]);

  async function findMissingEmails() {
    if (missingEmail.length === 0) return;
    state.setEnriching(true);
    setNotice(null);
    try {
      const res = await fetch("/api/creators/enrich", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ creatorIds: missingEmail.map((c) => c.id) }),
      });
      const data = await res.json();
      if (!res.ok) {
        setNotice({ ok: false, text: data.error || "Couldn't look up emails. Try again." });
      } else {
        setNotice({
          ok: true,
          text: `Found ${data.enriched} ${data.enriched === 1 ? "email" : "emails"}. ${data.notFound} ${data.notFound === 1 ? "creator has" : "creators have"} no public email.`,
        });
        state.fetchCreators();
      }
    } catch {
      setNotice({ ok: false, text: "Couldn't look up emails. Check your connection and try again." });
    } finally {
      state.setEnriching(false);
    }
  }

  const job = state.activeSearchJob;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Creators</h1>
          <p className="text-muted-foreground">
            Everyone you&apos;ve found or imported{state.total > 0 ? `: ${state.total} creators` : ""}.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            onClick={() => {
              state.resetSearchState();
              state.setShowSearchModal(true);
            }}
          >
            Find creators
          </Button>
          <Button variant="outline" onClick={() => router.push("/creators/import")}>
            Import a list
          </Button>
          <Button
            variant="outline"
            disabled={state.enriching || missingEmail.length === 0}
            onClick={() => void findMissingEmails()}
          >
            {state.enriching ? "Looking up emails..." : `Find missing emails (${missingEmail.length})`}
          </Button>
          <Button variant="ghost" onClick={() => router.push("/creators/identity-review")}>
            Review duplicates
          </Button>
        </div>
      </div>

      {notice && (
        <p role="status" className={`text-sm ${notice.ok ? "text-green-800" : "text-destructive"}`}>
          {notice.text}
        </p>
      )}

      {job ? (
        <section className="space-y-3 rounded-xl border bg-card p-5" aria-live="polite">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="font-medium">
                {job.status === "failed"
                  ? "The search stopped"
                  : job.status === "completed"
                    ? `Search finished: ${job.resultCount ?? 0} creators found`
                    : "Finding creators..."}
              </p>
              <p className="text-sm text-muted-foreground">
                {job.status === "failed"
                  ? job.error ?? "Something went wrong. Try a smaller search."
                  : job.status === "completed"
                    ? "Pick the ones you want to keep."
                    : `${job.resultCount ?? 0} found so far. You can keep working while this runs.`}
              </p>
            </div>
            <div className="flex gap-2">
              {state.searchResults.length > 0 ? (
                <Button size="sm" onClick={() => state.setShowSearchModal(true)}>
                  See results
                </Button>
              ) : null}
              <Button size="sm" variant="ghost" onClick={state.resetSearchState}>
                Dismiss
              </Button>
            </div>
          </div>
          {job.status !== "failed" && job.status !== "completed" && (
            <div className="h-1.5 overflow-hidden rounded-full bg-muted">
              <div
                className="h-full rounded-full bg-foreground/70 transition-[width] duration-500 motion-reduce:transition-none"
                style={{ width: `${Math.max(job.progressPercent ?? 0, 5)}%` }}
              />
            </div>
          )}
        </section>
      ) : null}

      <CreatorFilters
        search={state.search}
        setSearch={state.setSearch}
        minFollowers={state.minFollowers}
        setMinFollowers={state.setMinFollowers}
        maxFollowers={state.maxFollowers}
        setMaxFollowers={state.setMaxFollowers}
        minViews={state.minViews}
        setMinViews={state.setMinViews}
        maxViews={state.maxViews}
        setMaxViews={state.setMaxViews}
        category={state.category}
        setCategory={state.setCategory}
        source={state.source}
        setSource={state.setSource}
        setPage={state.setPage}
        facets={state.facets}
      />

      <CreatorsTable
        creators={state.creators}
        loading={state.loading}
        total={state.total}
        page={state.page}
        totalPages={state.totalPages}
        setPage={state.setPage}
        onAddToCampaign={state.handleAddToCampaign}
      />

      {state.showCampaignModal && (
        <CampaignModal
          campaigns={state.campaigns}
          selectedCampaignId={state.selectedCampaignId}
          setSelectedCampaignId={state.setSelectedCampaignId}
          addingToCampaign={state.addingToCampaign}
          onConfirm={state.confirmAddToCampaign}
          onClose={() => state.setShowCampaignModal(false)}
        />
      )}

      {state.showSearchModal && (
        <SearchModal
          searchResults={state.searchResults}
          searching={state.searching}
          searchStatus={state.searchStatus}
          selectedResults={state.selectedResults}
          importing={state.importing}
          searchSources={state.searchSources}
          setSearchSources={state.setSearchSources}
          searchCategoriesLoading={state.searchCategoriesLoading}
          keywordGroups={state.keywordGroups}
          selectedKeywords={state.selectedKeywords}
          setSelectedKeywords={state.setSelectedKeywords}
          searchLocation={state.searchLocation}
          setSearchLocation={state.setSearchLocation}
          locationSuggestions={state.locationSuggestions}
          searchUsernames={state.searchUsernames}
          setSearchUsernames={state.setSearchUsernames}
          usernameSuggestions={state.usernameSuggestions}
          searchMinFollowers={state.searchMinFollowers}
          setSearchMinFollowers={state.setSearchMinFollowers}
          searchMaxFollowers={state.searchMaxFollowers}
          setSearchMaxFollowers={state.setSearchMaxFollowers}
          searchLimit={state.searchLimit}
          setSearchLimit={state.setSearchLimit}
          searchLimitValidation={state.searchLimitValidation}
          searchLimitWarning={state.searchLimitWarning}
          onStartSearch={state.startSearch}
          onToggleResult={state.toggleResultSelection}
          onToggleAll={state.toggleAllResults}
          onImportSelected={state.importSelected}
          onClose={() => {
            state.setShowSearchModal(false);
            state.resetSearchState();
          }}
          onNewSearch={state.clearSearchResults}
        />
      )}
    </div>
  );
}

export default function CreatorsPage() {
  return (
    <Suspense fallback={<p className="text-muted-foreground">Loading...</p>}>
      <CreatorsContent />
    </Suspense>
  );
}
