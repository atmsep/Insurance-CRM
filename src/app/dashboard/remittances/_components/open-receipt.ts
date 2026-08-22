"use client";

// Το έντυπο άνοιγε με window.open(href, "_blank") — δηλαδή ΚΑΡΤΕΛΑ στο ίδιο
// παράθυρο, οπότε ο φυλλομετρητής μετέφερε τον χρήστη εκεί και έχανε τη
// λίστα που δούλευε. Εδώ ανοίγει ΞΕΧΩΡΙΣΤΟ παράθυρο: η λίστα μένει άθικτη
// από πίσω με τα φίλτρα και τη θέση της, και το παράθυρο κλείνει μετά την
// εκτύπωση.
//
// Σταθερό όνομα παραθύρου: δεύτερη απόδοση ξαναχρησιμοποιεί το ίδιο
// παράθυρο αντί να γεμίζει η οθόνη με δεκάδες.
const RECEIPT_WINDOW = "remittance-receipt";

export function openReceiptWindow(href: string): Window | null {
  const width = Math.min(1100, window.screen.availWidth - 80);
  const height = Math.min(900, window.screen.availHeight - 80);
  const left = window.screenX + Math.max(0, Math.round((window.outerWidth - width) / 2));
  const top = window.screenY + Math.max(0, Math.round((window.outerHeight - height) / 2));

  return window.open(
    href,
    RECEIPT_WINDOW,
    `popup=yes,width=${width},height=${height},left=${left},top=${top},scrollbars=yes,resizable=yes`,
  );
}

// Οι αποκλειστές αναδυόμενων παραθύρων επιτρέπουν άνοιγμα ΜΟΝΟ μέσα στο
// κλικ του χρήστη. Η απόδοση όμως πρέπει να προηγηθεί (δεν τυπώνουμε
// απόδειξη για κάτι που απέτυχε), και μετά το await το κλικ έχει «λήξει».
// Άρα: άνοιξε άδειο παράθυρο τώρα, γέμισέ το μετά — ή κλείσ' το αν η
// ενέργεια απέτυχε.
export function openReceiptWindowDeferred(): {
  fill: (href: string) => void;
  abort: () => void;
} {
  const win = openReceiptWindow("about:blank");
  return {
    fill: (href) => {
      if (win && !win.closed) win.location.replace(href);
      else openReceiptWindow(href);
    },
    abort: () => {
      if (win && !win.closed) win.close();
    },
  };
}
