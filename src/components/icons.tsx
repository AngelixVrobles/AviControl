import type { SVGProps } from 'react'
import { ANILLO, POLLITO, RADIO_TEJA, TINTA_MARCA } from '../lib/marca'

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

// Los ciclos son los pollos: el pulso de antes parecía cosa de hospital.
export const IconPollito = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)}>
    <circle cx="14" cy="7" r="3.2" />
    <path d="m17.2 6.6 2.8.9-2.6 1.1" />
    <path d="M11.2 9.3C7.3 9.6 4.5 12.2 4.5 15c0 2.6 2.4 4.5 6 4.5h1.5c3.3 0 5.5-2.3 5.5-5.2 0-1.5-.6-2.9-1.6-3.9" />
    <path d="M10 19.5v2M13 19.5v2" />
    <path d="M8.3 13.6c1.3 1.1 3.2 1.3 4.7.5" />
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

// La etiqueta de precio: la balanza de antes, de un solo plato, se leía como
// una copa de trofeo.
export const IconVenta = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)}>
    <path d="M20.6 13.4 13.4 20.6a2 2 0 0 1-2.8 0L3 13V3h10l7.6 7.6a2 2 0 0 1 0 2.8Z" />
    <circle cx="7.5" cy="7.5" r="1.5" />
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

// La marca: el anillo del ciclo con el pollito de un día adentro. Las formas
// salen de lib/marca, las mismas de public/icon.svg.
export function LogoAviControl({
  size = 32,
  tile = false,
  ...props
}: { size?: number; tile?: boolean } & SVGProps<SVGSVGElement>) {
  // Por debajo de 40 px el ala, el ojo y las patas no se ven: el anillo se
  // engrosa y el pollito queda en silueta.
  const chico = size < 40
  const t = TINTA_MARCA
  const anillo = tile ? t.anillo : 'currentColor'
  const pollito = tile ? t.pollito : 'currentColor'
  return (
    <svg width={size} height={size} viewBox="0 0 512 512" fill="none" aria-hidden {...props}>
      {tile && <rect width="512" height="512" rx={RADIO_TEJA} fill={t.fondo} />}
      <path
        d={ANILLO}
        fill={anillo}
        {...(chico ? { stroke: anillo, strokeWidth: 16, strokeLinejoin: 'round' as const } : {})}
      />
      {!chico &&
        POLLITO.patas.map((p) => (
          <rect key={p.x} x={p.x} y={p.y} width={p.w} height={p.h} rx={p.w / 2} fill={tile ? t.pico : 'currentColor'} />
        ))}
      <circle {...POLLITO.cuerpo} fill={pollito} />
      <circle {...POLLITO.cabeza} fill={pollito} />
      <path d={POLLITO.pico} fill={tile ? t.pico : 'currentColor'} />
      {tile && !chico && (
        <>
          <path d={POLLITO.ala} fill={t.ala} />
          <circle {...POLLITO.ojo} fill={t.fondo} />
        </>
      )}
    </svg>
  )
}
