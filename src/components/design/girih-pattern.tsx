import { useId } from "react";

export interface GirihPatternProps {
  /** Overall opacity of the lattice. Default 0.07 (spec range 6-10%). */
  opacity?: number;
  className?: string;
}

/**
 * Decorative 8-point girih lattice: a 40x40 SVG tile with an 8-point star (two 20x20 squares, one rotated 45deg)
 * centred on each lattice point. Fills its positioned parent, ignores pointer events, hidden from assistive tech.
 */
export function GirihPattern({ opacity = 0.07, className }: GirihPatternProps) {
  const id = `girih-${useId().replace(/:/g, "")}`;
  return (
    <svg
      aria-hidden="true"
      focusable="false"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      style={{ position: "absolute", inset: 0, width: "100%", height: "100%", pointerEvents: "none", opacity }}
    >
      <defs>
        <pattern id={id} width="40" height="40" patternUnits="userSpaceOnUse">
          <g fill="none" stroke="currentColor" strokeWidth="1">
            <rect x="10" y="10" width="20" height="20" />
            <rect x="10" y="10" width="20" height="20" transform="rotate(45 20 20)" />
          </g>
        </pattern>
      </defs>
      <rect width="100%" height="100%" fill={`url(#${id})`} />
    </svg>
  );
}
