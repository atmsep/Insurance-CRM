import { createAdminClient } from "@/lib/supabase/admin";

// Νυχτερινή απόδειξη ότι οι αποθηκευμένες τιμές της migration 0118 δεν
// έχουν ξεφύγει από την αλήθεια.
//
// Ο δομικός κανόνας λέει «ό,τι κοστίζει, υπολογίζεται μία φορά στην
// εγγραφή». Το τίμημα είναι ότι μια τιμή μπορεί να αποκλίνει — trigger που
// δεν έπιασε μια περίπτωση, μαζική εισαγωγή με απενεργοποιημένα triggers,
// χειροκίνητο UPDATE. Χωρίς έλεγχο, η απόκλιση εμφανίζεται μήνες αργότερα
// ως «τα νούμερα δεν βγαίνουν» και κανείς δεν ξέρει από πότε.
//
// Διορθώνει ΚΑΙ ειδοποιεί. Σκέτη διόρθωση θα έκρυβε το πραγματικό ερώτημα:
// ΓΙΑΤΙ ξέφυγε; Η ειδοποίηση φέρνει και δείγμα κινήσεων για να βρεθεί η αιτία.
type RollupCheck = {
  checked: number;
  drifted: number;
  sample_ids: string[] | null;
  stored_commission: string;
  true_commission: string;
  stored_uncollected: string;
  true_uncollected: string;
};

export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization");
  if (process.env.CRON_SECRET && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return new Response("Unauthorized", { status: 401 });
  }

  const supabase = createAdminClient();

  // p_fix = true: εντοπίζει, αναφέρει, και διορθώνει στο ίδιο πέρασμα.
  const { data, error } = await supabase.rpc("check_movement_rollups", { p_fix: true });
  if (error) {
    return Response.json({ error: "Ο έλεγχος απέτυχε: " + error.message }, { status: 500 });
  }

  const result = (Array.isArray(data) ? data[0] : data) as RollupCheck | undefined;
  if (!result) {
    return Response.json({ error: "Ο έλεγχος δεν επέστρεψε αποτέλεσμα." }, { status: 500 });
  }

  const drifted = Number(result.drifted);
  if (drifted === 0) {
    return Response.json({ checked: Number(result.checked), drifted: 0 });
  }

  // Ειδοποιούνται owner/admin: είναι θέμα ακεραιότητας δεδομένων, όχι
  // εργασία συγκεκριμένου συνεργάτη.
  const { data: admins } = await supabase
    .from("agency_users")
    .select("id")
    .in("role", ["owner", "admin"])
    .eq("is_active", true);

  const commDiff = Number(result.true_commission) - Number(result.stored_commission);
  const uncolDiff = Number(result.true_uncollected) - Number(result.stored_uncollected);
  const body =
    `${drifted} από ${result.checked} κινήσεις είχαν λάθος αποθηκευμένο ποσό και διορθώθηκαν. ` +
    `Διαφορά: προμήθειες ${commDiff.toFixed(2)} €, ανείσπρακτα ${uncolDiff.toFixed(2)} €. ` +
    `Δείγμα: ${(result.sample_ids ?? []).slice(0, 3).join(", ") || "—"}`;

  if (admins?.length) {
    await supabase.from("notifications").insert(
      admins.map((a) => ({
        recipient_id: a.id,
        kind: "rollup_drift",
        title: "Βρέθηκαν λάθος αποθηκευμένα ποσά σε κινήσεις",
        body,
        link: "/dashboard/reports",
      })),
    );
  }

  return Response.json({
    checked: Number(result.checked),
    drifted,
    commission_diff: commDiff,
    uncollected_diff: uncolDiff,
    fixed: true,
  });
}
