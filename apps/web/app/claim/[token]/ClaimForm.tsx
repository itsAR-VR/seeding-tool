"use client";

import { FormEvent, useState } from "react";
import { Button } from "@/components/ui/button";

type ClaimFormProps = {
  token: string;
};

export function ClaimForm({ token }: ClaimFormProps) {
  const [status, setStatus] = useState<"idle" | "submitting" | "submitted">(
    "idle"
  );
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setStatus("submitting");
    setError(null);

    const formData = new FormData(event.currentTarget);
    const payload = Object.fromEntries(formData.entries());

    const response = await fetch(`/api/gift-claims/${token}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const body = (await response.json().catch(() => ({}))) as {
        error?: string;
      };
      setError(body.error ?? "We could not submit this claim. Please try again.");
      setStatus("idle");
      return;
    }

    setStatus("submitted");
  }

  if (status === "submitted") {
    return (
      <div className="rounded-3xl border border-green-200 bg-green-50 p-6 text-green-950">
        <h2 className="text-xl font-semibold">Address submitted</h2>
        <p className="mt-2 text-sm leading-6">
          Thank you! We&apos;ll let you know when it ships.
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
        Phone number <span className="font-normal text-neutral-500">(optional)</span>
        <input
          name="phone"
          type="tel"
          autoComplete="tel"
          maxLength={40}
          className="mt-1 w-full rounded-xl border px-3 py-3 text-base"
        />
      </label>

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
        Apartment, suite, etc. <span className="font-normal text-neutral-500">(optional)</span>
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
          State
          <input
            name="state"
            autoComplete="address-level1"
            required
            minLength={2}
            maxLength={2}
            placeholder="FL"
            className="mt-1 w-full rounded-xl border px-3 py-3 text-base uppercase"
          />
        </label>
        <label className="block text-sm font-medium">
          ZIP
          <input
            name="postalCode"
            autoComplete="postal-code"
            required
            pattern="[0-9]{5}(-[0-9]{4})?"
            inputMode="numeric"
            title="5-digit ZIP code"
            className="mt-1 w-full rounded-xl border px-3 py-3 text-base"
          />
        </label>
      </div>

      <div className="rounded-2xl bg-neutral-50 p-4 text-sm leading-6 text-neutral-700">
        <p>
          We only use these details to ship your gift. Submitting this form
          doesn&apos;t give Kalm rights to any of your content.
        </p>
      </div>

      {error ? (
        <p className="rounded-xl bg-red-50 p-3 text-sm text-red-700">{error}</p>
      ) : null}

      <Button
        type="submit"
        disabled={status === "submitting"}
        className="w-full rounded-full py-6 text-base"
      >
        {status === "submitting" ? "Submitting…" : "Submit shipping details"}
      </Button>
    </form>
  );
}
