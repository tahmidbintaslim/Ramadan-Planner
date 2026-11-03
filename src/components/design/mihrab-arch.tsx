export interface MihrabArchProps {
  className?: string;
}

/** Decorative mihrab arch outline (two nested strokes). Size it with className; hidden from assistive tech. */
export function MihrabArch({ className }: MihrabArchProps) {
  return (
    <svg
      aria-hidden="true"
      focusable="false"
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 300 300"
      preserveAspectRatio="xMidYMax meet"
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <path d="M20 300V150C20 80 80 34 150 8c70 26 130 72 130 142v150" strokeOpacity={0.16} strokeWidth={1.5} />
      <path d="M44 300V156C44 98 94 60 150 38c56 22 106 60 106 118v144" strokeOpacity={0.08} strokeWidth={1.5} />
    </svg>
  );
}
