"use client";

import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useCreatorsState } from "./hooks/use-creators-state";
import { CreatorFilters } from "./components/creator-filters";
import { CreatorsTable } from "./components/creators-table";
import { CampaignModal, SearchModal } from "./components/creator-modals";

export default function CreatorsPage() {
  const router = useRouter();
  const state = useCreatorsState();

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Creators</h1>
          <p className="text-muted-foreground">
            Search, filter, and manage your creator database.
            {state.total > 0 && ` ${state.total} creators total.`}
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={() => router.push("/creators/identity-review")}
          >
            Identity Review
          </Button>
          <Button
            variant="outline"
            onClick={() => {
              state.resetSearchState();
              state.setShowSearchModal(true);
            }}
          >
            Search Creators
          </Button>
          <Button onClick={() => router.push("/creators/import")}>
            Import CSV
          </Button>
          <Button
            variant="outline"
            disabled={state.enriching || state.creators.filter((c) => !c.email).length === 0}
            onClick={async () => {
              const withoutEmail = state.creators.filter((c) => !c.email);
              if (withoutEmail.length === 0) {
                alert("All visible creators already have emails.");
                return;
              }
              state.setEnriching(true);
              try {
                const res = await fetch("/api/creators/enrich", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({
                    creatorIds: withoutEmail.map((c) => c.id),
                  }),
                });
                const data = await res.json();
                if (!res.ok) {
                  alert(data.error || "Enrichment failed");
                } else {
                  alert(
                    `Enrichment complete: ${data.enriched} found, ${data.notFound} not found, ${data.alreadyHasEmail || 0} already had email, ${data.skipped} skipped`
                  );
                  state.fetchCreators();
                }
              } catch {
                alert("Enrichment request failed");
              } finally {
                state.setEnriching(false);
              }
            }}
          >
            {state.enriching ? "Enriching..." : `Enrich Emails (${state.creators.filter((c) => !c.email).length})`}
          </Button>
        </div>
      </div>

      {state.activeSearchJob ? (
        <Card className="border-blue-200 bg-blue-50">
          <CardContent className="space-y-3 pt-6">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-sm font-semibold text-blue-900">
                  Background creator search
                </p>
                <p className="text-xs text-blue-800">
                  Job {state.activeSearchJob.jobId} is running in the background. You
                  can keep using the platform while it completes.
                </p>
              </div>
              <div className="flex gap-2">
                {state.searchResults.length > 0 ? (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => state.setShowSearchModal(true)}
                  >
                    View Results
                  </Button>
                ) : null}
                <Button size="sm" variant="ghost" onClick={state.resetSearchState}>
                  Dismiss
                </Button>
              </div>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-white/70">
              <div
                className="h-full bg-blue-700 transition-all"
                style={{ width: `${state.activeSearchJob.progressPercent ?? 0}%` }}
              />
            </div>
            <div className="grid gap-2 text-xs text-blue-900 sm:grid-cols-3 lg:grid-cols-6">
              <span>Status: {state.activeSearchJob.status}</span>
              <span>Requested: {state.activeSearchJob.requestedCount ?? "\u2014"}</span>
              <span>Ready: {state.activeSearchJob.resultCount ?? 0}</span>
              <span>Validated: {state.activeSearchJob.validatedCount ?? 0}</span>
              <span>Invalid: {state.activeSearchJob.invalidCount ?? 0}</span>
              <span>
                ETA:{" "}
                {typeof state.activeSearchJob.etaSeconds === "number"
                  ? `${state.activeSearchJob.etaSeconds}s`
                  : "\u2014"}
              </span>
            </div>
            {state.activeSearchJob.error ? (
              <p className="text-xs text-red-700">{state.activeSearchJob.error}</p>
            ) : null}
          </CardContent>
        </Card>
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
          discoveryApprovalMode={state.discoveryApprovalMode}
          discoveryApprovalThreshold={state.discoveryApprovalThreshold}
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
