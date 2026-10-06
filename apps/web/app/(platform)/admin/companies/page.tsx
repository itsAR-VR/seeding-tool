"use client";

import { useCallback, useEffect, useState } from "react";
import { InviteLinkBox } from "@/components/invite-link-box";
import { formatDate } from "@/lib/format/date";

type AdminData = {
  companies: Array<{
    id: string;
    name: string;
    createdAt: string;
    useSharedApify: boolean;
    hasOwnApifyKey: boolean;
    _count: { memberships: number };
  }>;
  invites: Array<{ id: string; email: string; companyName: string | null; acceptedAt: string | null; expiresAt: string }>;
};

const date = (iso: string) => formatDate(iso);

export default function CompaniesPage() {
  const [data, setData] = useState<AdminData | null>(null);
  const [denied, setDenied] = useState(false);
  const [companyName, setCompanyName] = useState("");
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [link, setLink] = useState<{ url: string; email: string; emailed: boolean } | null>(null);

  const load = useCallback(async () => {
    const res = await fetch("/api/admin/invites");
    if (res.status === 403) return setDenied(true);
    if (res.ok) setData((await res.json()) as AdminData);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function setSharedApify(brandId: string, useSharedApify: boolean) {
    setError(null);
    const res = await fetch(`/api/admin/companies/${brandId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ useSharedApify }),
    });
    if (!res.ok) setError("Couldn't change that company's search setting.");
    await load();
  }

  async function invite(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    setLink(null);
    try {
      const res = await fetch("/api/admin/invites", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ companyName, email }),
      });
      const body = (await res.json().catch(() => null)) as { link?: string; emailed?: boolean; error?: string } | null;
      if (!res.ok || !body?.link) throw new Error(body?.error ?? "Couldn't create the invite.");
      setLink({ url: body.link, email, emailed: Boolean(body.emailed) });
      setCompanyName("");
      setEmail("");
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't create the invite.");
    } finally {
      setBusy(false);
    }
  }

  if (denied) {
    return <p className="text-muted-foreground">Only Seed Scale admins can see this page.</p>;
  }

  const open = (data?.invites ?? []).filter((i) => !i.acceptedAt);

  return (
    <div className="space-y-8">
      <header>
        <h1 className="text-3xl font-bold tracking-tight">Companies</h1>
        <p className="mt-1 text-muted-foreground">Invite a company to Seed Scale. They set up their own brand and accounts.</p>
      </header>

      <section className="space-y-3 rounded-xl border bg-card p-5">
        <h2 className="font-semibold">Invite a company</h2>
        <form onSubmit={(e) => void invite(e)} className="flex flex-wrap items-end gap-3">
          <label className="w-full min-w-0 flex-1 text-sm font-medium sm:min-w-56">
            Company name
            <input required value={companyName} onChange={(e) => setCompanyName(e.target.value)} className="mt-1 w-full rounded-lg border px-3 py-2 font-normal" />
          </label>
          <label className="w-full min-w-0 flex-1 text-sm font-medium sm:min-w-64">
            Their email
            <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} className="mt-1 w-full rounded-lg border px-3 py-2 font-normal" />
          </label>
          <button type="submit" disabled={busy} className="rounded-lg bg-foreground px-4 py-2 font-medium text-background disabled:opacity-50">
            {busy ? "Sending..." : "Send invite"}
          </button>
        </form>
        {error && <p className="text-sm text-red-600">{error}</p>}
        {link && <InviteLinkBox link={link.url} email={link.email} emailed={link.emailed} />}
      </section>

      {open.length > 0 && (
        <section className="space-y-3">
          <h2 className="font-semibold">Invited, not joined yet</h2>
          <ul className="divide-y rounded-xl border bg-card">
            {open.map((i) => (
              <li key={i.id} className="flex items-center justify-between gap-4 px-5 py-3">
                <span className="min-w-0 [overflow-wrap:anywhere]">{i.companyName} · {i.email}</span>
                <span className="shrink-0 text-sm text-muted-foreground">
                  {new Date(i.expiresAt) < new Date() ? "Expired, send a new invite" : `Expires ${date(i.expiresAt)}`}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="space-y-3">
        <h2 className="font-semibold">Companies</h2>
        <ul className="divide-y rounded-xl border bg-card">
          {(data?.companies ?? []).map((c) => (
            <li key={c.id} className="flex flex-wrap items-center justify-between gap-3 px-5 py-3">
              <div className="min-w-0">
                <p className="font-medium [overflow-wrap:anywhere]">{c.name}</p>
                <p className="text-sm text-muted-foreground">
                  {c._count.memberships} {c._count.memberships === 1 ? "member" : "members"} · since {date(c.createdAt)}
                </p>
              </div>
              {c.hasOwnApifyKey ? (
                <span className="text-sm">Uses their own search account</span>
              ) : (
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={c.useSharedApify}
                    onChange={(e) => void setSharedApify(c.id, e.target.checked)}
                  />
                  Can use our search account
                </label>
              )}
            </li>
          ))}
          {!data && <li className="px-5 py-3 text-muted-foreground">Loading...</li>}
        </ul>
      </section>
    </div>
  );
}
