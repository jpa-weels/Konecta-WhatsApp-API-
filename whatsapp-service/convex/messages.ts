import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

export const save = mutation({
  args: {
    sessionId: v.string(),
    messageId: v.string(),
    from: v.string(),
    to: v.string(),
    type: v.string(),
    text: v.optional(v.string()),
    timestamp: v.number(),
    direction: v.union(v.literal("inbound"), v.literal("outbound")),
    status: v.optional(v.string()),
    storageId: v.optional(v.id("_storage")),
    mediaUrl: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    // Evita duplicatas pelo messageId
    const existing = await ctx.db
      .query("messages")
      .withIndex("by_messageId", (q) => q.eq("messageId", args.messageId))
      .first();

    if (existing) return existing._id;

    return ctx.db.insert("messages", args);
  },
});

export const updateStatus = mutation({
  args: {
    messageId: v.string(),
    status: v.union(
      v.literal("sent"),
      v.literal("delivered"),
      v.literal("read"),
      v.literal("failed"),
    ),
  },
  handler: async (ctx, { messageId, status }) => {
    const msg = await ctx.db
      .query("messages")
      .withIndex("by_messageId", (q) => q.eq("messageId", messageId))
      .first();

    if (msg) await ctx.db.patch(msg._id, { status });
  },
});

export const list = query({
  args: {
    sessionId: v.string(),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, { sessionId, limit }) => {
    return ctx.db
      .query("messages")
      .withIndex("by_session_timestamp", (q) => q.eq("sessionId", sessionId))
      .order("desc")
      .take(limit ?? 50);
  },
});

export const analytics = query({
  args: { days: v.optional(v.number()) },
  handler: async (ctx, { days = 30 }) => {
    const cutoff = Math.floor((Date.now() - days * 24 * 60 * 60 * 1000) / 1000);
    const msgs = await ctx.db
      .query("messages")
      .withIndex("by_timestamp", (q) => q.gte("timestamp", cutoff))
      .take(100_000);

    let inbound = 0, outbound = 0;
    const byDay: Record<number, { inbound: number; outbound: number }> = {};
    const byType: Record<string, number> = {};
    const bySession: Record<string, { inbound: number; outbound: number }> = {};

    for (const m of msgs) {
      if (m.direction === "inbound") inbound++;
      else outbound++;

      const dayKey = Math.floor(m.timestamp / 86400) * 86400;
      if (!byDay[dayKey]) byDay[dayKey] = { inbound: 0, outbound: 0 };
      byDay[dayKey][m.direction]++;

      byType[m.type] = (byType[m.type] || 0) + 1;

      if (!bySession[m.sessionId]) bySession[m.sessionId] = { inbound: 0, outbound: 0 };
      bySession[m.sessionId][m.direction]++;
    }

    return { total: msgs.length, inbound, outbound, byDay, byType, bySession };
  },
});
