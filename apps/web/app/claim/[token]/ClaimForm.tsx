"use client";

import { FormEvent, useState } from "react";
import { Button } from "@/components/ui/button";

type ClaimFormProps = {
  token: string;
  brandName: string;
  shipCountries: string[];
};

const COUNTRY_NAMES: Record<string, string> = {
  US: "United States",
  CA: "Canada",
  GB: "United Kingdom",
  AU: "Australia",
};

type SubmittedAddress = {
  fullName: string;
  line1: string;
  line2: string;
  city: string;
  state: string;
  postalCode: string;
  country: string;
};

function field(data: Record<string, FormDataEntryValue>, key: string): string {
  const value = data[key];
  return typeof value === "string" ? value.trim() : "";
}

const NETWORK_ERROR =
  "We couldn't send that. Check your connection and tap Submit again.";

export function ClaimForm({ token, brandName, shipCountries }: ClaimFormProps) {
  const [country, setCountry] = useState(shipCountries[0] ?? "US");
  const isUS = country === "US";
  const [status, setStatus] = useState<"idle" | "submitting" | "submitted">(
    "idle"
  );
  const [error, setError] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState<SubmittedAddress | null>(null);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setStatus("submitting");
    setError(null);

    const formData = new FormData(event.currentTarget);
    const payload = Object.fromEntries(formData.entries());

    let response: Response;
    try {
      response = await fetch(`/api/gift-claims/${token}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
    } catch {
      // Network failure: the form keeps everything typed, so they can just tap again.
      setError(NETWORK_ERROR);
      setStatus("idle");
      return;
    }

    if (!response.ok) {
      const body = (await response.json().catch(() => ({}))) as {
        error?: string;
      };
      setError(body.error ?? "We couldn't save your address. Please tap Submit again.");
      setStatus("idle");
      return;
    }

    setSubmitted({
      fullName: field(payload, "fullName"),
      line1: field(payload, "line1"),
      line2: field(payload, "line2"),
      city: field(payload, "city"),
      state: field(payload, "state"),
      postalCode: field(payload, "postalCode"),
      country: field(payload, "country"),
    });
    setStatus("submitted");
  }

  if (status === "submitted") {
    return (
      <div role="status" className="rounded-3xl border border-green-200 bg-green-50 p-6 text-green-950">
        <h2 className="text-xl font-semibold">Address submitted</h2>
        <p className="mt-2 text-sm leading-6">
          Thank you! We&apos;ll let you know when it ships. Here&apos;s what we&apos;ll ship to:
        </p>
        {submitted && (
          <address className="mt-3 rounded-2xl bg-card p-4 text-base not-italic leading-7 text-card-foreground">
            {submitted.fullName}
            <br />
            {submitted.line1}
            {submitted.line2 && (
              <>
                <br />
                {submitted.line2}
              </>
            )}
            <br />
            {submitted.city}, {submitted.country === "US" ? submitted.state.toUpperCase() : submitted.state}{" "}
            {submitted.postalCode}
            <br />
            {COUNTRY_NAMES[submitted.country] ?? submitted.country}
          </address>
        )}
        <p className="mt-3 text-sm leading-6">
          Spot a typo? Reply to the email with this link and tell {brandName} the right address. They&apos;ll fix it
          before it ships.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block text-sm font-medium">
          Full name
          <input
            name="fullName"
            autoComplete="name"
            required
            minLength={2}
            maxLength={120}
            className="mt-1 w-full rounded-xl border px-3 py-3 text-base"
          />
        </label>
        <label className="block text-sm font-medium">
          Email
          <input
            name="email"
            type="email"
            autoComplete="email"
            required
            maxLength={254}
            className="mt-1 w-full rounded-xl border px-3 py-3 text-base"
          />
        </label>
      </div>

      <label className="block text-sm font-medium">
        Phone number <span className="font-normal text-muted-foreground">(optional)</span>
        <input
          name="phone"
          type="tel"
          autoComplete="tel"
          maxLength={40}
          className="mt-1 w-full rounded-xl border px-3 py-3 text-base"
        />
      </label>

      {shipCountries.length > 1 ? (
        <label className="block text-sm font-medium">
          Country
          <select
            name="country"
            value={country}
            onChange={(e) => setCountry(e.target.value)}
            autoComplete="country"
            className="mt-1 w-full rounded-xl border border-input bg-background px-3 py-3 text-base"
          >
            {shipCountries.map((code) => (
              <option key={code} value={code}>
                {COUNTRY_NAMES[code] ?? code}
              </option>
            ))}
          </select>
        </label>
      ) : (
        <input type="hidden" name="country" value={country} />
      )}

      <label className="block text-sm font-medium">
        Street address
        <input
          name="line1"
          autoComplete="address-line1"
          required
          minLength={3}
          maxLength={160}
          className="mt-1 w-full rounded-xl border px-3 py-3 text-base"
        />
      </label>

      <label className="block text-sm font-medium">
        Apartment, suite, etc. <span className="font-normal text-muted-foreground">(optional)</span>
        <input
          name="line2"
          autoComplete="address-line2"
          maxLength={160}
          className="mt-1 w-full rounded-xl border px-3 py-3 text-base"
        />
      </label>

      <div className="grid gap-4 sm:grid-cols-3">
        <label className="block text-sm font-medium sm:col-span-1">
          City
          <input
            name="city"
            autoComplete="address-level2"
            required
            minLength={2}
            maxLength={100}
            className="mt-1 w-full rounded-xl border px-3 py-3 text-base"
          />
        </label>
        <label className="block text-sm font-medium">
          {isUS ? "State" : "State / province"}
          <input
            name="state"
            autoComplete="address-level1"
            required
            minLength={2}
            maxLength={isUS ? 2 : 60}
            placeholder={isUS ? "FL" : ""}
            className={`mt-1 w-full rounded-xl border px-3 py-3 text-base ${isUS ? "uppercase" : ""}`}
          />
        </label>
        <label className="block text-sm font-medium">
          {isUS ? "ZIP" : "Postal code"}
          <input
            name="postalCode"
            autoComplete="postal-code"
            required
            pattern={isUS ? "[0-9]{5}(-[0-9]{4})?" : undefined}
            inputMode={isUS ? "numeric" : "text"}
            title={isUS ? "5-digit ZIP code" : undefined}
            maxLength={12}
            className="mt-1 w-full rounded-xl border px-3 py-3 text-base"
          />
        </label>
      </div>

      <div className="rounded-2xl bg-muted p-4 text-sm leading-6 text-foreground/80">
        <p>
          We only use these details to ship your gift. Submitting this form
          doesn&apos;t give {brandName} rights to any of your content.
        </p>
      </div>

      <div role="alert" aria-live="assertive">
        {error ? (
          <p
            id="claim-error"
            className="rounded-xl bg-red-50 p-3 text-sm text-red-700"
          >
            {error}
          </p>
        ) : null}
      </div>

      <Button
        type="submit"
        disabled={status === "submitting"}
        aria-describedby={error ? "claim-error" : undefined}
        className="w-full rounded-full py-6 text-base"
      >
        {status === "submitting" ? "Submitting…" : "Submit shipping details"}
      </Button>
    </form>
  );
}
