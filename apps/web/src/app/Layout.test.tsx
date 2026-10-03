import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { renderApp } from '../test/renderApp'

const menuButton = () => screen.getByRole('button', { name: 'Menu' })
const sidebar = () => document.getElementById('app-sidebar')

async function openMenu() {
  const user = userEvent.setup()
  renderApp('/fleet')
  await user.click(menuButton())
  expect(menuButton()).toHaveAttribute('aria-expanded', 'true')
  expect(sidebar()).toHaveAttribute('data-open', 'true')
  return user
}

function expectClosed() {
  expect(menuButton()).toHaveAttribute('aria-expanded', 'false')
  expect(sidebar()).toHaveAttribute('data-open', 'false')
  expect(screen.queryByRole('button', { name: 'Close menu' })).not.toBeInTheDocument()
}

describe('phone drawer', () => {
  it('starts closed', () => {
    renderApp('/fleet')
    expectClosed()
  })

  it('closes on Escape', async () => {
    const user = await openMenu()
    await user.keyboard('{Escape}')
    expectClosed()
  })

  it('closes when a nav item is picked', async () => {
    const user = await openMenu()
    await user.click(screen.getByRole('link', { name: 'Policies' }))
    expectClosed()
    expect(screen.getByRole('heading', { level: 1, name: 'Policies' })).toBeInTheDocument()
  })

  it('closes when the backdrop is clicked', async () => {
    const user = await openMenu()
    await user.click(screen.getByRole('button', { name: 'Close menu' }))
    expectClosed()
  })

  it('closes when the role changes', async () => {
    const user = await openMenu()
    await user.click(screen.getByRole('button', { name: 'Developer' }))
    expectClosed()
  })

  it('toggles closed with the Menu button', async () => {
    const user = await openMenu()
    await user.click(menuButton())
    expectClosed()
  })
})
