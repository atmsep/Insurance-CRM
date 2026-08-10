"use client";

import { useCallback, useState } from "react";

// React resets a <form>'s uncontrolled fields after any action-prop
// submission completes, success or failure alike (the same as a native
// form reset) — so a validation error (e.g. an invalid ΑΦΜ) wipes every
// field the user typed, not just the bad one. Backing fields with real
// React state instead of the DOM sidesteps that: state survives the reset
// because React re-asserts `value` from props on every render.
export function useFormValues(initial: Record<string, string> = {}) {
  const [values, setValues] = useState<Record<string, string>>(initial);

  const setValue = useCallback((name: string, value: string) => {
    setValues((v) => ({ ...v, [name]: value }));
  }, []);

  const field = useCallback(
    (name: string) => ({
      value: values[name] ?? "",
      onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
        setValue(name, e.target.value),
    }),
    [values, setValue],
  );

  return { values, setValue, setValues, field };
}
