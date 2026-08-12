"use client";

import { useState, useTransition } from "react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { updateTicketStatus } from "./actions";
import { TICKET_STATUS_LABELS } from "./ticket-labels";
import type { TicketStatus } from "@/lib/database.types";

const STATUS_OPTIONS = Object.entries(TICKET_STATUS_LABELS) as [TicketStatus, string][];
const CLOSING_STATUSES = new Set<TicketStatus>(["resolved", "closed"]);

export function StatusSelect({
  ticketId,
  clientId,
  status,
  resolutionNotes,
}: {
  ticketId: string;
  clientId: string;
  status: TicketStatus;
  resolutionNotes?: string | null;
}) {
  const [pending, startTransition] = useTransition();
  const [open, setOpen] = useState(false);
  const [pendingStatus, setPendingStatus] = useState<TicketStatus | null>(null);
  const [notes, setNotes] = useState(resolutionNotes ?? "");

  function handleChange(value: TicketStatus) {
    if (CLOSING_STATUSES.has(value)) {
      setPendingStatus(value);
      setNotes(resolutionNotes ?? "");
      setOpen(true);
      return;
    }
    startTransition(() => updateTicketStatus(ticketId, clientId, value));
  }

  function confirm() {
    if (!pendingStatus || !notes.trim()) return;
    startTransition(() => updateTicketStatus(ticketId, clientId, pendingStatus, notes.trim()));
    setOpen(false);
  }

  return (
    <>
      <Select
        value={status}
        disabled={pending}
        onValueChange={(value) => {
          if (value) handleChange(value as TicketStatus);
        }}
      >
        <SelectTrigger className="w-40">
          <SelectValue>{(value: TicketStatus) => TICKET_STATUS_LABELS[value] ?? value}</SelectValue>
        </SelectTrigger>
        <SelectContent>
          {STATUS_OPTIONS.map(([value, label]) => (
            <SelectItem key={value} value={value}>
              {label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              {pendingStatus === "resolved" ? "Επίλυση αιτήματος" : "Κλείσιμο αιτήματος"}
            </DialogTitle>
          </DialogHeader>
          <div className="flex flex-col gap-2">
            <Label htmlFor={`resolution-notes-${ticketId}`}>Τι έγινε;</Label>
            <Textarea
              id={`resolution-notes-${ticketId}`}
              rows={3}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Σύντομη περιγραφή της διεκπεραίωσης..."
              required
            />
          </div>
          <DialogFooter>
            <Button onClick={confirm} disabled={!notes.trim() || pending}>
              Επιβεβαίωση
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
