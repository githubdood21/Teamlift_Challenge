// @vitest-environment jsdom
import { cleanup, fireEvent, render } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
import { RippleSurface } from './RippleSurface'

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
function setup(reduce = false) {
  vi.stubGlobal(
    'matchMedia',
    vi.fn(() => ({ matches: reduce })),
  )
  const action = vi.fn()
  const result = render(
    <RippleSurface aria-label="Schedule">
      <h2>Surface content</h2>
      <button onClick={action}>Book</button>
      <label htmlFor="name">Name</label>
      <input id="name" />
    </RippleSurface>,
  )
  const surface = result.getByRole('region', { name: 'Schedule' })
  vi.spyOn(surface, 'getBoundingClientRect').mockReturnValue(
    new DOMRect(0, 0, 400, 300),
  )
  return { ...result, surface, action }
}
it('ripples across a static panel and removes the effect when complete', () => {
  const { container, surface } = setup()
  fireEvent.click(surface, { detail: 1, clientX: 40, clientY: 20 })
  const ripple = container.querySelector<HTMLElement>('.ripple')!
  expect(ripple.style.left).toBe('40px')
  expect(ripple.style.top).toBe('20px')
  expect(surface.getAttribute('tabindex')).toBeNull()
  fireEvent.animationEnd(ripple)
  expect(container.querySelector('.ripple')).toBeNull()
})
it('lets nested controls work without triggering a panel ripple', () => {
  const { container, getByRole, getByLabelText, action } = setup()
  fireEvent.click(getByRole('button'), { detail: 1 })
  fireEvent.click(getByLabelText('Name'), { detail: 1 })
  expect(action).toHaveBeenCalledOnce()
  expect(container.querySelector('.ripple')).toBeNull()
})
it('ripples when clicking static content inside a panel', () => {
  const { container, getByText } = setup()
  fireEvent.click(getByText('Surface content'), {
    detail: 1,
    clientX: 40,
    clientY: 20,
  })
  expect(container.querySelector('.ripple')).not.toBeNull()
})
it('does not create decorative motion for reduced-motion preferences', () => {
  const { container, surface } = setup(true)
  fireEvent.click(surface, { detail: 1 })
  expect(container.querySelector('.ripple')).toBeNull()
})
