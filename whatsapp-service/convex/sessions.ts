import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

export const upsert = mutation({
  args: {
    sessionId: v.string(),
    name: v.optional(v.string()),
    status: v.string(),
    phone: v.optional(v.string()),
    webhookUrl: v.optional(v.string()),
    webhookEvents: v.optional(v.array(v.string())),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("sessions")
      .withIndex("by_sessionId", (q) => q.eq("sessionId", args.sessionId))
      .first();

    const data = { ...args, updatedAt: Date.now() };

    if (existing) {
      // Evita sobrescrever o webhookUrl caso ele não seja passado no update
      const patchData = Object.fromEntries(Object.entries(data).filter(([_, v]) => v !== undefined));
      await ctx.db.patch(existing._id, patchData);
      return existing._id;
    }

    return ctx.db.insert("sessions", data);
  },
});

export const get = query({
  args: { sessionId: v.string() },
  handler: async (ctx, { sessionId }) => {
    return ctx.db
      .query("sessions")
      .withIndex("by_sessionId", (q) => q.eq("sessionId", sessionId))
      .first();
  },
});

export const list = query({
  args: {},
  handler: async (ctx) => {
    return ctx.db.query("sessions").order("desc").collect();
  },
});
