"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { BUILT_IN_PERSONAS } from "@/lib/ai/personas";

type AiPersona = {
  id: string;
  name: string;
  description: string | null;
  tone: string;
  systemPrompt: string;
  exampleMessages: string[] | null;
  isDefault: boolean;
  createdAt: string;
};

type FormState = {
  name: string;
  description: string;
  tone: string;
  systemPrompt: string;
  exampleMessages: string;
};

const emptyForm: FormState = {
  name: "",
  description: "",
  tone: "professional",
  systemPrompt: "",
  exampleMessages: "",
};

const toneLabels: Record<string, string> = {
  professional: "Polished",
  casual: "Friendly",
  influencer: "Creator to creator",
};

function parseExamples(text: string): string[] {
  return text ? text.split("\n---\n").filter(Boolean) : [];
}

export default function AiPersonasPage() {
  const [personas, setPersonas] = useState<AiPersona[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [preview, setPreview] = useState<{ subject?: string; body: string } | null>(null);
  const [previewing, setPreviewing] = useState(false);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [listError, setListError] = useState<string | null>(null);

  const loadPersonas = async () => {
    try {
      const res = await fetch("/api/ai-personas");
      if (!res.ok) throw new Error();
      const data = await res.json();
      setPersonas(Array.isArray(data) ? data : []);
      setLoadError(null);
    } catch {
      setLoadError("Couldn't load your writing styles. Refresh the page to try again.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadPersonas();
  }, []);

  const openCreate = () => {
    setForm(emptyForm);
    setEditingId(null);
    setPreview(null);
    setFormError(null);
    setDialogOpen(true);
  };

  const openEdit = (persona: AiPersona) => {
    setForm({
      name: persona.name,
      description: persona.description ?? "",
      tone: persona.tone,
      systemPrompt: persona.systemPrompt,
      exampleMessages: (persona.exampleMessages ?? []).join("\n---\n"),
    });
    setEditingId(persona.id);
    setPreview(null);
    setFormError(null);
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!form.name || !form.systemPrompt) return;
    setSaving(true);
    setFormError(null);

    const payload = {
      name: form.name,
      description: form.description || null,
      tone: form.tone,
      systemPrompt: form.systemPrompt,
      exampleMessages: parseExamples(form.exampleMessages),
    };

    try {
      const url = editingId ? `/api/ai-personas/${editingId}` : "/api/ai-personas";
      const method = editingId ? "PUT" : "POST";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        setDialogOpen(false);
        loadPersonas();
      } else {
        const err = (await res.json().catch(() => null)) as { error?: string } | null;
        setFormError(err?.error ?? "Couldn't save this style. Try again.");
      }
    } catch {
      setFormError("Couldn't save this style. Check your connection and try again.");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    setDeleting(id);
    setListError(null);

    try {
      const res = await fetch(`/api/ai-personas/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error();
      setConfirmDeleteId(null);
      loadPersonas();
    } catch {
      setListError("Couldn't delete that style. Try again.");
    } finally {
      setDeleting(null);
    }
  };

  const handlePreview = async () => {
    if (!form.systemPrompt) return;
    setPreviewing(true);
    setPreview(null);
    setFormError(null);

    try {
      const res = await fetch("/api/ai-personas/preview", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: form.name,
          tone: form.tone,
          systemPrompt: form.systemPrompt,
          exampleMessages: parseExamples(form.exampleMessages),
          channel: "email",
        }),
      });

      if (!res.ok) throw new Error();
      setPreview(await res.json());
    } catch {
      setFormError("Couldn't write a sample email. Try again in a moment.");
    } finally {
      setPreviewing(false);
    }
  };

  return (
    <div className="space-y-8">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Writing styles</h1>
          <p className="mt-1 text-muted-foreground">
            How suggested emails to creators sound. You pick a style on each
            campaign&apos;s Email creators page.
          </p>
        </div>
        <Button onClick={openCreate}>Add a style</Button>
      </header>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingId ? "Edit style" : "Add a style"}</DialogTitle>
            <DialogDescription>Describe how emails in this style should read.</DialogDescription>
          </DialogHeader>

          <div className="space-y-4 pt-2">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="persona-name">Name</Label>
                <Input
                  id="persona-name"
                  value={form.name}
                  onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                  placeholder="For example: Warm and short"
                />
              </div>
              <div className="space-y-2">
                <Label>Tone</Label>
                <Select
                  value={form.tone}
                  onValueChange={(v) => v && setForm((f) => ({ ...f, tone: v }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="professional">{toneLabels.professional}</SelectItem>
                    <SelectItem value="casual">{toneLabels.casual}</SelectItem>
                    <SelectItem value="influencer">{toneLabels.influencer}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="persona-description">When to use it (optional)</Label>
              <Input
                id="persona-description"
                value={form.description}
                onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                placeholder="For example: Smaller creators who post daily"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="persona-instructions">Instructions</Label>
              <p className="text-sm text-muted-foreground">
                Write it like a note to a new teammate: who you are, how to sound, what to avoid.
              </p>
              <Textarea
                id="persona-instructions"
                value={form.systemPrompt}
                onChange={(e) => setForm((f) => ({ ...f, systemPrompt: e.target.value }))}
                placeholder="Keep it short and warm. Mention one post of theirs you liked. Never use exclamation marks."
                rows={6}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="persona-examples">Example emails (optional)</Label>
              <p className="text-sm text-muted-foreground">
                Paste emails you liked. Put a line with only --- between each one.
              </p>
              <Textarea
                id="persona-examples"
                value={form.exampleMessages}
                onChange={(e) => setForm((f) => ({ ...f, exampleMessages: e.target.value }))}
                rows={5}
              />
            </div>

            <div className="space-y-2 border-t pt-4">
              <div className="flex items-center justify-between gap-3">
                <p className="font-medium">Try it out</p>
                <Button
                  variant="outline"
                  onClick={handlePreview}
                  disabled={!form.systemPrompt || previewing}
                >
                  {previewing ? "Writing..." : "Write a sample email"}
                </Button>
              </div>
              {preview && (
                <div className="space-y-2 rounded-lg bg-muted/50 p-4 text-sm">
                  {preview.subject && (
                    <p>
                      <span className="font-medium">Subject: </span>
                      {preview.subject}
                    </p>
                  )}
                  <p className="whitespace-pre-wrap">{preview.body}</p>
                </div>
              )}
            </div>

            {formError && (
              <p role="alert" className="text-sm text-destructive">
                {formError}
              </p>
            )}

            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={() => setDialogOpen(false)}>
                Cancel
              </Button>
              <Button onClick={handleSave} disabled={!form.name || !form.systemPrompt || saving}>
                {saving ? "Saving..." : editingId ? "Save changes" : "Add style"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <section className="space-y-3">
        <h2 className="font-semibold">Your styles</h2>
        {listError && (
          <p role="alert" className="text-sm text-destructive">
            {listError}
          </p>
        )}
        {loading ? (
          <p className="text-muted-foreground">Loading...</p>
        ) : loadError ? (
          <p className="rounded-xl border bg-card p-5 text-muted-foreground">{loadError}</p>
        ) : personas.length === 0 ? (
          <div className="rounded-xl border bg-card p-6 text-center">
            <p className="font-medium">You haven&apos;t added a style yet.</p>
            <p className="mt-1 text-muted-foreground">
              The ready-made styles below work fine. Add your own to match your brand&apos;s voice.
            </p>
          </div>
        ) : (
          <ul className="divide-y rounded-xl border bg-card">
            {personas.map((p) => (
              <li key={p.id} className="flex flex-wrap items-start justify-between gap-4 px-5 py-4">
                <div className="min-w-0 flex-1 space-y-1">
                  <p className="font-medium">
                    {p.name}
                    {p.isDefault && (
                      <span className="ml-2 text-sm font-normal text-muted-foreground">
                        (used by default)
                      </span>
                    )}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    Tone: {toneLabels[p.tone] ?? p.tone}
                    {p.description ? `. ${p.description}` : ""}
                  </p>
                </div>
                <div className="flex shrink-0 gap-2">
                  {confirmDeleteId === p.id ? (
                    <>
                      <Button
                        variant="destructive"
                        onClick={() => handleDelete(p.id)}
                        disabled={deleting === p.id}
                      >
                        {deleting === p.id ? "Deleting..." : "Yes, delete"}
                      </Button>
                      <Button variant="outline" onClick={() => setConfirmDeleteId(null)}>
                        Keep it
                      </Button>
                    </>
                  ) : (
                    <>
                      <Button variant="outline" onClick={() => openEdit(p)}>
                        Edit
                      </Button>
                      <Button variant="outline" onClick={() => setConfirmDeleteId(p.id)}>
                        Delete
                      </Button>
                    </>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="space-y-3">
        <h2 className="font-semibold">Ready-made styles</h2>
        <ul className="divide-y rounded-xl border bg-card">
          {BUILT_IN_PERSONAS.map((p) => (
            <li key={p.id} className="space-y-1 px-5 py-4">
              <p className="font-medium">{p.name}</p>
              <p className="text-sm text-muted-foreground">{p.description}</p>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
