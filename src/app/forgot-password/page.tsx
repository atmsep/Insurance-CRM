"use client";

import { useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setLoading(true);
    const supabase = createClient();
    // The result is deliberately not surfaced — a "no such account" answer
    // would let anyone probe which emails have logins here.
    await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    setLoading(false);
    setSent(true);
  }

  return (
    <div className="flex flex-1 items-center justify-center bg-muted/40 p-4">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle>Επαναφορά κωδικού</CardTitle>
          <CardDescription>
            Θα σου στείλουμε email με σύνδεσμο για να ορίσεις νέο κωδικό.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {sent ? (
            <div className="flex flex-col gap-4">
              <p className="text-sm">
                Αν το email αντιστοιχεί σε λογαριασμό, θα λάβεις σύνδεσμο επαναφοράς σε λίγα λεπτά.
                Άνοιξε τον σύνδεσμο στην ίδια συσκευή/browser.
              </p>
              <Link href="/login" className="text-sm underline">
                Πίσω στη σύνδεση
              </Link>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="flex flex-col gap-4">
              <div className="flex flex-col gap-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  autoComplete="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>
              <Button type="submit" disabled={loading}>
                {loading ? "Αποστολή..." : "Αποστολή συνδέσμου"}
              </Button>
              <Link href="/login" className="text-sm text-muted-foreground underline">
                Πίσω στη σύνδεση
              </Link>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
