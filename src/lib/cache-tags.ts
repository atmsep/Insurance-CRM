// Central tag names so cached-queries getters and the actions that
// invalidate them can't drift apart — always import from here, never write
// the string literal at either call site.
export const CACHE_TAGS = {
  reports: "reports",
  celebrationTemplates: "celebration-templates",
  agencyUsers: "agency-users",
  agencyProfile: "agency-profile",
  // Πίνακες αναφοράς που διαβάζονται από ΚΑΘΕ σελίδα λίστας για να γεμίσουν
  // τα φίλτρα, αλλά αλλάζουν ελάχιστες φορές τον χρόνο. Χωρίς cache ήταν
  // τρεις διαδρομές προς τη βάση σε κάθε άνοιγμα σελίδας.
  carriers: "carriers",
  insuranceLines: "insurance-lines",
  paymentMethods: "payment-methods",
} as const;
