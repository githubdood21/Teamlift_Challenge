// @vitest-environment jsdom
import { cleanup, fireEvent, render } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
import { BounceButton } from './BounceButton'

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})
function setup(reduce = false, disabled = false) {
  vi.stubGlobal(
    'matchMedia',
    vi.fn(() => ({ matches: reduce })),
  )
  const onClick = vi.fn()
  const result = render(
    <BounceButton disabled={disabled} onClick={onClick}>
      Book
    </BounceButton>,
  )
  const button = result.getByRole('button')
  const cancel = vi.fn()
  const animate = vi.fn(() => ({ cancel }))
  Object.defineProperty(button, 'animate', { value: animate })
  return { ...result, button, onClick, cancel, animate }
}
it('plays a full bounce on each click, without ripples or delayed activation', () => {
  const { button, container, onClick, animate, cancel } = setup()
  fireEvent.click(button)
  fireEvent.click(button)
  expect(onClick).toHaveBeenCalledTimes(2)
  expect(animate).toHaveBeenLastCalledWith(
    expect.any(Array),
    expect.objectContaining({ duration: 440 }),
  )
  expect(cancel).toHaveBeenCalledOnce()
  expect(container.querySelector('.ripple')).toBeNull()
  cleanup()
  expect(cancel).toHaveBeenCalledTimes(2)
})
it('keeps reduced-motion clicks immediate without bouncing', () => {
  const { button, onClick, animate } = setup(true)
  fireEvent.click(button)
  expect(onClick).toHaveBeenCalledOnce()
  expect(animate).not.toHaveBeenCalled()
})
it('does not activate a disabled button', () => {
  const { button, onClick, animate } = setup(false, true)
  fireEvent.click(button)
  expect(onClick).not.toHaveBeenCalled()
  expect(animate).not.toHaveBeenCalled()
})
