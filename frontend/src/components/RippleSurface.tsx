import { useRef, useState } from 'react'
import type { HTMLAttributes, MouseEvent } from 'react'

type Ripple = { id: number; x: number; y: number; diameter: number }
type SurfaceProps = HTMLAttributes<HTMLElement> & {
  as?: 'section' | 'aside' | 'span'
}

// Decorative feedback on static surfaces; preserves their semantics and tab order.
export function RippleSurface({
  as: Tag = 'section',
  className = '',
  children,
  onClick,
  ...props
}: SurfaceProps) {
  const [ripples, setRipples] = useState<Ripple[]>([])
  const nextId = useRef(0)

  function click(event: MouseEvent<HTMLElement>) {
    onClick?.(event)
    if (
      event.defaultPrevented ||
      event.detail === 0 ||
      window.matchMedia('(prefers-reduced-motion: reduce)').matches
    )
      return
    const target = event.target
    if (
      !(target instanceof Element) ||
      target.closest(
        'button, a, input, select, textarea, label, summary, [role="button"], [contenteditable="true"]',
      ) ||
      target.closest('[data-ripple-surface]') !== event.currentTarget ||
      window.getSelection()?.isCollapsed === false
    )
      return
    const bounds = event.currentTarget.getBoundingClientRect()
    const x = event.clientX - bounds.left
    const y = event.clientY - bounds.top
    const diameter =
      2 *
      Math.hypot(Math.max(x, bounds.width - x), Math.max(y, bounds.height - y))
    setRipples((previous) => [
      ...previous.slice(-3),
      { id: nextId.current++, x, y, diameter },
    ])
  }

  return (
    <Tag
      {...props}
      className={'ripple-surface ' + className}
      data-ripple-surface=""
      onClick={click}
    >
      {children}
      <span className="ripple-layer" aria-hidden="true">
        {ripples.map((ripple) => (
          <span
            className="ripple"
            key={ripple.id}
            style={{
              left: ripple.x,
              top: ripple.y,
              width: ripple.diameter,
              height: ripple.diameter,
            }}
            onAnimationEnd={() =>
              setRipples((previous) =>
                previous.filter((item) => item.id !== ripple.id),
              )
            }
          />
        ))}
      </span>
    </Tag>
  )
}
