import { useEffect, useRef, useState, useSyncExternalStore, type PointerEvent, type ReactNode } from "react";
import { useLocale, useTranslations } from "@/i18n/use-intl";
import { Chip } from "@/components/ui/chip";
import { cn } from "@/lib/utils";

// Logo mark (Hugeicons Islamic "ramadan-01") and the Hugeicons "lantern", exact paths, drawn on a 24 grid.
const CRESCENT =
  "M2.5 11.8049C2.5 17.1594 6.84065 21.5 12.1951 21.5C16.601 21.5 20.3204 18.5611 21.5 14.5367C20.0791 15.5691 18.3306 16.1779 16.44 16.1779C11.6804 16.1779 7.82208 12.3196 7.82208 7.56005C7.82208 5.66937 8.43094 3.9209 9.46326 2.5C5.4389 3.67959 2.5 7.39904 2.5 11.8049Z";
const STAR =
  "M18.1911 3.07767L18.895 4.49715C18.991 4.69475 19.2469 4.88428 19.4629 4.92057L20.7388 5.1343C21.5547 5.27141 21.7467 5.86824 21.1587 6.457L20.1668 7.45709C19.9989 7.62646 19.9069 7.9531 19.9589 8.18699L20.2428 9.425C20.4668 10.4049 19.9509 10.784 19.091 10.2718L17.8951 9.55808C17.6791 9.42903 17.3232 9.42903 17.1032 9.55808L15.9073 10.2718C15.0514 10.784 14.5315 10.4009 14.7554 9.425L15.0394 8.18699C15.0914 7.9531 14.9994 7.62646 14.8314 7.45709L13.8395 6.457C13.2556 5.86824 13.4436 5.27141 14.2595 5.1343L15.5353 4.92057C15.7473 4.88428 16.0033 4.69475 16.0993 4.49715L16.8032 3.07767C17.1872 2.30744 17.8111 2.30744 18.1911 3.07767Z";
const LANTERN = [
  "M6 7.5C6.71663 5.40983 8.72856 4 10.9947 4H13.0053C15.2714 4 17.2834 5.40983 18 7.5H6Z",
  "M18 18.5C17.2834 20.5902 15.2714 22 13.0053 22L10.9947 22C8.72855 22 6.71663 20.5902 6 18.5L18 18.5Z",
  "M6 7.5V18.5M18 7.5V18.5M10 7.5V18.5M14 7.5V18.5",
  "M12 2V4",
];

const ARCH = "M40 640V250C40 130 170 52 320 24C470 52 600 130 600 250V640Z";
const FRAME = "M24 656V248C24 118 162 34 320 4C478 34 616 118 616 248V656Z";

/** An onion dome with its finial, standing on `base`. */
function Dome({ cx, base, w, h }: { cx: number; base: number; w: number; h: number }) {
  const l = cx - w / 2;
  const r = cx + w / 2;
  return (
    <>
      <path d={`M${l} ${base}C${l} ${base - h * 0.55} ${cx - w * 0.18} ${base - h * 0.75} ${cx} ${base - h}C${cx + w * 0.18} ${base - h * 0.75} ${r} ${base - h * 0.55} ${r} ${base}Z`} />
      <rect x={cx - 0.9} y={base - h - 11} width={1.8} height={12} />
      <circle cx={cx} cy={base - h - 12} r={2.2} />
    </>
  );
}

/** A minaret: shaft, two balconies and a pointed cap. */
function Minaret({ x, base, h }: { x: number; base: number; h: number }) {
  const top = base - h;
  return (
    <>
      <rect x={x - 5} y={top} width={10} height={h} />
      <rect x={x - 9} y={top - 5} width={18} height={5} rx={1} />
      <rect x={x - 8} y={top + h * 0.42} width={16} height={4} rx={1} />
      <path d={`M${x - 6} ${top - 5}C${x - 6} ${top - 15} ${x} ${top - 19} ${x} ${top - 26}C${x} ${top - 19} ${x + 6} ${top - 15} ${x + 6} ${top - 5}Z`} />
    </>
  );
}

/** A hanging lantern whose cord starts above the arch (clipped by it); sways about the cord's top. */
function Lantern({ x, top, scale, delay }: { x: number; top: number; scale: number; delay: string }) {
  return (
    <g className="rp-hero-sway" style={{ transformOrigin: `${x}px 0px`, animationDelay: delay }}>
      <path d={`M${x} 0V${top + 2 * scale}`} stroke="var(--hero-gold)" strokeOpacity="0.7" strokeWidth="1.2" />
      <circle className="rp-hero-glow" cx={x} cy={top + 13 * scale} r={13 * scale} fill="url(#rp-hero-lamp)" style={{ animationDelay: delay }} />
      <g
        transform={`translate(${x - 12 * scale} ${top}) scale(${scale})`}
        stroke="var(--hero-gold)"
        strokeWidth={2.4 / scale}
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M6 7.5H18V18.5H6Z" fill="var(--hero-gold)" fillOpacity="0.28" stroke="none" />
        {LANTERN.map((d) => (
          <path key={d} d={d} />
        ))}
      </g>
    </g>
  );
}

