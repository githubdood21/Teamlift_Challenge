import { useEffect, useState } from 'react'
import { RefreshCw } from 'lucide-react'

export function RefreshButton({
  label = 'Refresh available times',
  loading,
  busy,
  onRefresh,
}: {
  label?: string
  loading: boolean
  busy: boolean
  onRefresh: () => void
}) {
  const [spinning, setSpinning] = useState(false)

  useEffect(() => {
    const motion = window.matchMedia('(prefers-reduced-motion: reduce)')
    function updateMotion() {
      if (motion.matches) setSpinning(false)
      else if (loading) setSpinning(true)
    }
    updateMotion()
    motion.addEventListener('change', updateMotion)
    return () => motion.removeEventListener('change', updateMotion)
  }, [loading])

  function refresh() {
    if (!window.matchMedia('(prefers-reduced-motion: reduce)').matches)
      setSpinning(true)
    onRefresh()
  }

  return (
    <button
      className="icon-button refresh-button"
      type="button"
      aria-label={label}
      aria-busy={loading}
      data-spinning={spinning}
      disabled={loading || busy || spinning}
      onClick={refresh}
    >
      <RefreshCw
        size={18}
        strokeWidth={1.75}
        aria-hidden="true"
        onAnimationIteration={() => {
          // Stop only at a complete revolution, never halfway through a turn.
          if (!loading) setSpinning(false)
        }}
      />
    </button>
  )
}
