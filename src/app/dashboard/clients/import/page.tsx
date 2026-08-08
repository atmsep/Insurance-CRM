import { ImportForm } from "../import-form";

export default function ImportClientsPage() {
  return (
    <div className="flex max-w-2xl flex-col gap-6">
      <h1 className="text-2xl font-semibold">Εισαγωγή πελατών από CSV</h1>
      <p className="text-sm text-muted-foreground">
        Το αρχείο πρέπει να είναι CSV (αποθήκευση από Excel/Google Sheets ως &quot;CSV UTF-8&quot;)
        με πρώτη γραμμή επικεφαλίδες. Υποστηριζόμενες στήλες:{" "}
        <code className="rounded bg-muted px-1 py-0.5 text-xs">
          client_type, first_name, last_name, company_name, afm, phone_mobile, email, address_city
        </code>
        . Για φυσικό πρόσωπο συμπλήρωσε first_name/last_name, για νομικό company_name (το
        client_type συμπληρώνεται αυτόματα αν λείπει). Μέχρι 500 γραμμές ανά αρχείο.
      </p>
      <ImportForm />
    </div>
  );
}
