// A ring for the Panel look (build-out item 1.5.2b): a track, and a fill drawn clockwise from the
// top for `fill` out of 100 (targetRing.ts works it out). Drawn for the eye only (aria-hidden):
// the words beside every ring say what it shows. With `fill` null the ring is not filled at all,
// as when no target is set. The fill draws itself in when the ring first appears (theme.css,
// 300 ms, none under reduced motion); give the ring a new key to draw it in again.

interface RingProps {
  size: number
  stroke: number
  fill: number | null
}

export function Ring({ size, stroke, fill }: RingProps) {
  const centre = size / 2
  const r = (size - stroke) / 2
  return (
    <svg className="ring" width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden="true" focusable="false">
      <circle className="ring-track" cx={centre} cy={centre} r={r} strokeWidth={stroke} pathLength={100} />
      {fill !== null && fill > 0 && (
        <circle
          className="ring-fill"
          cx={centre}
          cy={centre}
          r={r}
          strokeWidth={stroke}
          pathLength={100}
          style={{ strokeDasharray: `${fill} 100` }}
        />
      )}
    </svg>
  )
}
