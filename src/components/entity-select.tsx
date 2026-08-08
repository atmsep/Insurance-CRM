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

type Option = { id: string; label: string };

// Uncontrolled by default (self-contained island for server-rendered forms,
// driven only by defaultValue) — pass value/onValueChange to make it
// controlled instead, e.g. to auto-fill it from a sibling field.
export function EntitySelect({
  label,
  name,
  options,
  defaultValue,
  placeholder,
  value,
  onValueChange,
}: {
  label: string;
  name: string;
  options: Option[];
  defaultValue?: string;
  placeholder: string;
  value?: string;
  onValueChange?: (value: string) => void;
}) {
  const [internalValue, setInternalValue] = useState(defaultValue ?? "");
  const isControlled = value !== undefined;
  const currentValue = isControlled ? value : internalValue;
  const setValue = isControlled ? onValueChange! : setInternalValue;

  return (
    <div className="flex flex-col gap-2">
      <Label>{label}</Label>
      <Select value={currentValue} onValueChange={(v) => setValue(v ?? "")}>
        <SelectTrigger className="w-full">
          <SelectValue>
            {(v: string) => options.find((o) => o.id === v)?.label ?? placeholder}
          </SelectValue>
        </SelectTrigger>
        <SelectContent>
          {options.map((o) => (
            <SelectItem key={o.id} value={o.id}>
              {o.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <input type="hidden" name={name} value={currentValue} />
    </div>
  );
}