// Small four-point sparkles: [x, y, radius, twinkle delay in s].
const SPARKLES: ReadonlyArray<readonly [number, number, number, number]> = [
  [96, 330, 5, 0], [214, 118, 3.6, 1.2], [118, 420, 2.4, 2.1], [262, 84, 3.2, 0.6], [392, 96, 2.6, 1.8],
  [470, 300, 4.4, 0.9], [560, 400, 2.4, 2.6], [430, 170, 2.2, 3.1], [76, 478, 2, 1.5], [168, 300, 2, 2.4],
];

/** Shifts a layer with the pointer (see HeroShowcase): `depth` in px at the edge of the art. */
function Layer({ depth, children }: { depth: number; children: ReactNode }) {
  return (
    <g className="rp-hero-layer" style={{ transform: `translate(calc(var(--hero-px, 0) * ${depth}px), calc(var(--hero-py, 0) * ${depth}px))` }}>
      {children}
    </g>
  );
}

/**
 * The hero's night scene inside a mihrab arch, one vector for both themes (colours come from the `--hero-*`
 * tokens in globals.css): the logo crescent and star, sparkles, two lanterns hung from the arch and a mosque
 * skyline in two depths. Everything is clipped to the arch. Motion is CSS only and stops under reduced motion.
 */
function HeroArt() {
  return (
    <svg viewBox="0 0 640 660" fill="none" aria-hidden="true" focusable="false" className="rp-hero-art block h-auto w-full">
      <defs>
        <linearGradient id="rp-hero-sky" x1="320" y1="24" x2="320" y2="640" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="var(--hero-sky-0)" />
          <stop offset="0.45" stopColor="var(--hero-sky-1)" />
          <stop offset="0.74" stopColor="var(--hero-sky-2)" />
          <stop offset="0.9" stopColor="var(--hero-sky-3)" />
        </linearGradient>
        <radialGradient id="rp-hero-moonglow">
          <stop stopColor="#F7E7BF" stopOpacity="0.4" />
          <stop offset="1" stopColor="#F7E7BF" stopOpacity="0" />
        </radialGradient>
        <radialGradient id="rp-hero-lamp">
          <stop stopColor="var(--hero-gold)" stopOpacity="0.5" />
          <stop offset="1" stopColor="var(--hero-gold)" stopOpacity="0" />
        </radialGradient>
        <radialGradient id="rp-hero-horizon" cx="0" cy="0" r="1" gradientUnits="userSpaceOnUse" gradientTransform="translate(320 572) scale(300 120)">
          <stop stopColor="var(--hero-horizon)" stopOpacity="0.7" />
          <stop offset="1" stopColor="var(--hero-horizon)" stopOpacity="0" />
        </radialGradient>
        <clipPath id="rp-hero-clip">
          <path d={ARCH} />
        </clipPath>
      </defs>

      <path d={FRAME} stroke="var(--hero-frame)" strokeOpacity="0.75" strokeWidth="1.5" />
      <g clipPath="url(#rp-hero-clip)">
        <path d={ARCH} fill="url(#rp-hero-sky)" />
        <ellipse cx="320" cy="572" rx="300" ry="120" fill="url(#rp-hero-horizon)" />

        <Layer depth={4}>
          {SPARKLES.map(([x, y, r, delay]) => (
            <path
              key={`${x}-${y}`}
              className="rp-hero-twinkle"
              style={{ animationDelay: `${delay}s` }}
              d={`M${x} ${y - r}Q${x + r * 0.22} ${y - r * 0.22} ${x + r} ${y}Q${x + r * 0.22} ${y + r * 0.22} ${x} ${y + r}Q${x - r * 0.22} ${y + r * 0.22} ${x - r} ${y}Q${x - r * 0.22} ${y - r * 0.22} ${x} ${y - r}Z`}
              fill="var(--hero-star)"
            />
          ))}
        </Layer>

        <Layer depth={10}>
          <g className="rp-hero-float">
            <circle className="rp-hero-glow" cx="120" cy="226" r="92" fill="url(#rp-hero-moonglow)" />
            <g transform="translate(66 172) scale(4.5)">
              <path d={CRESCENT} fill="#F7E7BF" />
              <path d={STAR} fill="var(--hero-gold)" />
            </g>
          </g>
        </Layer>

        <Layer depth={14}>
          <Lantern x={500} top={150} scale={2.5} delay="0s" />
          <Lantern x={556} top={236} scale={1.7} delay="-1.6s" />
        </Layer>

        {/* Far skyline: lighter, moves less. */}
        <Layer depth={6}>
          <g fill="var(--hero-ink-far)">
            <Dome cx={204} base={566} w={56} h={44} />
            <Dome cx={436} base={566} w={56} h={44} />
            <Minaret x={252} base={572} h={96} />
            <Minaret x={388} base={572} h={96} />
            <rect x="150" y="548" width="340" height="30" />
          </g>
        </Layer>

        {/* Near skyline and the ground, to the foot of the arch. */}
        <Layer depth={12}>
          <g fill="var(--hero-ink)">
            <Minaret x={78} base={580} h={140} />
            <Minaret x={562} base={580} h={140} />
            <rect x="104" y="534" width="92" height="46" />
            <Dome cx={150} base={534} w={72} h={56} />
            <rect x="444" y="534" width="92" height="46" />
            <Dome cx={490} base={534} w={72} h={56} />
            <rect x="238" y="514" width="164" height="66" />
            <Dome cx={320} base={514} w={128} h={96} />
            <rect x="20" y="570" width="600" height="90" />
          </g>
        </Layer>
      </g>
    </svg>
  );
}

