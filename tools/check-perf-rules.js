// Δικλείδα για τον γενικό κανόνα απόδοσης (βλ. src/lib/list-page/window.ts).
// Ίδια φιλοσοφία με το event trigger της migration 0107 για το RLS: ο
// κανόνας δεν αρκεί να γραφτεί σε σχόλιο — πρέπει να μη μπορεί να
// παραβιαστεί σιωπηλά.
//
// Χρήση:  node tools/check-perf-rules.js
// Έξοδος: 0 αν όλα καλά, 1 με αναφορά παραβάσεων.
//
// Δύο κανόνες, και οι δύο από πραγματικά σφάλματα που βρέθηκαν μετρώντας:
//
// 1. ΣΕΙΡΙΑΚΟΣ ΒΡΟΧΟΣ ΜΕ ΕΡΩΤΗΜΑ ΜΕΣΑ — κάθε 1.000 γραμμές είναι μία ακόμα
//    διαδρομή προς τη βάση, οπότε ο χρόνος μεγαλώνει γραμμικά με τα
//    δεδομένα. Ό,τι χρειάζεται άθροισμα το αθροίζει η βάση.
// 2. ΑΝΕΛΕΓΚΤΟ .rpc() — το `const { data } = await admin.rpc(...)` χωρίς
//    έλεγχο `error` έκανε ένα statement timeout να εμφανίζεται ως
//    «Σύνολα: 0,00 €» πάνω από 43.685 γραμμές.

const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..", "src");
const EXTS = new Set([".ts", ".tsx"]);

// Αρχεία που έχουν βάσιμο λόγο να παραβαίνουν έναν κανόνα, με τον λόγο
// γραμμένο δίπλα. Κάθε προσθήκη εδώ είναι συνειδητή απόφαση, όχι παράβλεψη.
const ALLOWED = {
  // Οι εξαγωγές είναι background download με ρητό ανώτατο όριο, όχι σελίδα
  // που περιμένει άνθρωπος — εκεί η σελιδοποίηση κατά κομμάτια είναι σωστή.
  "app/dashboard/reports/production/data.ts": ["serial-query-loop"],
  "app/dashboard/policies/export/route.ts": ["serial-query-loop"],
  "app/dashboard/tickets/export/route.ts": ["serial-query-loop"],
  "app/api/cron/celebrations/route.ts": ["serial-query-loop"],
  // Η εισαγωγή αρχείων γράφει γραμμή-γραμμή μέσα σε συναλλαγή· δεν είναι
  // ανάγνωση για εμφάνιση.
  "app/dashboard/settings/import-run-actions.ts": ["serial-query-loop"],
  // Τα cron τρέχουν στο παρασκήνιο και κάνουν ΓΡΑΨΙΜΟ ανά γραμμή (στέλνουν
  // email, γράφουν activity_log) — δεν υπάρχει «άθροισε στη βάση» εδώ.
  "app/api/cron/kteo-reminders/route.ts": ["serial-query-loop"],
  "app/api/cron/renewal-emails/route.ts": ["serial-query-loop"],
  // Μαζική εισαγωγή πελατών και δημιουργία ανταμοιβών σύστασης: γράψιμο ανά
  // γραμμή, με πλήθος που ορίζει ο χρήστης τη στιγμή της ενέργειας.
  "app/dashboard/clients/actions.ts": ["serial-query-loop"],
  "app/dashboard/clients/referral-reward-actions.ts": ["serial-query-loop"],
  // Επανυπολογισμός προμηθειών μιας δόσης μετά από επεξεργασία — λίγες
  // γραμμές, δεμένες σε ένα συμβόλαιο, όχι σάρωση.
  "app/dashboard/policies/actions.ts": ["serial-query-loop"],
  // Πίνακες αναφοράς (τράπεζες, κατηγορίες κλπ): δεκάδες γραμμές, όχι
  // πίνακας που μεγαλώνει με τη δουλειά του γραφείου.
  "app/dashboard/settings/lookup-actions.ts": ["serial-query-loop"],
  // Το έντυπο απόδειξης δέχεται ρητή λίστα id με ανώτατο όριο 2.000 — δεν
  // σαρώνει, διαβάζει ακριβώς ό,τι ζητήθηκε.
  "app/remittance-receipt/page.tsx": ["serial-query-loop"],
  // next_receipt_number: η αποτυχία έχει ΤΕΚΜΗΡΙΩΜΕΝΗ εναλλακτική στη
  // γραμμή από πάνω (η απόδειξη μένει χωρίς αριθμό), δεν είναι σιωπηλή.
  //
  // recomputed-rollup: εξετάστηκαν ένα προς ένα και ΔΕΝ είναι το ίδιο νούμερο
  // με το uncollected_amount της 0118:
  //  * getPolicyMovements — υπολογίζει `σύνολο μείον εισπραχθέντα`, δηλαδή
  //    ΣΥΜΨΗΦΙΖΕΙ τυχόν φιλοδώρημα μιας δόσης με το υπόλοιπο άλλης, και
  //    πέφτει πίσω στο premium_gross όταν δεν υπάρχουν δόσεις. Η στήλη
  //    κόβει στο μηδέν ΑΝΑ ΔΟΣΗ. Διαφορετικό νούμερο — δεν αλλάζει σιωπηλά.
  //  * collectInstallmentPayment — διαβάζει δόσεις για να σπάσει μια μερική
  //    πληρωμή, δεν αθροίζει τίποτα.
  "app/dashboard/policies/movements-actions.ts": ["unchecked-rpc", "recomputed-rollup"],
  // Υπόλοιπο ανά ΣΥΜΒΟΛΑΙΟ (τελευταία κίνηση ή legacy διαδρομή), όχι ανά
  // κίνηση. Άλλο ερώτημα, άλλη απάντηση.
  "app/dashboard/policies/balance.ts": ["recomputed-rollup"],
  // Το Ταμείο χρειάζεται τις ΓΡΑΜΜΕΣ των δόσεων, μία-μία, για να δώσει σε
  // καθεμία δικό της κουμπί είσπραξης. Δεν υπολογίζει άθροισμα.
  "app/dashboard/cash-register/page.tsx": ["recomputed-rollup"],
};

