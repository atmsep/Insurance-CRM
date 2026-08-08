"use client";

import { useEffect, useRef, useState } from "react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

type ComboboxOption = { id: string; label: string };

export function Combobox({
  name,
  value,
  initialLabel,
  placeholder,
  searchAction,
  onSelect,
  className,
}: {
  name: string;
  value: string;
  initialLabel?: string;
  placeholder: string;
  searchAction: (query: string) => Promise<ComboboxOption[]>;
  onSelect: (option: ComboboxOption) => void;
  className?: string;
}) {
  const [text, setText] = useState(initialLabel ?? "");
  const [results, setResults] = useState<ComboboxOption[]>([]);
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!text.trim()) return;
    const handle = setTimeout(async () => {
      const found = await searchAction(text);
      setResults(found);
    }, 250);
    return () => clearTimeout(handle);
  }, [text, searchAction]);

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, []);

  return (
    <div ref={containerRef} className={cn("relative flex flex-col gap-2", className)}>
      <Input
        value={text}
        placeholder={placeholder}
        onFocus={() => setOpen(true)}
        onChange={(e) => {
          setText(e.target.value);
          setOpen(true);
        }}
        autoComplete="off"
      />
      <input type="hidden" name={name} value={value} />
      {open && text.trim() && results.length > 0 && (
        <div className="absolute top-full z-10 mt-1 w-full rounded-md border bg-popover shadow-md">
          {results.map((option) => (
            <button
              key={option.id}
              type="button"
              className="block w-full px-3 py-2 text-left text-sm hover:bg-muted"
              onClick={() => {
                onSelect(option);
                setText(option.label);
                setOpen(false);
              }}
            >
              {option.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
