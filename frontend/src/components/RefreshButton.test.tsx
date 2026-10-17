// @vitest-environment jsdom
import { cleanup, fireEvent, render } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
import { RefreshButton } from './RefreshButton'

vi.hoisted(() =>
  Object.defineProperty(window, 'AnimationEvent', {
    value: Event,
    configurable: true,
  }),
)
afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})
function motion(reduce = false) {
  vi.stubGlobal('matchMedia', () => ({
    matches: reduce,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  }))
}

it('updates immediately but completes a full turn after a fast request', () => {
  motion()
  const refresh = vi.fn()
  const { getByRole, rerender } = render(
    <RefreshButton loading={false} busy={false} onRefresh={refresh} />,
  )
  const button = getByRole('button') as HTMLButtonElement
  fireEvent.click(button)
  expect(refresh).toHaveBeenCalledOnce()
  rerender(<RefreshButton loading={true} busy={false} onRefresh={refresh} />)
  rerender(<RefreshButton loading={false} busy={false} onRefresh={refresh} />)
  expect(button.dataset.spinning).toBe('true')
  expect(button.getAttribute('aria-busy')).toBe('false')
  fireEvent.animationIteration(button.querySelector('svg')!)
  expect(button.dataset.spinning).toBe('false')
  expect(button.disabled).toBe(false)
})

it('keeps turning while loading and stops at the next completed turn afterward', () => {
  motion()
  const { getByRole, rerender } = render(
    <RefreshButton loading busy={false} onRefresh={() => {}} />,
  )
  const button = getByRole('button') as HTMLButtonElement
  fireEvent.animationIteration(button.querySelector('svg')!)
  expect(button.dataset.spinning).toBe('true')
  rerender(<RefreshButton loading={false} busy={false} onRefresh={() => {}} />)
  expect(button.dataset.spinning).toBe('true')
  fireEvent.animationIteration(button.querySelector('svg')!)
  expect(button.dataset.spinning).toBe('false')
})

it('does not wait for a disabled animation under reduced motion', () => {
  motion(true)
  const refresh = vi.fn()
  const { getByRole } = render(
    <RefreshButton loading={false} busy={false} onRefresh={refresh} />,
  )
  const button = getByRole('button') as HTMLButtonElement
  fireEvent.click(button)
  expect(refresh).toHaveBeenCalledOnce()
  expect(button.dataset.spinning).toBe('false')
  expect(button.disabled).toBe(false)
})
