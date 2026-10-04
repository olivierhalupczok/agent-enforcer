import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { fakeApi } from '../../test/fakeApi'
import { renderApp } from '../../test/renderApp'

const section = () => screen.getByRole('region', { name: 'Injection signatures' })

async function open(role: 'admin' | 'dev' = 'admin') {
  const user = userEvent.setup()
  renderApp('/guardrails', role)
  await within(await screen.findByRole('region', { name: 'Injection signatures' })).findByText('ignore-instructions')
  return user
}

describe('Injection signatures', () => {
  it('lists the company signatures', async () => {
    await open()
    expect(within(section()).getByText('reveal-prompt')).toBeInTheDocument()
    expect(within(section()).getByText(/\(reveal\|print\|repeat\)/)).toBeInTheDocument()
  })

  it('lets admins add a signature', async () => {
    const user = await open()
    await user.click(within(section()).getByRole('button', { name: 'Add signature' }))
    await user.type(screen.getByLabelText('Signature id'), 'pirate-speak')
    await user.type(screen.getByLabelText('Regex'), '(?i)arr matey')
    await user.click(within(section()).getByRole('button', { name: 'Save' }))
    expect(await within(section()).findByText('pirate-speak')).toBeInTheDocument()
    expect(within(section()).getByRole('button', { name: 'Add signature' })).toHaveFocus()
    expect(fakeApi.signatures.at(-1)).toEqual({ id: 'pirate-speak', regex: '(?i)arr matey' })
  })

  it('shows the duplicate-id error', async () => {
    const user = await open()
    await user.click(within(section()).getByRole('button', { name: 'Add signature' }))
    await user.type(screen.getByLabelText('Signature id'), 'reveal-prompt')
    await user.type(screen.getByLabelText('Regex'), 'x')
    await user.click(within(section()).getByRole('button', { name: 'Save' }))
    expect(await within(section()).findByText('A signature with this id already exists')).toBeInTheDocument()
  })

  it('lets admins delete a signature', async () => {
    const user = await open()
    await user.click(within(section()).getByRole('button', { name: 'Delete ignore-instructions' }))
    expect(within(section()).getByText('Delete ignore-instructions?')).toBeInTheDocument()
    await user.click(within(section()).getByRole('button', { name: 'Confirm delete ignore-instructions' }))
    await within(section()).findByText('reveal-prompt')
    expect(within(section()).queryByText('ignore-instructions')).not.toBeInTheDocument()
    expect(fakeApi.signatures.map((s) => s.id)).toEqual(['reveal-prompt'])
    expect(within(section()).getByRole('button', { name: 'Add signature' })).toHaveFocus()
  })

  it('shows an empty state when no signatures are configured', async () => {
    fakeApi.signatures = []
    renderApp('/guardrails', 'admin')
    expect(await within(section()).findByText('No injection signatures')).toBeInTheDocument()
    expect(within(section()).getByText('No company-wide signatures are configured.')).toBeInTheDocument()
  })

  it('is read-only for developers', async () => {
    await open('dev')
    expect(within(section()).getByText('Read-only for developers')).toBeInTheDocument()
    expect(within(section()).queryByRole('button')).not.toBeInTheDocument()
  })
})
