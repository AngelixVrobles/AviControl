import { useEffect, useRef, useState } from 'react'

export function AnimatedNumber({
  value,
  format,
  duration = 700,
}: {
  value: number
  format: (n: number) => string
  duration?: number
}) {
  const [shown, setShown] = useState(value)
  const shownRef = useRef(value)
  const raf = useRef(0)

  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      shownRef.current = value
      setShown(value)
      return
    }
    const start = performance.now()
    const initial = shownRef.current
    const delta = value - initial
    if (delta === 0) return
    const tick = (t: number) => {
      const p = Math.min(1, (t - start) / duration)
      const eased = 1 - Math.pow(1 - p, 3)
      const actual = initial + delta * eased
      shownRef.current = actual
      setShown(actual)
      if (p < 1) raf.current = requestAnimationFrame(tick)
    }
    raf.current = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf.current)
  }, [value, duration])

  return <span className="tnum">{format(shown)}</span>
}
