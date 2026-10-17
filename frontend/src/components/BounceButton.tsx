import { useEffect, useRef } from 'react'
import type { ButtonHTMLAttributes, MouseEvent } from 'react'

// Every click plays a full elapsed-time bounce, independent of press duration.
export function BounceButton({
  children,
  className = '',
  onClick,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement>) {
  const bounce = useRef<Animation | null>(null)

  useEffect(
    () => () => {
      bounce.current?.cancel()
    },
    [],
  )

  function click(event: MouseEvent<HTMLButtonElement>) {
    if (!window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      const button = event.currentTarget
      if (typeof button.animate === 'function') {
        const style = getComputedStyle(button)
        const currentTransform = style.transform
        const press = style.getPropertyValue('--button-press').trim() || '0.94'
        const rebound =
          style.getPropertyValue('--button-rebound').trim() || '1.035'
        const seconds =
          Number.parseFloat(style.getPropertyValue('--motion-bounce')) || 0.44
        bounce.current?.cancel()
        bounce.current = button.animate(
          [
            {
              transform:
                currentTransform === 'none' ? 'scale(1)' : currentTransform,
            },
            { transform: `scale(${press})`, offset: 0.2 },
            { transform: `scale(${rebound})`, offset: 0.55 },
            { transform: 'scale(0.99)', offset: 0.8 },
            { transform: 'scale(1)' },
          ],
          { duration: seconds * 1000, easing: 'ease-in-out' },
        )
      }
    }
    // Feedback never delays selection or the network request.
    onClick?.(event)
  }

  return (
    <button {...props} className={'bounce-button ' + className} onClick={click}>
      {children}
    </button>
  )
}
