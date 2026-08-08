"use client";

import { useState } from "react";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export function AgentSelect({
  agents,
  defaultValue,
}: {
  agents: { id: string; full_name: string }[];
  defaultValue?: string;
}) {
  const [agentId, setAgentId] = useState(defaultValue ?? "");

  return (
    <div className="flex flex-col gap-2">
      <Label>Συνεργάτης</Label>
      <Select value={agentId} onValueChange={(v) => setAgentId(v ?? "")}>
        <SelectTrigger className="w-full">
          <SelectValue>
            {(value: string) => agents.find((a) => a.id === value)?.full_name ?? "Επίλεξε συνεργάτη"}
          </SelectValue>
        </SelectTrigger>
        <SelectContent>
          {agents.map((a) => (
            <SelectItem key={a.id} value={a.id}>
              {a.full_name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <input type="hidden" name="assigned_agent_id" value={agentId} />
    </div>
  );
}