// ΓΝΩΣΤΟ ΧΡΕΟΣ — σελίδες που παραβαίνουν τον κανόνα και ΠΡΕΠΕΙ να
// μεταφερθούν, όχι να εξαιρεθούν. Είναι εδώ ώστε ο έλεγχος να μπορεί να
// τρέχει στο build από σήμερα και να πιάνει ΚΑΘΕ ΝΕΑ παράβαση, αντί να
// περιμένει να καθαρίσουν όλες πρώτα. Κάθε γραμμή που φεύγει από εδώ είναι
// μια σελίδα λιγότερο που θα κολλήσει καθώς μεγαλώνουν τα δεδομένα.
const KNOWN_DEBT = new Set([
  // Άδειο: και οι πέντε σελίδες μεταφέρθηκαν (migrations 0113-0117).
]);

function walk(dir, out = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name !== "node_modules") walk(full, out);
    } else if (EXTS.has(path.extname(entry.name))) {
      out.push(full);
    }
  }
  return out;
}

function relOf(file) {
  return path.relative(ROOT, file).split(path.sep).join("/");
}

function isAllowed(file, rule) {
  return (ALLOWED[relOf(file)] ?? []).includes(rule);
}

const violations = [];

for (const file of walk(ROOT)) {
  const src = fs.readFileSync(file, "utf8");
  const lines = src.split("\n");

  // --- Κανόνας 1: βρόχος που περιέχει await σε ερώτημα Supabase.
  if (!isAllowed(file, "serial-query-loop")) {
    for (let i = 0; i < lines.length; i++) {
      if (!/^\s*(for|while)\s*\(/.test(lines[i])) continue;
      // Το σώμα του βρόχου: μέχρι να κλείσει το άγκιστρο στο ίδιο βάθος.
      const indent = lines[i].match(/^\s*/)[0].length;
      let body = "";
      for (let j = i + 1; j < lines.length; j++) {
        const cur = lines[j];
        if (cur.trim() === "}" && cur.match(/^\s*/)[0].length <= indent) break;
        body += cur + "\n";
      }
      // Ό,τι κάνει await ΚΑΙ αγγίζει ερώτημα. Ο έλεγχος «await σε μεταβλητή
      // που λέγεται supabase/admin/query» ξέφευγε όταν το ερώτημα περνούσε
      // μέσα από βοηθητική συνάρτηση (π.χ. applyRemittanceFilters).
      if (/\bawait\b/.test(body) && /\.(select|range|rpc)\(/.test(body)) {
        violations.push({
          rule: "serial-query-loop",
          file: relOf(file),
          line: i + 1,
          text: lines[i].trim(),
          why: "Βρόχος με ερώτημα μέσα: ο χρόνος μεγαλώνει γραμμικά με τα δεδομένα. Άθροισε στη βάση.",
        });
      }
    }
  }

  // --- Κανόνας 2: .rpc() του οποίου το error δεν ελέγχεται.
  if (!isAllowed(file, "unchecked-rpc")) {
    for (let i = 0; i < lines.length; i++) {
      if (!/\.rpc\(/.test(lines[i])) continue;
      // Η καταστροφή μπορεί να είναι στην ίδια ή στην προηγούμενη γραμμή
      // (`const { data } = await admin` \n `.rpc(...)`).
      const around = (lines[i - 1] ?? "") + lines[i];
      const destructure = around.match(/const\s*\{([^}]*)\}\s*=/);
      if (!destructure) continue;
      if (!/\berror\b/.test(destructure[1])) {
        violations.push({
          rule: "unchecked-rpc",
          file: relOf(file),
          line: i + 1,
          text: lines[i].trim(),
          why: "Το .rpc() χωρίς έλεγχο error εμφανίζει ένα timeout ως 0,00 €.",
        });
      }
    }
  }

  // --- Κανόνας 3: μην ξαναϋπολογίζεις ό,τι είναι ήδη στήλη.
  //
  // Το «πόση προμήθεια έχει αυτή η κίνηση» και το «πόσο ανείσπρακτο έχει»
  // απαντιόνταν σε οκτώ σημεία με αντιγραμμένη λογική. Πλέον είναι στήλες
  // (migration 0118), συντηρούμενες από ΕΝΑ trigger. Αν ξαναεμφανιστεί ο
  // υπολογισμός, το build κόβει — αλλιώς σε έναν χρόνο θα υπάρχουν πάλι
  // οκτώ εκδοχές που διαφωνούν.
  if (!isAllowed(file, "recomputed-rollup")) {
    for (let i = 0; i < lines.length; i++) {
      const l = lines[i];
      // Άθροιση προμηθειών ανά κίνηση/δόση στον κώδικα της εφαρμογής.
      const resolvesCommission =
        /commission_amount/.test(l) && /\.(select|from)\(/.test(l) && /commissions/.test(l);
      // Άθροιση υπολοίπων δόσεων για να βγει «ανείσπρακτο ανά κίνηση».
      const resolvesUncollected =
        /movement_id/.test(l) && /paid_amount/.test(l) && /\.select\(/.test(l);
      if (resolvesCommission || resolvesUncollected) {
        violations.push({
          rule: "recomputed-rollup",
          file: relOf(file),
          line: i + 1,
          text: l.trim(),
          why:
            "Ήδη στήλη: policy_movements.outgoing_commission_amount / .uncollected_amount (0118). " +
            "Διάβασέ την — μην ξαναγράφεις τη λογική.",
        });
      }
    }
  }
}

const known = violations.filter((v) => KNOWN_DEBT.has(`${v.file}:${v.rule}`));
const fresh = violations.filter((v) => !KNOWN_DEBT.has(`${v.file}:${v.rule}`));

// Καθαρισμένο χρέος που ξέχασε κανείς να βγάλει από τη λίστα: το λέμε, αλλά
// δεν κόβουμε το build γι' αυτό.
const stale = [...KNOWN_DEBT].filter(
  (entry) => !violations.some((v) => `${v.file}:${v.rule}` === entry),
);

if (known.length) {
  console.log(`Κανόνες απόδοσης: ${known.length} γνωστές εκκρεμότητες προς μεταφορά:`);
  for (const v of known) console.log(`  - src/${v.file}:${v.line}`);
  console.log("");
}
if (stale.length) {
  console.log("Καθάρισαν — βγάλ' τα από το KNOWN_DEBT:");
  for (const e of stale) console.log(`  - ${e}`);
  console.log("");
}

if (fresh.length === 0) {
  console.log("Κανόνες απόδοσης: OK — καμία νέα παράβαση.");
  process.exit(0);
}

console.error(`Κανόνες απόδοσης: ${fresh.length} ΝΕΕΣ παραβάσεις\n`);
for (const v of fresh) {
  console.error(`  [${v.rule}] src/${v.file}:${v.line}`);
  console.error(`    ${v.text}`);
  console.error(`    ${v.why}\n`);
}
console.error("Δες src/lib/list-page/window.ts για τον κανόνα, ή πρόσθεσε ρητή");
console.error("εξαίρεση με αιτιολογία στο ALLOWED του tools/check-perf-rules.js.");
process.exit(1);
