"use client";

import { useEffect, useState } from "react";

type Kit = {
  name: string;
  websiteUrl: string | null;
  logoUrl: string | null;
  shipCountries: string[];
  senderFirstName: string | null;
  brandDescription: string | null;
  productFacts: string | null;
  replyExamples: string | null;
  followUpTemplate: string | null;
  adDefaultText: string | null;
  adDefaultHeadline: string | null;
  adDefaultLink: string | null;
  defaultFollowUp: string;
};

type Field = {
  key: keyof Kit;
  label: string;
  help: string;
  rows?: number;
  placeholder?: string;
};

const SECTIONS: Array<{ title: string; intro: string; fields: Field[] }> = [
  {
    title: "Who's writing",
    intro: "Used in AI-drafted replies to creators.",
    fields: [
      { key: "senderFirstName", label: "Your first name", help: "Replies are written as you, e.g. \"Kam\".", placeholder: "Alex" },
      {
        key: "brandDescription",
        label: "Your brand in one line",
        help: "What you sell and what the gift is.",
        rows: 2,
        placeholder: "A skincare brand. The gift is our 7-pair under-eye patch box.",
      },
    ],
  },
  {
    title: "Product facts",
    intro: "The AI only answers creator questions with these facts. Leave this empty to turn AI replies off.",
    fields: [
      {
        key: "productFacts",
        label: "Facts, one per line",
        help: "Ingredients, how to use it, what makes it different, what you won't promise.",
        rows: 10,
        placeholder: "- The gift is free, and shipping is on us.\n- How to use it: ...\n- What's in it: ...\n- Health questions: say \"I'd check with your doctor first.\"",
      },
      {
        key: "replyExamples",
        label: "Example answers (optional)",
        help: "A few real questions with the answer you'd send. These teach the AI your voice.",
        rows: 8,
        placeholder: "Their reply: Do I have to post about it?\nGood answer:\nI'd love for you to try it first, and share only if you love it!",
      },
    ],
  },
  {
    title: "Your \"they said yes\" message",
    intro: "Prefilled when a creator says yes. Keep {address link} where their private address link goes.",
    fields: [{ key: "followUpTemplate", label: "Message", help: "", rows: 5 }],
  },
  {
    title: "Ad defaults",
    intro: "Prefilled when you make an ad from a creator's post. You can edit each ad.",
    fields: [
      { key: "adDefaultText", label: "Ad text", help: "", rows: 3 },
      { key: "adDefaultHeadline", label: "Headline", help: "" },
      { key: "adDefaultLink", label: "Link", help: "Your product page, starting with https://", placeholder: "https://yourstore.com/products/..." },
    ],
  },
];

const COUNTRIES = [
  ["US", "United States"],
  ["CA", "Canada"],
  ["GB", "United Kingdom"],
  ["AU", "Australia"],
] as const;

