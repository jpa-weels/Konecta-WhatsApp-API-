import { mutation } from "./_generated/server";

/** Apaga todos os registros de messages, contacts, sessions e webhooks. */
export const purgeAll = mutation({
  args: {},
  handler: async (ctx) => {
    const tables = ["messages", "contacts", "sessions", "webhooks"] as const;

    const counts: Record<string, number> = {};

    for (const table of tables) {
      const docs = await ctx.db.query(table).collect();
      counts[table] = docs.length;
      await Promise.all(docs.map((d) => ctx.db.delete(d._id)));
    }

    return counts;
  },
});
