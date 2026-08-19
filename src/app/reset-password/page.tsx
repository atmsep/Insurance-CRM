"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

// Landing page of the recovery-email link. The browser client's
// detectSessionInUrl picks the recovery session up from the URL on load
// (hash tokens or PKCE code alike) — once a session exists, the form just
// calls updateUser({ password }).
export default function ResetPasswordPage() {
  const router = useRouter();
  const [ready, setReady] = useState<"checking" | "ok" | "no-session">("checking");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const supabase = createClient();
    let cancelled = false;
    // PKCE links arrive as ?code= and the client exchanges them itself; but
    // implicit-flow recovery links (GoTrue /verify without a PKCE verifier)
    // land with the tokens in the URL hash, which the PKCE-configured
    // browser client ignores — pick those up explicitly.
    const hash = new URLSearchParams(window.location.hash.replace(/^#/, ""));
    const accessToken = hash.get("access_token");
    const refreshToken = hash.get("refresh_token");
    if (accessToken && refreshToken) {
      void supabase.auth.setSession({ access_token: accessToken, refresh_token: refreshToken });
    }
    // The URL exchange is asynchronous — poll briefly instead of trusting
    // the very first getSession() snapshot.
    const started = Date.now();
    const timer = setInterval(async () => {
      const { data } = await supabase.auth.getSession();
      if (cancelled) return;
      if (data.session) {
        clearInterval(timer);
        setReady("ok");
      } else if (Date.now() - started > 8000) {
        clearInterval(timer);
        setReady("no-session");
      }
    }, 400);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, []);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    if (password.length < 8) {
      setError("Ο κωδικός πρέπει να έχει τουλάχιστον 8 χαρακτήρες.");
      return;
    }
    if (password !== confirm) {
      setError("Οι κωδικοί δεν ταιριάζουν.");
      return;
    }
    setLoading(true);
    const supabase = createClient();
    const { error: updateError } = await supabase.auth.updateUser({ password });
    setLoading(false);
    if (updateError) {
      setError("Σφάλμα: " + updateError.message);
      return;
    }
    router.push("/dashboard");
    router.refresh();
  }

  return (
    <div className="flex flex-1 items-center justify-center bg-muted/40 p-4">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle>Νέος κωδικός</CardTitle>
          <CardDescription>Όρισε τον νέο κωδικό του λογαριασμού σου.</CardDescription>
        </CardHeader>
        <CardContent>
          {ready === "checking" && <p className="text-sm text-muted-foreground">Έλεγχος συνδέσμου...</p>}
          {ready === "no-session" && (
            <div className="flex flex-col gap-3 text-sm">
              <p className="text-destructive">
                Ο σύνδεσμος δεν είναι έγκυρος ή έχει λήξει. Ζήτησε νέο σύνδεσμο επαναφοράς — και
                άνοιξέ τον στην ίδια συσκευή/browser από όπου έκανες την αίτηση.
              </p>
              <Link href="/forgot-password" className="underline">
                Νέα αίτηση επαναφοράς
              </Link>
            </div>
          )}
          {ready === "ok" && (
            <form onSubmit={handleSubmit} className="flex flex-col gap-4">
              <div className="flex flex-col gap-2">
                <Label htmlFor="password">Νέος κωδικός</Label>
                <Input
                  id="password"
                  type="password"
                  autoComplete="new-password"
                  minLength={8}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="confirm">Επιβεβαίωση κωδικού</Label>
                <Input
                  id="confirm"
                  type="password"
                  autoComplete="new-password"
                  minLength={8}
                  required
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                />
              </div>
              {error && <p className="text-sm text-destructive">{error}</p>}
              <Button type="submit" disabled={loading}>
                {loading ? "Αποθήκευση..." : "Αποθήκευση κωδικού"}
              </Button>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
