"use client";

import { useState } from "react";
import { Brain, Pencil, Trash2, Plus, Check, X, Loader2 } from "lucide-react";
import { useMemories } from "@/lib/hooks/useMemories";
import { MEMORY_CATEGORIES } from "@/lib/types/chat";
import type { UserMemory } from "@/lib/types/chat";
import { ConfirmModal } from "@/components/ConfirmModal";
import { cn } from "@/lib/utils";

function categoryLabel(id: string): string {
  return MEMORY_CATEGORIES.find((c) => c.id === id)?.label ?? "Other";
}

function MemoryRow({
  memory, onSave, onDeleteRequest,
}: {
  memory: UserMemory;
  onSave: (id: string, key: string, value: string, category: string) => Promise<void>;
  onDeleteRequest: (memory: UserMemory) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [key, setKey] = useState(memory.key);
  const [value, setValue] = useState(memory.value);
  const [category, setCategory] = useState(memory.category);
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!key.trim() || !value.trim()) return;
    setSaving(true);
    await onSave(memory.id, key.trim(), value.trim(), category);
    setSaving(false);
    setEditing(false);
  };

  if (editing) {
    return (
      <div className="flex flex-col gap-2 px-4 py-3 rounded-lg border border-accent/30 bg-accent/5">
        <select
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          className="px-2.5 py-1.5 rounded-md border border-border bg-surface text-xs text-text-primary outline-none focus:border-accent/40"
          aria-label="Category"
        >
          {MEMORY_CATEGORIES.map((c) => (
            <option key={c.id} value={c.id}>{c.label}</option>
          ))}
        </select>
        <input
          value={key}
          onChange={(e) => setKey(e.target.value)}
          placeholder="Label"
          className="px-2.5 py-1.5 rounded-md border border-border bg-surface text-xs font-medium text-text-primary outline-none focus:border-accent/40"
        />
        <textarea
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder="What should Prompt AI remember?"
          rows={2}
          className="px-2.5 py-1.5 rounded-md border border-border bg-surface text-xs text-text-primary outline-none focus:border-accent/40 resize-none"
        />
        <div className="flex justify-end gap-2">
          <button
            onClick={() => { setEditing(false); setKey(memory.key); setValue(memory.value); setCategory(memory.category); }}
            className="p-1.5 rounded-md text-text-faint hover:text-text-muted transition-colors"
            aria-label="Cancel"
          >
            <X size={13} />
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="p-1.5 rounded-md bg-accent-fill text-accent-fill-foreground disabled:opacity-50 transition-colors"
            aria-label="Save"
          >
            {saving ? <Loader2 size={13} className="animate-spin" /> : <Check size={13} />}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="group flex items-start justify-between gap-3 px-4 py-3 rounded-lg border border-border bg-surface hover:border-border/60 transition-colors">
      <div className="min-w-0">
        <p className="text-sm font-medium text-text-primary">
          {memory.key}
          <span className="ml-2 font-mono text-[9px] uppercase tracking-wider text-text-faint">
            {memory.source === "manual" ? "added by you" : memory.source === "onboarding" ? "from onboarding" : "saved from a chat"}
          </span>
        </p>
        <p className="text-xs text-text-muted mt-0.5 leading-relaxed">{memory.value}</p>
      </div>
      <div className="flex items-center gap-1 shrink-0 sm:opacity-0 sm:group-hover:opacity-100 focus-within:opacity-100 transition-opacity">
        <button
          onClick={() => setEditing(true)}
          className="p-1.5 rounded-md text-text-faint hover:text-text-muted transition-colors"
          aria-label="Edit memory"
        >
          <Pencil size={12} />
        </button>
        <button
          onClick={() => onDeleteRequest(memory)}
          className="p-1.5 rounded-md text-text-faint hover:text-red-400 transition-colors"
          aria-label="Delete memory"
        >
          <Trash2 size={12} />
        </button>
      </div>
    </div>
  );
}

