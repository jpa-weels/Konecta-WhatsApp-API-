import { mutation, query, internalMutation } from "./_generated/server";
import { v } from "convex/values";

/** Gera URL temporária para upload direto ao Convex Storage */
export const generateUploadUrl = mutation({
  args: {},
  handler: async (ctx) => ctx.storage.generateUploadUrl(),
});

/** Retorna URL pública de um arquivo armazenado */
export const getUrl = query({
  args: { storageId: v.id("_storage") },
  handler: async (ctx, { storageId }) => ctx.storage.getUrl(storageId),
});

/** Remove arquivos de mídia com mais de 2 semanas — chamado pelo cron */
export const cleanupOldMedia = internalMutation({
  args: {},
  handler: async (ctx) => {
    const twoWeeksAgo = Math.floor((Date.now() - 14 * 24 * 60 * 60 * 1000) / 1000);

    const old = await ctx.db
      .query("messages")
      .withIndex("by_timestamp", (q) => q.lt("timestamp", twoWeeksAgo))
      .filter((q) => q.neq(q.field("storageId"), undefined))
      .collect();

    let deleted = 0;
    for (const msg of old) {
      if (msg.storageId) {
        try {
          await ctx.storage.delete(msg.storageId);
          await ctx.db.patch(msg._id, { storageId: undefined, mediaUrl: undefined });
          deleted++;
        } catch { /* arquivo pode já ter sido removido */ }
      }
    }

    return { deleted };
  },
});
