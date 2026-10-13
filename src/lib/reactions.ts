export interface ReactionEntry {
  userId?: string | { _id?: string } | null;
  emoji: string;
}

export interface ReactionChip {
  emoji: string;
  count: number;
  mine: boolean;
}

// The server stores one entry per (user, emoji); the UI shows one chip per emoji.
export function groupReactions(reactions: ReactionEntry[] | undefined, currentUserId?: string): ReactionChip[] {
  const byEmoji = new Map<string, ReactionChip>();
  for (const r of reactions || []) {
    const chip = byEmoji.get(r.emoji) || { emoji: r.emoji, count: 0, mine: false };
    chip.count += 1;
    const owner = typeof r.userId === "object" && r.userId ? r.userId._id : r.userId;
    if (currentUserId && owner && String(owner) === String(currentUserId)) chip.mine = true;
    byEmoji.set(r.emoji, chip);
  }
  return [...byEmoji.values()];
}
