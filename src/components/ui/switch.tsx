"use client";

import type { ComponentProps } from "react";
import { cn } from "@/lib/utils";

/** HIG switch (51×31 track, 27 thumb) on a 44px-high hit area; `role="switch"` with `aria-checked`. */
export function Switch({
  checked,
  onCheckedChange,
  className,
  ...props
}: Omit<ComponentProps<"button">, "onChange" | "role"> & { checked: boolean; onCheckedChange: (checked: boolean) => void }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onCheckedChange(!checked)}
      className={cn(
        "group inline-flex h-11 w-[51px] shrink-0 items-center rounded-rp-full outline-none disabled:opacity-50",
        className,
      )}
      {...props}
    >
      <span
        aria-hidden
        className={cn(
          "relative h-[31px] w-[51px] rounded-rp-full transition-colors group-focus-visible:ring-2 group-focus-visible:ring-rp-focus group-focus-visible:ring-offset-2",
          checked ? "bg-rp-accent" : "bg-rp-rule",
        )}
      >
        <span
          className={cn(
            "absolute top-[2px] left-[2px] size-[27px] rounded-rp-full bg-white shadow-sm transition-transform motion-reduce:transition-none",
            checked && "translate-x-5",
          )}
        />
      </span>
    </button>
  );
}
