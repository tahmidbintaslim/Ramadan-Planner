import type { ReactNode } from "react";

// The four walkthrough illustrations (Figma page 14, "Art 1"–"Art 4", 260×200): teal strokes are currentColor
// (text-rp-primary, mint at night), the muted strokes --rp-wt-muted, the gold #E9C46A as in the logo.
const S = { strokeLinecap: "round", strokeLinejoin: "round", fill: "none" } as const;
const MUTED = "var(--rp-wt-muted)";
const GOLD = "#E9C46A";

function Art({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <svg viewBox="0 0 260 200" aria-hidden className={`h-auto w-[260px] text-rp-primary regular:w-[300px] ${className ?? ""}`}>
      {children}
    </svg>
  );
}

/** Today: the crescent (sehri), the sun at the next prayer on its arc, the sunset (iftar). */
function TodayArt() {
  return (
    <Art>
      <path
        {...S}
        stroke={MUTED}
        strokeWidth={4}
        strokeDasharray="0.5 12.2"
        d="M30 150A100 100 0 0 1 230 150"
      />
      <path {...S} stroke="currentColor" strokeWidth={6} d="M16 150H244" />
      <path
        {...S}
        stroke="currentColor"
        strokeWidth={6.08}
        d="M26.4205 140.1C16.2479 140.1 8 131.852 8 121.68C8 113.308 13.5841 106.242 21.2297 104C19.2689 106.7 18.1118 110.021 18.1118 113.614C18.1118 122.658 25.442 129.988 34.486 129.988C38.0789 129.988 41.4001 128.831 44.1 126.87C41.858 134.516 34.7919 140.1 26.4205 140.1Z"
      />
      <path {...S} stroke="currentColor" strokeWidth={6} d="M245 124A15 15 0 1 1 215 124A15 15 0 1 1 245 124Z" />
      <path {...S} stroke="currentColor" strokeWidth={5} d="M230 92V98M254 124H248M213 107L209 103M247 107L251 103" />
      <path {...S} stroke={MUTED} strokeWidth={3} strokeDasharray="1 8.6" d="M130 64V150" />
      {/* The sun travels the arc once to the next prayer (.rp-wt-sun in globals.css). */}
      <circle className="rp-wt-sun" cx={130} cy={50} r={9} fill={GOLD} stroke={GOLD} strokeWidth={2} />
    </Art>
  );
}

/** Daily amal: two ticked steps, one still to do. */
function AmalArt() {
  const check = (y: number) => (
    <>
      <circle cx={19} cy={y} r={16} fill="currentColor" stroke="currentColor" strokeWidth={6} />
      <path {...S} stroke="var(--rp-text-on-primary)" strokeWidth={5} d={`M11 ${y}L17 ${y + 6}L28 ${y - 6}`} />
    </>
  );
  return (
    <Art>
      <g transform="translate(27 9.75)">
        {check(34.25)}
        <path {...S} stroke="currentColor" strokeWidth={6} d="M55 34.25H187" />
        {check(90.25)}
        <path {...S} stroke="currentColor" strokeWidth={6} d="M55 90.25H159" />
        <circle {...S} cx={19} cy={146.25} r={16} stroke="currentColor" strokeWidth={6} />
        <path {...S} stroke={MUTED} strokeWidth={6} d="M55 146.25H173" />
        <path
          fill={GOLD}
          stroke={GOLD}
          strokeWidth={4.5}
          strokeLinejoin="round"
          d="M209.073 3.98475L211.185 8.24175C211.473 8.83575 212.241 9.40275 212.889 9.51375L216.717 10.1528C219.165 10.5638 219.741 12.3548 217.977 14.1217L215.001 17.1217C214.497 17.6287 214.221 18.6097 214.377 19.3117L215.229 23.0257C215.901 25.9657 214.353 27.1027 211.773 25.5667L208.185 23.4247C207.537 23.0378 206.469 23.0378 205.809 23.4247L202.221 25.5667C199.653 27.1027 198.093 25.9538 198.765 23.0257L199.617 19.3117C199.773 18.6097 199.497 17.6287 198.993 17.1217L196.02 14.1217C194.268 12.3548 194.832 10.5638 197.277 10.1528L201.105 9.51375C201.741 9.40275 202.509 8.83575 202.797 8.24175L204.909 3.98475C206.061 1.67175 207.933 1.67175 209.073 3.98475Z"
        />
      </g>
    </Art>
  );
}

