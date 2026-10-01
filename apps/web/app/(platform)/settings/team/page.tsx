"use client";

import { useCallback, useEffect, useState } from "react";
import { InviteLinkBox } from "@/components/invite-link-box";

type TeamData = {
  myRole: string;
  members: Array<{ id: string; email: string; role: string; joinedAt: string }>;
  invites: Array<{ id: string; email: string; role: string; expiresAt: string }>;
};

const ROLE_LABELS: Record<string, string> = { owner: "Owner", editor: "Can edit", viewer: "Can view" };

export default function TeamPage() {
  const [data, setData] = useState<TeamData | null>(null);
  const [email, setEmail] = useState("");
  const [role, setRole] = useState("editor");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [link, setLink] = useState<{ url: string; email: string; emailed: boolean } | null>(null);

  const load = useCallback(async () => {
    const res = await fetch("/api/team");
    if (res.ok) setData((await res.json()) as TeamData);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const canInvite = data?.myRole === "owner" || data?.myRole === "editor";

  async function invite(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    setLink(null);
    try {
      const res = await fetch("/api/team/invites", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, role }),
      });
      const body = (await res.json().catch(() => null)) as { link?: string; emailed?: boolean; error?: string } | null;
      if (!res.ok || !body?.link) throw new Error(body?.error ?? "Couldn't create the invite.");
      setLink({ url: body.link, email, emailed: Boolean(body.emailed) });
      setEmail("");
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't create the invite.");
    } finally {
      setBusy(false);
    }
  }

  async function cancel(id: string) {
    await fetch(`/api/team/invites/${id}`, { method: "DELETE" });
    await load();
  }

  return (
    <div className="space-y-8">
      <header>
        <h1 className="text-3xl font-bold tracking-tight">Team</h1>
        <p className="mt-1 text-muted-foreground">People who can use this workspace.</p>
      </header>

      {canInvite && (
        <section className="space-y-3 rounded-xl border bg-card p-5">
          <h2 className="font-semibold">Invite someone</h2>
          <form onSubmit={(e) => void invite(e)} className="flex flex-wrap items-end gap-3">
            <label className="min-w-64 flex-1 text-sm font-medium">
              Email
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="mt-1 w-full rounded-lg border px-3 py-2 font-normal"
              />
            </label>
            <label className="text-sm font-medium">
              Access
              <select
                value={role}
                onChange={(e) => setRole(e.target.value)}
                className="mt-1 block rounded-lg border bg-background px-3 py-2 font-normal"
              >
                <option value="editor">Can edit</option>
                <option value="viewer">Can view</option>
                {data?.myRole === "owner" && <option value="owner">Owner</option>}
              </select>
            </label>
            <button
              type="submit"
              disabled={busy}
              className="rounded-lg bg-foreground px-4 py-2 font-medium text-background disabled:opacity-50"
            >
              {busy ? "Sending..." : "Send invite"}
            </button>
          </form>
          {error && <p className="text-sm text-red-600">{error}</p>}
          {link && <InviteLinkBox link={link.url} email={link.email} emailed={link.emailed} />}
        </section>
      )}

      <section className="space-y-3">
        <h2 className="font-semibold">Members</h2>
        <ul className="divide-y rounded-xl border bg-card">
          {(data?.members ?? []).map((m) => (
            <li key={m.id} className="flex items-center justify-between px-5 py-3">
              <span>{m.email}</span>
              <span className="text-sm text-muted-foreground">{ROLE_LABELS[m.role] ?? m.role}</span>
            </li>
          ))}
          {!data && <li className="px-5 py-3 text-muted-foreground">Loading...</li>}
        </ul>
      </section>

      {data && data.invites.length > 0 && (
        <section className="space-y-3">
          <h2 className="font-semibold">Waiting to join</h2>
          <ul className="divide-y rounded-xl border bg-card">
            {data.invites.map((i) => (
              <li key={i.id} className="flex items-center justify-between gap-4 px-5 py-3">
                <span>{i.email}</span>
                <span className="flex items-center gap-4 text-sm text-muted-foreground">
                  {ROLE_LABELS[i.role] ?? i.role}
                  {canInvite && (
                    <button type="button" onClick={() => void cancel(i.id)} className="font-medium text-foreground underline">
                      Cancel invite
                    </button>
                  )}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