export function MemoryTab() {
  const { memories, loading, add, update, remove, clearAll } = useMemories();
  const [addingCategory, setAddingCategory] = useState<string | null>(null);
  const [newKey, setNewKey] = useState("");
  const [newValue, setNewValue] = useState("");
  const [saving, setSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<UserMemory | null>(null);
  const [confirmClearAll, setConfirmClearAll] = useState(false);

  const grouped = MEMORY_CATEGORIES.map((c) => ({
    ...c,
    items: memories.filter((m) => m.category === c.id),
  }));
  const uncategorized = memories.filter((m) => !MEMORY_CATEGORIES.some((c) => c.id === m.category));

  const handleAdd = async (category: string) => {
    if (!newKey.trim() || !newValue.trim()) return;
    setSaving(true);
    await add(category, newKey.trim(), newValue.trim(), "manual");
    setSaving(false);
    setNewKey("");
    setNewValue("");
    setAddingCategory(null);
  };

  return (
    <div className="max-w-2xl mx-auto">
      <div className="flex items-center gap-2 mb-1">
        <Brain size={16} className="text-accent" />
        <h1 className="text-xl font-semibold text-text-primary">Memory</h1>
      </div>
      <p className="text-sm text-text-muted mb-6 leading-relaxed">
        Prompt AI saves stable, useful details from your conversations here on its own, and checks
        them before every reply so it asks fewer redundant questions. You control everything, add,
        edit, or remove anything at any time.
      </p>

      {loading ? (
        <div className="flex items-center gap-2 text-sm text-text-muted">
          <Loader2 size={14} className="animate-spin" />
          Loading your memory...
        </div>
      ) : memories.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border bg-surface p-8 text-center">
          <Brain size={20} className="text-text-faint mx-auto mb-3" />
          <p className="text-sm text-text-primary font-medium">Prompt AI does not know anything about you yet</p>
          <p className="text-xs text-text-muted mt-1 max-w-sm mx-auto leading-relaxed">
            Useful, stable context will be saved here as you chat, such as your stack, your work and
            how you like things done. Nothing is guessed. You can also add something yourself right now.
          </p>
          {!addingCategory && (
            <button
              onClick={() => setAddingCategory("about")}
              className="mt-4 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-accent-fill text-accent-fill-foreground text-xs font-semibold hover:bg-accent-fill/90 transition-colors"
            >
              <Plus size={12} /> Add something now
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-6 mb-6">
          {[...grouped, ...(uncategorized.length ? [{ id: "other", label: "Other", items: uncategorized }] : [])]
            .filter((g) => g.items.length > 0)
            .map((group) => (
              <div key={group.id}>
                <p className="px-0.5 mb-2 font-mono text-[10px] uppercase tracking-widest text-text-faint">
                  {group.label}
                </p>
                <div className="space-y-2">
                  {group.items.map((m) => (
                    <MemoryRow key={m.id} memory={m} onSave={update} onDeleteRequest={setDeleteTarget} />
                  ))}
                </div>
              </div>
            ))}
        </div>
      )}

      {/* Add memory */}
      {addingCategory ? (
        <div className="flex flex-col gap-2 px-4 py-3 rounded-lg border border-accent/30 bg-accent/5 mb-4">
          <select
            value={addingCategory}
            onChange={(e) => setAddingCategory(e.target.value)}
            className="px-2.5 py-1.5 rounded-md border border-border bg-surface text-xs text-text-primary outline-none focus:border-accent/40"
          >
            {MEMORY_CATEGORIES.map((c) => (
              <option key={c.id} value={c.id}>{c.label}</option>
            ))}
          </select>
          <input
            autoFocus
            value={newKey}
            onChange={(e) => setNewKey(e.target.value)}
            placeholder="Label, for example: Primary stack"
            className="px-2.5 py-1.5 rounded-md border border-border bg-surface text-xs font-medium text-text-primary outline-none focus:border-accent/40"
          />
          <textarea
            value={newValue}
            onChange={(e) => setNewValue(e.target.value)}
            placeholder="What should Prompt AI remember?"
            rows={2}
            className="px-2.5 py-1.5 rounded-md border border-border bg-surface text-xs text-text-primary outline-none focus:border-accent/40 resize-none"
          />
          <div className="flex justify-end gap-2">
            <button
              onClick={() => { setAddingCategory(null); setNewKey(""); setNewValue(""); }}
              className="px-2.5 py-1.5 rounded-md text-xs text-text-faint hover:text-text-muted transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={() => handleAdd(addingCategory)}
              disabled={saving || !newKey.trim() || !newValue.trim()}
              className={cn(
                "px-3 py-1.5 rounded-md text-xs font-semibold transition-colors",
                saving || !newKey.trim() || !newValue.trim()
                  ? "bg-accent-fill/40 text-accent-fill-foreground cursor-not-allowed"
                  : "bg-accent-fill text-accent-fill-foreground hover:bg-accent-fill/90"
              )}
            >
              {saving ? "Saving..." : "Save"}
            </button>
          </div>
        </div>
      ) : memories.length === 0 ? null : (
        <button
          onClick={() => setAddingCategory("about")}
          className="w-full flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-lg border border-dashed border-border text-xs text-text-faint hover:border-accent/40 hover:text-accent transition-colors mb-4"
        >
          <Plus size={12} /> Add memory
        </button>
      )}

      {memories.length > 0 && (
        <button
          onClick={() => setConfirmClearAll(true)}
          className="text-xs text-red-400 hover:text-red-400/80 transition-colors"
        >
          Clear all memories
        </button>
      )}

      <ConfirmModal
        open={!!deleteTarget}
        title="Delete memory"
        description={deleteTarget ? `Are you sure you want to delete "${deleteTarget.key}"? This cannot be undone.` : ""}
        confirmLabel="Delete"
        danger
        onConfirm={async () => { if (deleteTarget) await remove(deleteTarget.id); setDeleteTarget(null); }}
        onCancel={() => setDeleteTarget(null)}
      />

      <ConfirmModal
        open={confirmClearAll}
        title="Clear all memories"
        description="This deletes everything Prompt AI remembers about you. This cannot be undone."
        confirmLabel="Clear all"
        danger
        onConfirm={async () => { await clearAll(); setConfirmClearAll(false); }}
        onCancel={() => setConfirmClearAll(false)}
      />
    </div>
  );
}
