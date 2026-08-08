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

export const IconPesa = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)}>
    <path d="M6.5 8h11l2.2 11.5a1 1 0 0 1-1 1.2H5.3a1 1 0 0 1-1-1.2L6.5 8Z" />
    <path d="M9.2 8a2.8 2.8 0 0 1 5.6 0" />
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

export const IconPulso = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base({ strokeWidth: 2, ...p })}>
    <path d="M3 12h4l3-7 4 14 3-7h4" />
  </svg>
)

export const IconLapiz = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base({ strokeWidth: 2, ...p })}>
    <path d="M12 20h9" />
    <path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z" />
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

// Marca «Engorde»: un anillo cuyo grosor va de 22 a 68px a lo largo de 340° —
// día 1 delgado, día 41 grueso. Es un path relleno trazado punto a punto (SVG no
// tiene grosor de trazo variable), con la abertura arriba y el punto del día.
const RING =
  'M 256 97 L 283.7 98.7 L 310.8 105.3 L 336.5 116.5 L 359.9 132.1 L 380.4 151.6 L 397.2 174.5 L 409.9 200 L 417.9 227.5 L 421.1 256 L 419.2 284.8 L 412.4 312.9 L 400.7 339.6 L 384.5 363.9 L 364.3 385 L 340.6 402.5 L 314.1 415.6 L 285.6 423.9 L 256 427.2 L 226.2 425.2 L 197 418.1 L 169.4 406 L 144.2 389.2 L 122.3 368.2 L 104.2 343.6 L 90.7 316.2 L 82.1 286.7 L 78.7 256 L 80.8 225.1 L 88.2 194.9 L 100.7 166.4 L 118.1 140.3 L 139.9 117.6 L 165.3 99 L 193.8 85 A 34 34 0 0 1 217 148.9 L 198.7 156.7 L 181.9 167.6 L 167.1 181.4 L 154.9 197.6 L 145.7 215.9 L 139.7 235.5 L 137.3 256 L 138.4 276.7 L 143.1 297.1 L 151.4 316.4 L 163 334.1 L 177.5 349.5 L 194.6 362.3 L 213.8 372 L 234.4 378.3 L 256 380.8 L 277.8 379.6 L 299.2 374.6 L 319.4 365.8 L 338 353.7 L 354.2 338.4 L 367.6 320.4 L 377.7 300.3 L 384.2 278.6 L 386.9 256 L 385.6 233.2 L 380.3 210.8 L 371.1 189.5 L 358.4 170.1 L 342.3 153.1 L 323.5 139.1 L 302.4 128.5 L 279.7 121.8 L 256 119 Z'

export function LogoAviControl({
  size = 32,
  tile = false,
  ...props
}: { size?: number; tile?: boolean } & SVGProps<SVGSVGElement>) {
  const small = size < 40
  return (
    <svg width={size} height={size} viewBox="0 0 512 512" fill="none" aria-hidden {...props}>
      {tile && <rect width="512" height="512" rx="118" fill="#153F27" />}
      <path
        d={RING}
        fill={tile ? '#FFFEFA' : 'currentColor'}
        {...(small
          ? { stroke: tile ? '#FFFEFA' : 'currentColor', strokeWidth: 20, strokeLinejoin: 'round' as const }
          : {})}
      />
      {!small && <circle cx="230.3" cy="110.3" r="16" fill={tile ? '#4FA968' : 'currentColor'} />}
    </svg>
  )
}
