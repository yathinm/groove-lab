import { useEffect, useRef, useState } from 'react'

export function usePositionTicker(getPosition: () => number, isPlaying: boolean) {
  const [positionSec, setPositionSec] = useState(0)
  const rafRef = useRef<number | null>(null)

  useEffect(() => {
    const tick = () => {
      if (isPlaying) {
        const pos = getPosition()
        setPositionSec((prev) => (Math.abs(prev - pos) > 0.05 ? pos : prev))
      }
      rafRef.current = requestAnimationFrame(tick)
    }
    rafRef.current = requestAnimationFrame(tick)
    return () => {
      if (rafRef.current != null) cancelAnimationFrame(rafRef.current)
      rafRef.current = null
    }
  }, [getPosition, isPlaying])

  return { positionSec, setPositionSec }
}


