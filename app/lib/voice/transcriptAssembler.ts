// Builds one running transcript out of the events the live socket sends. Each
// phrase is an item. Partial text for a phrase arrives as deltas, then its
// finished text replaces the partial. Phrases can finish out of order, so they
// are kept in the order the server reports and joined at the end.

export type TranscriptEvent =
  | { type: "order"; itemId: string; previousItemId: string | null }
  | { type: "delta"; itemId: string; text: string }
  | { type: "final"; itemId: string; text: string };

interface Item {
  id: string;
  text: string;
  final: boolean;
}

export class TranscriptAssembler {
  private items: Item[] = [];

  apply(event: TranscriptEvent): void {
    if (event.type === "order") {
      if (this.find(event.itemId)) return;
      const item: Item = { id: event.itemId, text: "", final: false };
      const prev = event.previousItemId ? this.items.findIndex((i) => i.id === event.previousItemId) : -1;
      if (event.previousItemId === null) this.items.unshift(item);
      else if (prev >= 0) this.items.splice(prev + 1, 0, item);
      else this.items.push(item);
      return;
    }
    const item = this.find(event.itemId) ?? this.append(event.itemId);
    if (event.type === "delta") {
      if (!item.final) item.text += event.text;
    } else {
      item.text = event.text;
      item.final = true;
    }
  }

  text(): string {
    return this.items
      .map((i) => i.text.trim())
      .filter(Boolean)
      .join(" ");
  }

  // Phrases that have been heard and are still being decoded.
  pending(): number {
    return this.items.filter((i) => !i.final).length;
  }

  hasText(): boolean {
    return this.text().length > 0;
  }

  private find(id: string): Item | undefined {
    return this.items.find((i) => i.id === id);
  }

  private append(id: string): Item {
    const item: Item = { id, text: "", final: false };
    this.items.push(item);
    return item;
  }
}
