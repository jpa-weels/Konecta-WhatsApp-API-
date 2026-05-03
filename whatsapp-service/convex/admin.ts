import { mutation } from "./_generated/server";

const BATCH = 500;

/**
 * Apaga até BATCH registros por tabela por invocação.
 * Retorna o número de documentos deletados por tabela.
 * Se algum valor for BATCH, ainda há registros — chame novamente.
 */
export const purgeAll = mutation({
  args: {},
  handler: async (ctx) => {
    const tables = ["messages", "contacts", "sessions", "webhooks"] as const;
    const counts: Record<string, number> = {};

    for (const table of tables) {
      const docs = await ctx.db.query(table).take(BATCH);
      counts[table] = docs.length;
      await Promise.all(docs.map((d) => ctx.db.delete(d._id)));
    }

    return counts;
  },
});
