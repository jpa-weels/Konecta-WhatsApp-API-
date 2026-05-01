import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  messages: defineTable({
    sessionId: v.string(),
    messageId: v.string(),
    from: v.string(),
    to: v.string(),
    type: v.string(),
    text: v.optional(v.string()),
    timestamp: v.number(),
    direction: v.union(v.literal("inbound"), v.literal("outbound")),
    status: v.optional(v.string()),
  })
    .index("by_session", ["sessionId"])
    .index("by_messageId", ["messageId"])
    .index("by_session_timestamp", ["sessionId", "timestamp"])
    .index("by_timestamp", ["timestamp"]),

  contacts: defineTable({
    sessionId: v.string(),
    jid: v.string(),
    name: v.optional(v.string()),
    phone: v.string(),
    lastSeen: v.optional(v.number()),
  })
    .index("by_session", ["sessionId"])
    .index("by_jid", ["jid"])
    .index("by_session_jid", ["sessionId", "jid"]),

  webhooks: defineTable({
    name: v.optional(v.string()),
    url: v.string(),
    events: v.array(v.string()),
    sessionIds: v.array(v.string()),
    enabled: v.boolean(),
    createdAt: v.number(),
    updatedAt: v.number(),
  }),

  sessions: defineTable({
    sessionId: v.string(),
    name: v.optional(v.string()),
    status: v.string(),
    phone: v.optional(v.string()),
    webhookUrl: v.optional(v.string()),
    webhookEvents: v.optional(v.array(v.string())),
    updatedAt: v.number(),
  })
    .index("by_sessionId", ["sessionId"]),
});
