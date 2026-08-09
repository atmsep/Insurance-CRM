"use client";

import { useActionState, useState } from "react";
import { Mail } from "lucide-react";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { sendPolicyEmail, type SendEmailState } from "./actions";

type Template = { id: string; name: string; subject: string; body: string };

function renderTemplateClient(text: string, fields: Record<string, string>) {
  return text.replace(/\{\{(\w+)\}\}/g, (_, key: string) => fields[key] ?? "");
}

export function SendEmailButton({
  policyId,
  clientEmail,
  templates,
  mergeFields,
}: {
  policyId: string;
  clientEmail: string | null;
  templates: Template[];
  mergeFields: Record<string, string>;
}) {
  const [open, setOpen] = useState(false);
  const [templateId, setTemplateId] = useState("");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [state, formAction, pending] = useActionState<SendEmailState, FormData>(
    sendPolicyEmail.bind(null, policyId),
    undefined,
  );

  // Close and reset the form once the send succeeds. Derived during render
  // (comparing against the previous state) rather than in an effect, per
  // https://react.dev/learn/you-might-not-need-an-effect.
  const [handledState, setHandledState] = useState(state);
  if (state !== handledState) {
    setHandledState(state);
    if (state && "success" in state) {
      setOpen(false);
      setTemplateId("");
      setSubject("");
      setBody("");
    }
  }

  if (!clientEmail) return null;

  function selectTemplate(id: string) {
    setTemplateId(id);
    const template = templates.find((t) => t.id === id);
    if (!template) return;
    setSubject(renderTemplateClient(template.subject, mergeFields));
    setBody(renderTemplateClient(template.body, mergeFields));
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <Button
        variant="outline"
        size="icon-sm"
        aria-label="Αποστολή email"
        onClick={() => setOpen(true)}
      >
        <Mail className="size-4" />
      </Button>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Αποστολή email στον πελάτη</DialogTitle>
        </DialogHeader>
        <form action={formAction} className="flex flex-col gap-3">
          <input type="hidden" name="to" value={clientEmail} />
          <p className="text-sm text-muted-foreground">Προς: {clientEmail}</p>

          <div className="flex flex-col gap-2">
            <Label>Πρότυπο</Label>
            <Select value={templateId} onValueChange={(v) => v && selectTemplate(v)}>
              <SelectTrigger className="w-full">
                <SelectValue>
                  {(value: string) =>
                    templates.find((t) => t.id === value)?.name ?? "Επίλεξε πρότυπο (προαιρετικό)"
                  }
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                {templates.map((t) => (
                  <SelectItem key={t.id} value={t.id}>
                    {t.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="email_subject">Θέμα</Label>
            <Input
              id="email_subject"
              name="subject"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              required
            />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="email_body">Κείμενο</Label>
            <Textarea
              id="email_body"
              name="body"
              rows={8}
              value={body}
              onChange={(e) => setBody(e.target.value)}
              required
            />
          </div>

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
