"use client";

import { Fragment, useRef, useState } from "react";
import { useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useFormValues } from "@/hooks/use-form-values";
import {
  createEmailTemplate,
  updateEmailTemplate,
  toggleEmailTemplateActive,
} from "./actions";

type EmailTemplate = {
  id: string;
  name: string;
  subject: string;
  body: string;
  is_system: boolean;
  is_active: boolean;
};

// Greek labels for what each merge field actually substitutes in — shown
// on the clickable chips so the person writing the template doesn't have
// to remember/guess what {{days_remaining}} etc. means.
const MERGE_FIELDS: { token: string; label: string }[] = [
  { token: "client_name", label: "Όνομα πελάτη" },
  { token: "policy_number", label: "Αριθμός συμβολαίου" },
  { token: "line_name", label: "Κλάδος ασφάλισης" },
  { token: "carrier_name", label: "Ασφαλιστική εταιρεία" },
  { token: "end_date", label: "Ημερομηνία λήξης" },
  { token: "days_remaining", label: "Ημέρες που απομένουν" },
  { token: "agency_name", label: "Όνομα γραφείου" },
];

// Shared by both the "new template" form and each row's edit form: renders
// the Όνομα/Θέμα/Κείμενο fields plus a row of clickable merge-field chips
// that insert {{token}} at the cursor position of whichever of Θέμα/Κείμενο
// was last focused, instead of just always appending to the end.
function TemplateFields({
  idPrefix,
  initialName,
  initialSubject,
  initialBody,
}: {
  idPrefix: string;
  initialName: string;
  initialSubject: string;
  initialBody: string;
}) {
  const { values, setValue, field } = useFormValues({
    name: initialName,
    subject: initialSubject,
    body: initialBody,
  });
  const subjectRef = useRef<HTMLInputElement>(null);
  const bodyRef = useRef<HTMLTextAreaElement>(null);
  const [activeField, setActiveField] = useState<"subject" | "body">("body");

  function insertField(token: string) {
    const text = `{{${token}}}`;
    const ref = activeField === "subject" ? subjectRef.current : bodyRef.current;
    const current = values[activeField] ?? "";
    const start = ref?.selectionStart ?? current.length;
    const end = ref?.selectionEnd ?? current.length;
    const next = current.slice(0, start) + text + current.slice(end);
    setValue(activeField, next);

    // Restore focus and put the cursor right after the inserted token —
    // has to wait a tick for the controlled value to actually reach the DOM.
    requestAnimationFrame(() => {
      ref?.focus();
      const pos = start + text.length;
      ref?.setSelectionRange(pos, pos);
    });
  }

  return (
    <>
      <div className="flex flex-col gap-1.5">
        <Label className="text-xs text-muted-foreground">
          Πάτησε ένα πεδίο για να το προσθέσεις στο Θέμα ή στο Κείμενο (στο σημείο του κέρσορα)
        </Label>
        <div className="flex flex-wrap gap-1.5">
          {MERGE_FIELDS.map((f) => (
            <Button
              key={f.token}
              type="button"
              variant="outline"
              size="xs"
              onClick={() => insertField(f.token)}
            >
              {f.label}
            </Button>
          ))}
        </div>
      </div>
      <div className="flex flex-col gap-2">
        <Label htmlFor={`${idPrefix}_name`}>Όνομα</Label>
        <Input id={`${idPrefix}_name`} name="name" required {...field("name")} />
      </div>
      <div className="flex flex-col gap-2">
        <Label htmlFor={`${idPrefix}_subject`}>Θέμα</Label>
        <Input
          id={`${idPrefix}_subject`}
          name="subject"
          required
          ref={subjectRef}
          onFocus={() => setActiveField("subject")}
          {...field("subject")}
        />
      </div>
      <div className="flex flex-col gap-2">
        <Label htmlFor={`${idPrefix}_body`}>Κείμενο</Label>
        <Textarea
          id={`${idPrefix}_body`}
          name="body"
          rows={6}
          required
          ref={bodyRef}
          onFocus={() => setActiveField("body")}
          {...field("body")}
        />
      </div>
    </>
  );
}

function EditTemplateForm({ template, onDone }: { template: EmailTemplate; onDone: () => void }) {
  const updateAction = updateEmailTemplate.bind(null, template.id);
  return (
    <form
      action={async (formData) => {
        await updateAction(formData);
        onDone();
      }}
      className="flex flex-col gap-3 rounded-md border bg-muted/30 p-3"
    >
      <TemplateFields
        idPrefix={`edit_${template.id}`}
        initialName={template.name}
        initialSubject={template.subject}
        initialBody={template.body}
      />
      <div className="flex gap-2">
        <Button type="submit" size="sm">
          Αποθήκευση
        </Button>
        <Button type="button" size="sm" variant="ghost" onClick={onDone}>
          Άκυρο
        </Button>
      </div>
    </form>
  );
}

export function EmailTemplatesTab({ templates }: { templates: EmailTemplate[] }) {
  const [pending, startTransition] = useTransition();
  const [editingId, setEditingId] = useState<string | null>(null);

  return (
    <div className="flex flex-col gap-6">
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Όνομα</TableHead>
              <TableHead>Τύπος</TableHead>
              <TableHead>Κατάσταση</TableHead>
              <TableHead />
            </TableRow>
          </TableHeader>
          <TableBody>
            {templates.length ? (
              templates.map((template) => (
                <Fragment key={template.id}>
                  <TableRow>
                    <TableCell>{template.name}</TableCell>
                    <TableCell>
                      <Badge variant="outline">{template.is_system ? "Σύστημα" : "Προσαρμοσμένο"}</Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant={template.is_active ? "default" : "outline"}>
                        {template.is_active ? "Ενεργό" : "Ανενεργό"}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => setEditingId(editingId === template.id ? null : template.id)}
                        >
                          {editingId === template.id ? "Κλείσιμο" : "Επεξεργασία"}
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={pending}
                          onClick={() =>
                            startTransition(() =>
                              toggleEmailTemplateActive(template.id, !template.is_active),
                            )
                          }
                        >
                          {template.is_active ? "Απενεργοποίηση" : "Ενεργοποίηση"}
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                  {editingId === template.id && (
                    <TableRow>
                      <TableCell colSpan={4}>
                        <EditTemplateForm template={template} onDone={() => setEditingId(null)} />
                      </TableCell>
                    </TableRow>
                  )}
                </Fragment>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={4} className="text-center text-muted-foreground">
                  Δεν υπάρχουν πρότυπα.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      <form action={createEmailTemplate} className="flex flex-col gap-3">
        <p className="text-sm font-medium">Νέο πρότυπο</p>
        <TemplateFields idPrefix="new" initialName="" initialSubject="" initialBody="" />
        <Button type="submit" className="w-fit">
          Προσθήκη προτύπου
        </Button>
      </form>
    </div>
  );
}
