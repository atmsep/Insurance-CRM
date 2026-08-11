"use client";

import { useActionState, useState, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { sendCelebrationWish, type SendWishState } from "./actions";

export function CelebrationWishDialog({
  taskId,
  clientEmail,
  initialSubject,
  initialBody,
  children,
}: {
  taskId: string;
  clientEmail: string | null;
  initialSubject: string;
  initialBody: string;
  // A plain (server-renderable) node, not a render-prop function — this
  // component is rendered directly from Server Components in a few places,
  // and functions can't cross the server/client boundary as props. The
  // click handler lives on the wrapper below instead.
  children: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const [subject, setSubject] = useState(initialSubject);
  const [body, setBody] = useState(initialBody);
  const [state, formAction, pending] = useActionState<SendWishState, FormData>(
    sendCelebrationWish.bind(null, taskId),
    undefined,
  );

  // Close the dialog once the send succeeds — derived during render
  // (comparing against the previous state) rather than in an effect, per
  // https://react.dev/learn/you-might-not-need-an-effect.
  const [handledState, setHandledState] = useState(state);
  if (state !== handledState) {
    setHandledState(state);
    if (state && "success" in state) setOpen(false);
  }

  return (
    <>
      <span
        role="button"
        tabIndex={0}
        onClick={() => setOpen(true)}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") setOpen(true);
        }}
        className="contents cursor-pointer"
      >
        {children}
      </span>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Αποστολή ευχών</DialogTitle>
          </DialogHeader>
          {clientEmail ? (
            <form action={formAction} className="flex flex-col gap-3">
              <p className="text-sm text-muted-foreground">Προς: {clientEmail}</p>
              <div className="flex flex-col gap-2">
                <Label htmlFor={`wish-subject-${taskId}`}>Θέμα</Label>
                <Input
                  id={`wish-subject-${taskId}`}
                  name="subject"
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  required
                />
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor={`wish-body-${taskId}`}>Κείμενο</Label>
                <Textarea
                  id={`wish-body-${taskId}`}
                  name="body"
                  rows={6}
                  value={body}
                  onChange={(e) => setBody(e.target.value)}
                  required
                />
              </div>
              {state && "error" in state && <p className="text-sm text-destructive">{state.error}</p>}
              {state && "success" in state && <p className="text-sm text-success">{state.success}</p>}
              <DialogFooter>
                <Button type="submit" disabled={pending}>
                  {pending ? "Αποστολή..." : "Αποστολή ευχών"}
                </Button>
              </DialogFooter>
            </form>
          ) : (
            <p className="text-sm text-muted-foreground">
              Ο πελάτης δεν έχει καταχωρημένο email — δεν είναι δυνατή η αποστολή.
            </p>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