/** Quran and duas: an open book on a stand, a crescent above, a star on the page. */
function QuranArt() {
  return (
    <Art>
      <path {...S} stroke="currentColor" strokeWidth={6} d="M130 64C104 48 66 46 40 56V152C66 142 104 144 130 160V64Z" />
      <path {...S} stroke="currentColor" strokeWidth={6} d="M130 64C156 48 194 46 220 56V152C194 142 156 144 130 160V64Z" />
      <path
        {...S}
        stroke={MUTED}
        strokeWidth={5}
        d="M60 82C78 77 96 78 112 84M60 104C78 99 96 100 112 106M60 126C78 121 96 122 112 128M148 84C164 78 182 77 200 82M148 106C164 100 182 99 200 104"
      />
      <path {...S} stroke="currentColor" strokeWidth={6} d="M70 192L130 162L190 192" />
      <path
        fill={GOLD}
        stroke={GOLD}
        strokeWidth={3.9}
        strokeLinejoin="round"
        d="M168.197 113.503L170.027 117.192C170.277 117.707 170.942 118.198 171.504 118.295L174.821 118.848C176.943 119.205 177.442 120.757 175.913 122.288L173.334 124.888C172.897 125.328 172.658 126.178 172.793 126.786L173.532 130.005C174.114 132.553 172.773 133.538 170.537 132.207L167.427 130.351C166.865 130.015 165.94 130.015 165.368 130.351L162.258 132.207C160.033 133.538 158.681 132.543 159.263 130.005L160.001 126.786C160.137 126.178 159.897 125.328 159.461 124.888L156.884 122.288C155.366 120.757 155.854 119.205 157.973 118.848L161.291 118.295C161.842 118.198 162.508 117.707 162.757 117.192L164.588 113.503C165.586 111.498 167.209 111.498 168.197 113.503Z"
      />
      <path
        {...S}
        stroke="currentColor"
        strokeWidth={6}
        d="M126.542 32.5C118.511 32.5 112 25.9885 112 17.9575C112 11.3485 116.408 5.77 122.444 4C120.896 6.1315 119.983 8.7535 119.983 11.59C119.983 18.73 125.77 24.517 132.91 24.517C135.746 24.517 138.368 23.6035 140.5 22.0555C138.73 28.0915 133.151 32.5 126.542 32.5Z"
      />
    </Art>
  );
}

/** Reminders: a bell with a gold dot, ringing lines, a letter. */
function RemindersArt() {
  return (
    <Art>
      {/* The bell rocks twice when its card arrives (.rp-wt-bell). */}
      <g className="rp-wt-bell">
        <path {...S} stroke="currentColor" strokeWidth={6} d="M104 30C72 30 54 54 54 84V112L40 134H168L154 112V84C154 54 136 30 104 30Z" />
        <path {...S} stroke="currentColor" strokeWidth={6} d="M90 148C92 160 116 160 118 148M104 18V30" />
        <circle cx={150} cy={40} r={11} fill={GOLD} stroke={GOLD} strokeWidth={2} />
      </g>
      <rect {...S} x={160} y={120} width={84} height={60} rx={10} fill="var(--rp-bg-accent-tint)" stroke="currentColor" strokeWidth={6} />
      <path {...S} stroke="currentColor" strokeWidth={6} d="M166 128L202 154L238 128" />
      <path {...S} stroke={MUTED} strokeWidth={5} d="M20 70C12 80 12 96 20 106M188 70C196 80 196 96 188 106" />
    </Art>
  );
}

export const WALKTHROUGH_ART = [TodayArt, AmalArt, QuranArt, RemindersArt] as const;