const SCREENS = [
  { screen: "today", label: "todayShort" },
  { screen: "timetable", label: "timetableShort" },
  { screen: "plan", label: "planShort" },
  { screen: "quran-1", label: "quranShort" },
] as const;
const ROTATE_MS = 4500;

const subscribeNoop = () => () => {};

/**
 * The hero: the animated arch scene behind a phone that walks through four real screens. The screens rotate on
 * their own and the four chips pick one; hovering, focusing or picking pauses the rotation. The scene's layers
 * follow a mouse (not touch). Under reduced motion nothing moves or rotates; the chips still work.
 */
export function HeroShowcase({ alt, className }: { alt: string; className?: string }) {
  const tNav = useTranslations("nav");
  const locale = useLocale() === "en" ? "en" : "bn";
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  // The other screens load after hydration, so the first paint fetches one phone image only.
  const mounted = useSyncExternalStore(subscribeNoop, () => true, () => false);
  const root = useRef<HTMLDivElement>(null);
  const frame = useRef(0);

  useEffect(() => {
    if (paused || window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return;
    const id = window.setInterval(() => {
      if (!document.hidden) setIndex((i) => (i + 1) % SCREENS.length);
    }, ROTATE_MS);
    return () => window.clearInterval(id);
  }, [paused]);

  const onPointerMove = (e: PointerEvent<HTMLDivElement>) => {
    if (e.pointerType !== "mouse") return;
    const el = root.current;
    if (!el) return;
    const { clientX, clientY } = e;
    cancelAnimationFrame(frame.current);
    frame.current = requestAnimationFrame(() => {
      const r = el.getBoundingClientRect();
      el.style.setProperty("--hero-px", ((clientX - r.left) / r.width - 0.5).toFixed(3));
      el.style.setProperty("--hero-py", ((clientY - r.top) / r.height - 0.5).toFixed(3));
    });
  };
  const resetPointer = () => {
    cancelAnimationFrame(frame.current);
    root.current?.style.setProperty("--hero-px", "0");
    root.current?.style.setProperty("--hero-py", "0");
  };

  return (
    <div className={cn("flex flex-col items-center gap-4", className)}>
      <div
        ref={root}
        className="relative w-full"
        onPointerMove={onPointerMove}
        onPointerLeave={() => {
          resetPointer();
          setPaused(false);
        }}
        onPointerEnter={() => setPaused(true)}
      >
        <HeroArt />
        <div className="absolute left-1/2 top-[17%] w-[42%] -translate-x-1/2">
          <div className="rp-hero-phone rounded-[14%/6.5%] border-[length:clamp(6px,1.6vw,10px)] border-[#17211F] bg-[#17211F] shadow-[0_24px_60px_-20px_rgba(4,21,18,0.6)]">
            <div className="relative aspect-[390/844] overflow-hidden rounded-[11%/5.2%]">
              {SCREENS.map((s, i) =>
                i === 0 || mounted ? (
                  <div
                    key={s.screen}
                    aria-hidden={i === index ? undefined : true}
                    data-active={i === index || undefined}
                    className="absolute inset-0 opacity-0 transition-opacity duration-500 data-active:opacity-100 motion-reduce:transition-none"
                  >
                    <img
                      src={`/home/phone-${locale}-light-${s.screen}.webp`}
                      alt={i === index ? (i === 0 ? alt : tNav(s.label)) : ""}
                      width={390}
                      height={844}
                      loading={i === 0 ? "eager" : "lazy"}
                      decoding="async"
                      className={cn("block size-full", locale === "bn" && "dark:hidden")}
                    />
                    {/* The app theme is a class, not the OS setting: bn has dark captures, en does not. */}
                    {locale === "bn" ? (
                      <img src={`/home/phone-bn-dark-${s.screen}.webp`} alt="" width={390} height={844} loading="lazy" decoding="async" className="hidden size-full dark:block" />
                    ) : null}
                  </div>
                ) : null,
              )}
            </div>
          </div>
        </div>
      </div>

      <div role="group" aria-label={alt} className="flex flex-wrap justify-center gap-2">
        {SCREENS.map((s, i) => (
          <Chip
            key={s.screen}
            selected={i === index}
            onClick={() => {
              setIndex(i);
              setPaused(true);
            }}
          >
            {tNav(s.label)}
          </Chip>
        ))}
      </div>
    </div>
  );
}
