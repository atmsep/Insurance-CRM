"use client";

import { useActionState, useState } from "react";
import { MessageCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { sendPolicyViber, type SendMessageState } from "./actions";

export function SendViberButton({
  policyId,
  clientPhone,
}: {
  policyId: string;
  clientPhone: string | null;
}) {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const [state, formAction, pending] = useActionState<SendMessageState, FormData>(
    sendPolicyViber.bind(null, policyId),
    undefined,
  );

  const [handledState, setHandledState] = useState(state);
  if (state !== handledState) {
    setHandledState(state);
    if (state && "success" in state) {
      setOpen(false);
      setText("");
    }
  }

  if (!clientPhone) return null;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <Button
        variant="outline"
        size="icon-sm"
        aria-label="Αποστολή Viber"
        onClick={() => setOpen(true)}
      >
        <MessageCircle className="size-4" />
      </Button>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Αποστολή μηνύματος Viber στον πελάτη</DialogTitle>
        </DialogHeader>
        <form action={formAction} className="flex flex-col gap-3">
          <input type="hidden" name="to" value={clientPhone} />
          <p className="text-sm text-muted-foreground">Προς: {clientPhone}</p>

          <Textarea
            name="text"
            rows={5}
            value={text}
            onChange={(e) => setText(e.target.value)}
            required
          />

          {state && "error" in state && <p className="text-sm text-destructive">{state.error}</p>}
          {state && "success" in state && <p className="text-sm text-success">{state.success}</p>}

          <DialogFooter>
            <Button type="submit" disabled={pending}>
              {pending ? "Αποστολή..." : "Αποστολή"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
