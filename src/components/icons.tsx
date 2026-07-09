import type { SVGProps } from 'react'

const base = (props: SVGProps<SVGSVGElement>) => ({
  width: 24,
  height: 24,
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.8,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
  ...props,
})

export const IconHome = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)}>
    <path d="M4 11.5 12 4l8 7.5" />
    <path d="M6 10v9a1 1 0 0 0 1 1h10a1 1 0 0 0 1-1v-9" />
  </svg>
)

export const IconFlock = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)}>
    <path d="M12 3c-3.6 0-6 4.8-6 9.2C6 16.4 8.7 20 12 20s6-3.6 6-7.8C18 7.8 15.6 3 12 3Z" />
    <path d="M12 8c-.6 3-2 4.6-4.4 5.4" />
  </svg>
)

export const IconChart = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)}>
    <path d="M4 20V10M10 20V4M16 20v-7M22 20H2" />
  </svg>
)

export const IconGear = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)}>
    <circle cx="12" cy="12" r="3" />
    <path d="M12 2v3M12 19v3M2 12h3M19 12h3M4.9 4.9l2.1 2.1M17 17l2.1 2.1M19.1 4.9 17 7M7 17l-2.1 2.1" />
  </svg>
)

export const IconPlus = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)}>
    <path d="M12 5v14M5 12h14" />
  </svg>
)

export const IconChevron = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)}>
    <path d="m9 6 6 6-6 6" />
  </svg>
)

export const IconBack = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)}>
    <path d="m15 6-6 6 6 6" />
  </svg>
)

export const IconScale = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)}>
    <path d="M12 3v18M7 21h10M5 7h14l-2.5 6a3.5 3.5 0 0 1-9 0L5 7Z" />
  </svg>
)

export const IconEgg = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)}>
    <path d="M12 3c-3.3 0-6 5-6 9a6 6 0 0 0 12 0c0-4-2.7-9-6-9Z" />
  </svg>
)

export const IconMoney = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)}>
    <rect x="3" y="6" width="18" height="12" rx="2" />
    <circle cx="12" cy="12" r="2.5" />
  </svg>
)

export const IconTrend = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)}>
    <path d="M3 17 9 11l4 4 8-8" />
    <path d="M21 12V7h-5" />
  </svg>
)

export const IconClose = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)}>
    <path d="M6 6l12 12M18 6 6 18" />
  </svg>
)

export const IconAlerta = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)}>
    <path d="M12 3.5 21.5 20h-19L12 3.5Z" />
    <path d="M12 10v4M12 17.2v.1" />
  </svg>
)

export const IconVacuna = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)}>
    <path d="m19 5-8.5 8.5M14 3l7 7M17.5 6.5 19 5M5 19l3.5-3.5M10.5 8.5l5 5-4 4a2 2 0 0 1-2.8 0L6.5 15.3a2 2 0 0 1 0-2.8l4-4Z" />
    <path d="M3 21l2-2" />
  </svg>
)

export const IconTrofeo = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)}>
    <circle cx="12" cy="9" r="5.5" />
    <path d="m9.5 13.5-2 7L12 18l4.5 2.5-2-7" />
  </svg>
)

export const IconCheck = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)}>
    <path d="m4.5 12.5 5 5 10-11" />
  </svg>
)

export const LogoAviControl = (p: SVGProps<SVGSVGElement>) => (
  <svg viewBox="0 0 512 512" width={32} height={32} fill="none" aria-hidden {...p}>
    <rect width="512" height="512" rx="112" fill="#1D5730" />
    <path
      d="M256 108c-58 0-116 92-116 168 0 66 52 116 116 116s116-50 116-116c0-76-58-168-116-168Z"
      fill="#F6F4EE"
    />
    <path d="M256 150c-6 42-30 66-72 78 20 44 58 64 96 56-20-46-24-92-24-134Z" fill="#4FA968" />
    <circle cx="300" cy="220" r="16" fill="#E9A93C" />
  </svg>
)
