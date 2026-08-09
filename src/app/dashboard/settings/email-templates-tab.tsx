"use client";

import { Fragment, useState, useTransition } from "react";
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

const MERGE_FIELDS_HINT =
  "Διαθέσιμα πεδία: {{client_name}}, {{policy_number}}, {{line_name}}, {{carrier_name}}, {{end_date}}, {{days_remaining}}, {{agency_name}}";

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
      <p className="text-xs text-muted-foreground">{MERGE_FIELDS_HINT}</p>
      <div className="flex flex-col gap-2">
        <Label htmlFor={`name_${template.id}`}>Όνομα</Label>
        <Input id={`name_${template.id}`} name="name" defaultValue={template.name} required />
      </div>
      <div className="flex flex-col gap-2">
        <Label htmlFor={`subject_${template.id}`}>Θέμα</Label>
        <Input id={`subject_${template.id}`} name="subject" defaultValue={template.subject} required />
      </div>
      <div className="flex flex-col gap-2">
        <Label htmlFor={`body_${template.id}`}>Κείμενο</Label>
        <Textarea id={`body_${template.id}`} name="body" rows={6} defaultValue={template.body} required />
      </div>
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
        <p className="text-xs text-muted-foreground">{MERGE_FIELDS_HINT}</p>
        <div className="flex flex-col gap-2">
          <Label htmlFor="new_name">Όνομα</Label>
          <Input id="new_name" name="name" required className="max-w-sm" />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="new_subject">Θέμα</Label>
          <Input id="new_subject" name="subject" required className="max-w-sm" />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="new_body">Κείμενο</Label>
          <Textarea id="new_body" name="body" rows={6} required className="max-w-lg" />
        </div>
        <Button type="submit" className="w-fit">
          Προσθήκη προτύπου
        </Button>
      </form>
    </div>
  );
}
