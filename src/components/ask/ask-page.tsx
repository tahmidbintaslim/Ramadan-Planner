"use client";

import { useState, type FormEvent } from "react";
import { useLocale, useTranslations } from "@/i18n/use-intl";
import { PEACE_API_URL } from "@/config/peace-api";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Chip } from "@/components/ui/chip";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";

export interface PeaceMatch {
  id: string;
  kind: "quran" | "hadith";
  score: number;
  reference: string;
  referenceBengali?: string;
  url: string | null;
  arabic: string | null;
  english: string | null;
  bengali: string | null;
  grade: string | null;
  collection?: string;
}

const FILTERS = { all: ["quran", "hadith"], quran: ["quran"], hadith: ["hadith"] } as const;
type Filter = keyof typeof FILTERS;

type State =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "error"; kind: "rateLimited" | "network" }
  | { status: "done"; matches: PeaceMatch[]; notice: string };

/**
 * /ask: searches stored ayat and hadith by meaning through the Peace AI API. The app only shows what the API
 * returns (no generated or paraphrased religious text), always under the "not a fatwa" notice.
 */
export function AskPage() {
  const t = useTranslations("ask");
  const locale = useLocale();
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const [submitted, setSubmitted] = useState("");
  const [state, setState] = useState<State>({ status: "idle" });

  async function search(q: string, f: Filter) {
    setSubmitted(q);
    setState({ status: "loading" });
    try {
      const res = await fetch(PEACE_API_URL, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ query: q, kinds: FILTERS[f], limit: 6 }),
      });
      if (res.status === 429) return setState({ status: "error", kind: "rateLimited" });
      if (!res.ok) return setState({ status: "error", kind: "network" });
      const data = (await res.json()) as { matches: PeaceMatch[]; notice: string };
      setState({ status: "done", matches: data.matches ?? [], notice: data.notice ?? "" });
    } catch {
      setState({ status: "error", kind: "network" });
    }
  }

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    const q = query.trim();
    if (q && state.status !== "loading") void search(q, filter);
  }

  function onFilter(f: Filter) {
    setFilter(f);
    if (submitted && state.status !== "loading") void search(submitted, f);
  }

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-6">
      <div className="space-y-1">
        <h1 className="rp-large-title text-rp-ink">{t("title")}</h1>
        <p className="rp-small text-rp-muted">{t("intro")}</p>
      </div>

      <form onSubmit={onSubmit} className="flex flex-col gap-3">
        <Label htmlFor="ask-query">{t("label")}</Label>
        <div className="flex gap-2">
          <Input
            id="ask-query"
            type="search"
            value={query}
            maxLength={500}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t("placeholder")}
          />
          <Button type="submit" disabled={!query.trim() || state.status === "loading"}>
            {t("submit")}
          </Button>
        </div>
        <div role="group" aria-label={t("filterLabel")} className="flex gap-2 overflow-x-auto">
          {(Object.keys(FILTERS) as Filter[]).map((f) => (
            <Chip key={f} selected={filter === f} onClick={() => onFilter(f)}>
              {t(`filter.${f}`)}
            </Chip>
          ))}
        </div>
      </form>

      <section aria-live="polite" aria-busy={state.status === "loading"} aria-label={t("results")} className="flex flex-col gap-3">
        {state.status === "loading"
          ? [0, 1, 2].map((i) => <Skeleton key={i} className="h-40 w-full rounded-rp-lg" />)
          : null}
        {state.status === "error" ? (
          <p role="alert" className="rp-small rounded-rp-md bg-rp-surface p-4 text-rp-ink shadow-rp-soft">
            {t(`error.${state.kind}`)}
          </p>
        ) : null}
        {state.status === "done" ? (
          <>
            <p className="rp-small rounded-rp-md bg-rp-gold-tint p-4 text-rp-gold-text">
              {locale === "bn" || !state.notice ? t("notice") : state.notice}
            </p>
            {state.matches.length === 0 ? (
              <p className="rp-small text-rp-muted">{t("empty")}</p>
            ) : (
              state.matches.map((m) => <AskResultCard key={m.id} match={m} />)
            )}
          </>
        ) : null}
      </section>
    </div>
  );
}

function AskResultCard({ match: m }: { match: PeaceMatch }) {
  const t = useTranslations("ask");
  const bn = useLocale() === "bn";
  const reference = bn && m.referenceBengali ? m.referenceBengali : m.reference;
  const text = bn ? (m.bengali ?? m.english) : (m.english ?? m.bengali);
  const textLang = text === m.bengali ? "bn" : "en";
  return (
    <Card className="gap-3 px-5" data-testid={`ask-result-${m.id}`}>
      <div className="flex flex-wrap items-center gap-2">
        <Badge variant="soft">{t(`kind.${m.kind}`)}</Badge>
        {m.collection ? <Badge variant="outline">{m.collection}</Badge> : null}
      </div>
      <h2 className="rp-row font-semibold">{reference}</h2>
      {m.arabic ? (
        <p lang="ar" dir="rtl" className={`${m.kind === "quran" ? "font-quran" : "font-arabic"} text-[22px] leading-[44px]`}>
          {m.arabic}
        </p>
      ) : null}
      {text ? (
        <p lang={textLang} className="rp-reading-small">
          {text}
        </p>
      ) : null}
      {m.kind === "hadith" ? (
        <p className="rp-caption text-rp-muted">{m.grade ? t("grade", { grade: m.grade }) : t("gradeMissing")}</p>
      ) : null}
      {m.url ? (
        <a href={m.url} target="_blank" rel="noopener noreferrer" className="rp-caption w-fit text-rp-accent underline-offset-4 hover:underline">
          quran.com
        </a>
      ) : null}
    </Card>
  );
}
