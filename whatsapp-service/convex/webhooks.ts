import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

export const create = mutation({
  args: {
    name: v.optional(v.string()),
    url: v.string(),
    events: v.array(v.string()),
    sessionIds: v.array(v.string()),
  },
  handler: async (ctx, args) => {
    return ctx.db.insert("webhooks", {
      ...args,
      enabled: true,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });
  },
});

export const update = mutation({
  args: {
    id: v.id("webhooks"),
    name: v.optional(v.string()),
    url: v.optional(v.string()),
    events: v.optional(v.array(v.string())),
    sessionIds: v.optional(v.array(v.string())),
    enabled: v.optional(v.boolean()),
  },
  handler: async (ctx, { id, ...fields }) => {
    const patch = Object.fromEntries(
      Object.entries({ ...fields, updatedAt: Date.now() }).filter(([_, v]) => v !== undefined)
    );
    await ctx.db.patch(id, patch);
    return id;
  },
});

export const remove = mutation({
  args: { id: v.id("webhooks") },
  handler: async (ctx, { id }) => {
    await ctx.db.delete(id);
  },
});

export const list = query({
  args: {},
  handler: async (ctx) => {
    return ctx.db.query("webhooks").order("desc").collect();
  },
});

export const listBySession = query({
  args: { sessionId: v.string() },
  handler: async (ctx, { sessionId }) => {
    const all = await ctx.db.query("webhooks").collect();
    return all.filter((w) => w.enabled && w.sessionIds.includes(sessionId));
  },
});
