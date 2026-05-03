import { cronJobs } from "convex/server";
import { internal } from "./_generated/api";

const crons = cronJobs();

// Toda segunda-feira às 3h UTC — apaga arquivos de mídia com mais de 2 semanas
crons.weekly(
  "cleanup media older than 2 weeks",
  { dayOfWeek: "monday", hourUTC: 3, minuteUTC: 0 },
  internal.media.cleanupOldMedia,
  {},
);

export default crons;
