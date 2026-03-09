"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
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
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
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
  professional: "Professional",
  casual: "Casual / Friendly",
  influencer: "Influencer-Native",
};

export default function AiPersonasPage() {
  const [personas, setPersonas] = useState<AiPersona[]>([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [preview, setPreview] = useState<{
    subject?: string;
    body: string;
    tokens: number;
  } | null>(null);
  const [previewing, setPreviewing] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);

  const loadPersonas = async () => {
    try {
      const res = await fetch("/api/ai-personas");
      if (res.ok) {
        const data = await res.json();
        setPersonas(Array.isArray(data) ? data : []);
      }
    } catch (err) {
      console.error("Failed to load personas:", err);
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
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!form.name || !form.systemPrompt) return;
    setSaving(true);

    const payload = {
      name: form.name,
      description: form.description || null,
      tone: form.tone,
      systemPrompt: form.systemPrompt,
      exampleMessages: form.exampleMessages
        ? form.exampleMessages.split("\n---\n").filter(Boolean)
        : [],
    };

    try {
      const url = editingId
        ? `/api/ai-personas/${editingId}`
        : "/api/ai-personas";
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
        const err = await res.json();
        alert(err.error ?? "Failed to save persona");
      }
    } catch (err) {
      console.error("Save failed:", err);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this persona?")) return;
    setDeleting(id);

    try {
      const res = await fetch(`/api/ai-personas/${id}`, { method: "DELETE" });
      if (res.ok) {
        loadPersonas();
      }
    } catch (err) {
      console.error("Delete failed:", err);
    } finally {
      setDeleting(null);
    }
  };

  const handlePreview = async () => {
    if (!form.systemPrompt) return;
    setPreviewing(true);
    setPreview(null);

    try {
      const res = await fetch("/api/ai-personas/preview", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: form.name,
          tone: form.tone,
          systemPrompt: form.systemPrompt,
          exampleMessages: form.exampleMessages
            ? form.exampleMessages.split("\n---\n").filter(Boolean)
            : [],
          channel: "email",
        }),
      });

      if (res.ok) {
        setPreview(await res.json());
      }
    } catch (err) {
      console.error("Preview failed:", err);
    } finally {
      setPreviewing(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">AI Personas</h1>
          <p className="text-muted-foreground">
            Manage outreach personas for AI-generated messages.
          </p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger>
            <Button onClick={openCreate}>Create Persona</Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>
                {editingId ? "Edit Persona" : "Create Persona"}
              </DialogTitle>
              <DialogDescription>
                Define how the AI should write outreach messages.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 pt-2">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label>Name *</Label>
                  <Input
                    value={form.name}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, name: e.target.value }))
                    }
                    placeholder="e.g. Gen-Z Friendly"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Tone *</Label>
                  <Select
                    value={form.tone}
                    onValueChange={(v) =>
                      v && setForm((f) => ({ ...f, tone: v }))
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="professional">
                        Professional
                      </SelectItem>
                      <SelectItem value="casual">
                        Casual / Friendly
                      </SelectItem>
                      <SelectItem value="influencer">
                        Influencer-Native
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-2">
                <Label>Description</Label>
                <Input
                  value={form.description}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, description: e.target.value }))
                  }
                  placeholder="Brief description of when to use this persona"
                />
              </div>

              <div className="space-y-2">
                <Label>System Prompt *</Label>
                <Textarea
                  value={form.systemPrompt}
                  onChange={(e) =>
                    setForm((f) => ({
                      ...f,
                      systemPrompt: e.target.value,
                    }))
                  }
                  placeholder="Instructions for the AI on how to write messages..."
                  rows={6}
                />
              </div>

              <div className="space-y-2">
                <Label>Example Messages</Label>
                <p className="text-xs text-muted-foreground">
                  Separate multiple examples with a line containing only{" "}
                  <code>---</code>
                </p>
                <Textarea
                  value={form.exampleMessages}
                  onChange={(e) =>
                    setForm((f) => ({
                      ...f,
                      exampleMessages: e.target.value,
                    }))
                  }
                  placeholder="Write sample messages to guide the AI style..."
                  rows={5}
                />
              </div>

              {/* Preview section */}
              <div className="border-t pt-4">
                <div className="flex items-center justify-between mb-2">
                  <Label>Preview</Label>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handlePreview}
                    disabled={!form.systemPrompt || previewing}
                  >
                    {previewing ? "Generating..." : "Generate Preview"}
                  </Button>
                </div>
                {preview && (
                  <div className="rounded-lg bg-muted/50 p-4 text-sm space-y-2">
                    {preview.subject && (
                      <div>
                        <span className="font-medium">Subject: </span>
                        {preview.subject}
                      </div>
                    )}
                    <div className="whitespace-pre-wrap">{preview.body}</div>
                    <div className="text-xs text-muted-foreground pt-1">
                      {preview.tokens} tokens used
                    </div>
                  </div>
                )}
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <Button
                  variant="outline"
                  onClick={() => setDialogOpen(false)}
                >
                  Cancel
                </Button>
                <Button
                  onClick={handleSave}
                  disabled={!form.name || !form.systemPrompt || saving}
                >
                  {saving
                    ? "Saving..."
                    : editingId
                      ? "Update"
                      : "Create"}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Built-in personas */}
      <div>
        <h2 className="text-lg font-semibold mb-3">Built-in Personas</h2>
        <div className="grid gap-4 md:grid-cols-3">
          {BUILT_IN_PERSONAS.map((p) => (
            <Card key={p.id}>
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base">{p.name}</CardTitle>
                  <Badge variant="outline" className="text-xs">
                    {toneLabels[p.tone] ?? p.tone}
                  </Badge>
                </div>
                <CardDescription className="text-xs">
                  {p.description}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="text-xs text-muted-foreground">
                  System: {p.systemPrompt.slice(0, 120)}...
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

      {/* Custom personas */}
      <div>
        <h2 className="text-lg font-semibold mb-3">Custom Personas</h2>
        {loading ? (
          <p className="text-sm text-muted-foreground">Loading...</p>
        ) : personas.length === 0 ? (
          <Card>
            <CardContent className="py-8 text-center text-muted-foreground">
              <p>No custom personas yet.</p>
              <p className="text-sm">
                Create one to tailor AI outreach to your brand voice.
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4 md:grid-cols-2">
            {personas.map((p) => (
              <Card key={p.id}>
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-base">{p.name}</CardTitle>
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className="text-xs">
                        {toneLabels[p.tone] ?? p.tone}
                      </Badge>
                      {p.isDefault && (
                        <Badge className="text-xs">Default</Badge>
                      )}
                    </div>
                  </div>
                  {p.description && (
                    <CardDescription className="text-xs">
                      {p.description}
                    </CardDescription>
                  )}
                </CardHeader>
                <CardContent>
                  <div className="text-xs text-muted-foreground mb-3">
                    {p.systemPrompt.slice(0, 150)}...
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => openEdit(p)}
                    >
                      Edit
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleDelete(p.id)}
                      disabled={deleting === p.id}
                      className="text-red-600 hover:text-red-700"
                    >
                      {deleting === p.id ? "Deleting..." : "Delete"}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
