"use client";

import { Unit } from "@prisma/client";
import { useCallback, useRef } from "react";

import { parseUserNumberDetailed } from "./numberParsing";

function formatNumberDE(value: number, unit: Unit, useGrouping: boolean): string {
  const maximumFractionDigits = unit === Unit.COUNT ? 0 : 1;
  return new Intl.NumberFormat("de-DE", {
    useGrouping,
    maximumFractionDigits,
    minimumFractionDigits: 0,
  }).format(value);
}

function formatForEditing(value: number, unit: Unit): string {
  return formatNumberDE(value, unit, false);
}

function formatForDisplay(value: number, unit: Unit): string {
  return formatNumberDE(value, unit, true);
}

export type FormattedValueInputProps = {
  name: string;
  defaultValue: string;
  unit: Unit;
  placeholder?: string;
  invalid?: boolean;
  className?: string;
};

export function FormattedValueInput({
  name,
  defaultValue,
  unit,
  placeholder,
  invalid,
  className,
}: FormattedValueInputProps) {
  const inputRef = useRef<HTMLInputElement>(null);

  const dispatchInputEvent = useCallback(() => {
    const el = inputRef.current;
    if (!el) return;
    el.dispatchEvent(new Event("input", { bubbles: true }));
  }, []);

  const onBlur = useCallback(() => {
    const el = inputRef.current;
    if (!el) return;

    const parsed = parseUserNumberDetailed(el.value, unit);
    if (parsed.kind !== "value") return;

    el.value = formatForDisplay(parsed.value, unit);
    dispatchInputEvent();
  }, [dispatchInputEvent, unit]);

  const onFocus = useCallback(() => {
    const el = inputRef.current;
    if (!el) return;

    const parsed = parseUserNumberDetailed(el.value, unit);
    if (parsed.kind !== "value") return;

    el.value = formatForEditing(parsed.value, unit);
    requestAnimationFrame(() => {
      try {
        el.setSelectionRange(el.value.length, el.value.length);
      } catch {
        // ignore
      }
    });

    dispatchInputEvent();
  }, [dispatchInputEvent, unit]);

  const onKeyDown = useCallback((e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key !== "Enter" || e.shiftKey || e.altKey || e.ctrlKey || e.metaKey) return;
    e.preventDefault();

    const el = inputRef.current;
    const form = el?.form;
    if (!el || !form) return;

    const inputs = Array.from(form.elements).filter(
      (node): node is HTMLInputElement =>
        node instanceof HTMLInputElement && node.name.startsWith("v:") && !node.disabled,
    );

    const idx = inputs.indexOf(el);
    const next = idx >= 0 ? inputs[idx + 1] : null;
    if (next) next.focus();
  }, []);

  return (
    <input
      ref={inputRef}
      name={name}
      className={className}
      defaultValue={defaultValue}
      placeholder={placeholder}
      inputMode={unit === Unit.COUNT ? "numeric" : "decimal"}
      aria-invalid={invalid ? "true" : "false"}
      onBlur={onBlur}
      onFocus={onFocus}
      onKeyDown={onKeyDown}
    />
  );
}
