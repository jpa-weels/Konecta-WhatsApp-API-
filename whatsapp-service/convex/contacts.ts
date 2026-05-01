import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

export const upsert = mutation({
  args: {
    sessionId: v.string(),
    jid: v.string(),
    name: v.optional(v.string()),
    phone: v.string(),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("contacts")
      .withIndex("by_session_jid", (q) =>
        q.eq("sessionId", args.sessionId).eq("jid", args.jid),
      )
      .first();

    if (existing) {
      await ctx.db.patch(existing._id, {
        name: args.name ?? existing.name,
        lastSeen: Date.now(),
      });
      return existing._id;
    }

    return ctx.db.insert("contacts", { ...args, lastSeen: Date.now() });
  },
});

export const list = query({
  args: { sessionId: v.string() },
  handler: async (ctx, { sessionId }) => {
    return ctx.db
      .query("contacts")
      .withIndex("by_session", (q) => q.eq("sessionId", sessionId))
      .collect();
  },
});
