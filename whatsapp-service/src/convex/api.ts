// Referências tipadas para as funções do Convex.
// Este arquivo espelha os nomes das funções definidas em /convex/*.ts do projeto.
export const api = {
  messages: {
    save: "messages:save" as unknown as any,
    updateStatus: "messages:updateStatus" as unknown as any,
    list: "messages:list" as unknown as any,
    analytics: "messages:analytics" as unknown as any,
  },
  contacts: {
    upsert: "contacts:upsert" as unknown as any,
    list: "contacts:list" as unknown as any,
  },
  sessions: {
    upsert: "sessions:upsert" as unknown as any,
    list: "sessions:list" as unknown as any,
    get: "sessions:get" as unknown as any,
  },
  webhooks: {
    create: "webhooks:create" as unknown as any,
    update: "webhooks:update" as unknown as any,
    remove: "webhooks:remove" as unknown as any,
    list: "webhooks:list" as unknown as any,
    listBySession: "webhooks:listBySession" as unknown as any,
  },
  admin: {
    purgeAll: "admin:purgeAll" as unknown as any,
  },
} as const;