export default function BrandKitPage() {
  const [kit, setKit] = useState<Kit | null>(null);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState<{ ok: boolean; text: string } | null>(null);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    void fetch("/api/brand-kit")
      .then((r) => (r.ok ? r.json() : null))
      .then((data: Kit | null) => {
        if (data) setKit({ ...data, followUpTemplate: data.followUpTemplate ?? data.defaultFollowUp });
      });
  }, []);

  if (!kit) return <p className="text-muted-foreground">Loading...</p>;

  const set = (key: keyof Kit, value: string) => setKit({ ...kit, [key]: value });

  async function save() {
    if (!kit) return;
    setSaving(true);
    setNotice(null);
    const res = await fetch("/api/brand-kit", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(kit),
    });
    const data = (await res.json().catch(() => null)) as { error?: string } | null;
    setNotice(res.ok ? { ok: true, text: "Saved." } : { ok: false, text: data?.error ?? "Couldn't save." });
    setSaving(false);
  }

  async function uploadLogo(file: File) {
    setUploading(true);
    setNotice(null);
    const form = new FormData();
    form.append("logo", file);
    const res = await fetch("/api/brand-kit/logo", { method: "POST", body: form });
    const data = (await res.json().catch(() => null)) as { logoUrl?: string; error?: string } | null;
    if (res.ok && data?.logoUrl) setKit({ ...kit!, logoUrl: data.logoUrl });
    else setNotice({ ok: false, text: data?.error ?? "Couldn't upload the logo." });
    setUploading(false);
  }

  const fieldClass = "mt-1 w-full rounded-lg border bg-background px-3 py-2";

  return (
    <div className="max-w-3xl space-y-8">
      <header>
        <h1 className="text-3xl font-bold tracking-tight">Brand kit</h1>
        <p className="mt-1 text-muted-foreground">
          Everything creators see from {kit.name}: your logo, how replies sound, and what the AI can say.
        </p>
      </header>

      <section className="space-y-3 rounded-xl border bg-card p-5">
        <h2 className="font-semibold">Logo</h2>
        <p className="text-sm text-muted-foreground">Shown on your gift and usage-rights pages and in the app.</p>
        <div className="flex items-center gap-4">
          {kit.logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={kit.logoUrl} alt={`${kit.name} logo`} className="h-10 w-auto rounded border bg-white p-1" />
          ) : (
            <span className="text-sm text-muted-foreground">No logo yet</span>
          )}
          <label className="cursor-pointer rounded-lg border px-4 py-2 text-sm font-medium hover:bg-muted">
            {uploading ? "Uploading..." : kit.logoUrl ? "Replace logo" : "Upload logo"}
            <input
              type="file"
              accept="image/png,image/jpeg,image/svg+xml,image/webp"
              className="sr-only"
              disabled={uploading}
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) void uploadLogo(file);
              }}
            />
          </label>
        </div>
      </section>

      {SECTIONS.map((section) => (
        <section key={section.title} className="space-y-4 rounded-xl border bg-card p-5">
          <div>
            <h2 className="font-semibold">{section.title}</h2>
            <p className="text-sm text-muted-foreground">{section.intro}</p>
          </div>
          {section.fields.map((field) => (
            <label key={field.key} className="block text-sm font-medium">
              {field.label}
              {field.rows ? (
                <textarea
                  rows={field.rows}
                  value={(kit[field.key] as string | null) ?? ""}
                  placeholder={field.placeholder}
                  onChange={(e) => set(field.key, e.target.value)}
                  className={`${fieldClass} font-normal`}
                />
              ) : (
                <input
                  value={(kit[field.key] as string | null) ?? ""}
                  placeholder={field.placeholder}
                  onChange={(e) => set(field.key, e.target.value)}
                  className={`${fieldClass} font-normal`}
                />
              )}
              {field.help && <span className="mt-1 block font-normal text-muted-foreground">{field.help}</span>}
            </label>
          ))}
        </section>
      ))}

      <section className="space-y-3 rounded-xl border bg-card p-5">
        <h2 className="font-semibold">Where you ship gifts</h2>
        <p className="text-sm text-muted-foreground">
          Gift forms only accept these countries, and ads are shown there.
        </p>
        <div className="flex flex-wrap gap-4">
          {COUNTRIES.map(([code, label]) => (
            <label key={code} className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={kit.shipCountries.includes(code)}
                onChange={(e) =>
                  setKit({
                    ...kit,
                    shipCountries: e.target.checked
                      ? [...kit.shipCountries, code]
                      : kit.shipCountries.filter((c) => c !== code),
                  })
                }
              />
              {label}
            </label>
          ))}
        </div>
      </section>

      <div className="sticky bottom-4 flex items-center gap-4 rounded-xl border bg-background/95 p-4 shadow-sm">
        <button
          type="button"
          onClick={() => void save()}
          disabled={saving}
          className="rounded-lg bg-foreground px-5 py-2 font-medium text-background disabled:opacity-50"
        >
          {saving ? "Saving..." : "Save brand kit"}
        </button>
        {notice && <p className={`text-sm ${notice.ok ? "text-green-700" : "text-red-600"}`}>{notice.text}</p>}
      </div>
    </div>
  );
}
