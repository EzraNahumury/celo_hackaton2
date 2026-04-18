import type { SVGProps } from "react";

type IconProps = SVGProps<SVGSVGElement> & { size?: number };

const base = (p: IconProps) => ({
  width: p.size ?? 22,
  height: p.size ?? 22,
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.8,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
  ...p,
});

export function HomeIcon(p: IconProps) {
  return (
    <svg {...base(p)}>
      <path d="M3 10.5 12 3l9 7.5" />
      <path d="M5 9.5V20a1 1 0 0 0 1 1h4v-6h4v6h4a1 1 0 0 0 1-1V9.5" />
    </svg>
  );
}

export function HistoryIcon(p: IconProps) {
  return (
    <svg {...base(p)}>
      <path d="M3 12a9 9 0 1 0 3-6.7" />
      <path d="M3 4v5h5" />
      <path d="M12 7v5l3 2" />
    </svg>
  );
}

export function ProfileIcon(p: IconProps) {
  return (
    <svg {...base(p)}>
      <circle cx="12" cy="8" r="4" />
      <path d="M4 21c1.5-4 4.5-6 8-6s6.5 2 8 6" />
    </svg>
  );
}

export function SwordsIcon(p: IconProps) {
  return (
    <svg {...base(p)}>
      <path d="M14.5 17.5 3 6V3h3l11.5 11.5" />
      <path d="m13 19 6-6" />
      <path d="m16 16 4 4" />
      <path d="M19 21h2v-2" />
      <path d="M5 14 3 21l7-2" />
      <path d="m9.5 17.5 1.5-1.5" />
    </svg>
  );
}

export function PuzzleIcon(p: IconProps) {
  return (
    <svg {...base(p)}>
      <path d="M14 3a2 2 0 0 0-2 2 2 2 0 0 1-4 0H4v5a2 2 0 0 1 0 4v5h5a2 2 0 0 1 4 0h5v-4a2 2 0 0 0 0-4v-5a2 2 0 0 0-2-2Z" />
    </svg>
  );
}

export function ClubIcon(p: IconProps) {
  return (
    <svg {...base(p)}>
      <path d="M17 21v-2a4 4 0 0 0-4-4H7a4 4 0 0 0-4 4v2" />
      <circle cx="10" cy="7" r="4" />
      <path d="M21 21v-2a4 4 0 0 0-3-3.87" />
      <path d="M17 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  );
}

export function ChevronRight(p: IconProps) {
  return (
    <svg {...base(p)}>
      <path d="m9 6 6 6-6 6" />
    </svg>
  );
}

export function ChevronLeft(p: IconProps) {
  return (
    <svg {...base(p)}>
      <path d="m15 6-6 6 6 6" />
    </svg>
  );
}

export function BoltIcon(p: IconProps) {
  return (
    <svg {...base(p)}>
      <path d="M13 2 3 14h8l-1 8 10-12h-8l1-8Z" />
    </svg>
  );
}

export function TrophyIcon(p: IconProps) {
  return (
    <svg {...base(p)}>
      <path d="M8 21h8" />
      <path d="M12 17v4" />
      <path d="M17 4h3v3a5 5 0 0 1-5 5" />
      <path d="M7 4H4v3a5 5 0 0 0 5 5" />
      <path d="M17 4H7v5a5 5 0 0 0 10 0V4Z" />
    </svg>
  );
}

export function FlagIcon(p: IconProps) {
  return (
    <svg {...base(p)}>
      <path d="M4 21V4h12l-2 4 2 4H4" />
    </svg>
  );
}

export function PlayIcon(p: IconProps) {
  return (
    <svg {...base(p)} fill="currentColor" stroke="none">
      <path d="M8 5.5v13a1 1 0 0 0 1.5.87l11-6.5a1 1 0 0 0 0-1.74l-11-6.5A1 1 0 0 0 8 5.5Z" />
    </svg>
  );
}

export function SparkleIcon(p: IconProps) {
  return (
    <svg {...base(p)}>
      <path d="M12 3v4M12 17v4M3 12h4M17 12h4M5.6 5.6l2.8 2.8M15.6 15.6l2.8 2.8M5.6 18.4l2.8-2.8M15.6 8.4l2.8-2.8" />
    </svg>
  );
}
