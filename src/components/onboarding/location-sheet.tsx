"use client";

import { X } from "lucide-react";
import { Dialog as SheetPrimitive } from "radix-ui";
import { useTranslations } from "@/i18n/use-intl";
import { Sheet, SheetContent, SheetDescription, SheetTitle } from "@/components/ui/sheet";
import { LUCIDE_STROKE } from "@/components/layout/nav-items";
import { markOnboardingDone, writeStoredLocation, type StoredLocation } from "@/lib/user-location";
import { LocationPickerFields, useLocationPicker } from "./location-picker";

/**
 * "Your location" as a sheet (v4): a bottom sheet with a grabber and Cancel / Done on compact and medium, a centred
 * 560 sheet with the title and a 44 Close on regular. Done saves the district on this device; every screen that
 * reads the location follows (LOCATION_EVENT).
 */
export function LocationSheet({
  open,
  onOpenChange,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved?: (loc: StoredLocation) => void;
}) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="bottom"
        showCloseButton={false}
        className="max-h-[92dvh] gap-0 overflow-y-auto rounded-t-rp-xl border-0 bg-rp-page text-rp-ink regular:inset-auto regular:top-1/2 regular:left-1/2 regular:max-h-[85dvh] regular:w-[560px] regular:-translate-x-1/2 regular:-translate-y-1/2 regular:rounded-rp-xl"
      >
        {/* Mounted only while open, so each opening starts from the stored choice. */}
        {open ? <LocationSheetBody onOpenChange={onOpenChange} onSaved={onSaved} /> : null}
      </SheetContent>
    </Sheet>
  );
}

function LocationSheetBody({
  onOpenChange,
  onSaved,
}: {
  onOpenChange: (open: boolean) => void;
  onSaved?: (loc: StoredLocation) => void;
}) {
  const t = useTranslations("onboarding");
  const tCommon = useTranslations("common");
  const save = (loc: StoredLocation) => {
    writeStoredLocation(loc);
    markOnboardingDone();
    onSaved?.(loc);
    onOpenChange(false);
  };
  const picker = useLocationPicker({ onSubmit: save });
  const done = () => {
    const loc = picker.resolve();
    if (loc) save(loc);
  };

  return (
    <>
      {/* Compact / medium header: grabber, Cancel, title, Done. */}
      <div className="sticky top-0 z-10 flex flex-col items-center bg-rp-elevated px-4 pt-2 pb-2 regular:hidden">
        <span aria-hidden="true" className="h-[5px] w-9 rounded-full bg-rp-input" />
        <div className="flex w-full items-center">
          <SheetPrimitive.Close className="rp-row flex h-11 min-w-11 items-center text-rp-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rp-focus">
            {tCommon("cancelShort")}
          </SheetPrimitive.Close>
          <SheetTitle className="rp-headline flex-1 text-center text-rp-ink">{t("title")}</SheetTitle>
          <button
            type="button"
            onClick={done}
            className="rp-headline flex h-11 min-w-11 items-center justify-end text-rp-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rp-focus"
          >
            {tCommon("done")}
          </button>
        </div>
      </div>
      {/* Regular header: title aligned to the content (32), 44 Close. */}
      <div className="hidden items-center bg-rp-elevated pt-4 pr-4 pb-2 pl-8 regular:flex">
        <p aria-hidden="true" className="rp-h2 flex-1 text-rp-ink">
          {t("title")}
        </p>
        <SheetPrimitive.Close
          aria-label={tCommon("close")}
          className="flex size-11 items-center justify-center rounded-rp-full bg-rp-accent-tint text-rp-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rp-focus"
        >
          <X size={20} strokeWidth={LUCIDE_STROKE} aria-hidden />
        </SheetPrimitive.Close>
      </div>
      <SheetDescription className="sr-only">{t("subtitle")}</SheetDescription>
      <LocationPickerFields picker={picker} className="px-4 pt-4 pb-[calc(1.5rem+env(safe-area-inset-bottom))] regular:px-8 regular:pb-8" />
      <div className="hidden px-8 pb-8 regular:block">
        <button
          type="button"
          onClick={done}
          className="rp-button h-11 w-full rounded-rp-sm bg-rp-primary text-rp-on-primary transition-colors hover:bg-rp-primary-pressed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rp-focus focus-visible:ring-offset-2"
        >
          {tCommon("done")}
        </button>
      </div>
    </>
  );
}
