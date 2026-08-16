// Central tag names so cached-queries getters and the actions that
// invalidate them can't drift apart — always import from here, never write
// the string literal at either call site.
export const CACHE_TAGS = {
  reports: "reports",
  celebrationTemplates: "celebration-templates",
  agencyUsers: "agency-users",
} as const;
