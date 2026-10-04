import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { http, HttpResponse } from 'msw'
import { describe, expect, it } from 'vitest'
import { apiPath } from '../../api/client'
import { fakeApi } from '../../test/fakeApi'
import { renderApp } from '../../test/renderApp'
import { server } from '../../test/server'

async function open() {
  const user = userEvent.setup()
  renderApp('/agents/agent-support')
  const section = await screen.findByRole('region', { name: 'Deploy' })
  return { user, section: within(section) }
}

describe('Agent deploy', () => {
  it('shows the guarded URL and Agent Card on the panel origin', async () => {
    const { section } = await open()
    const origin = window.location.origin
    expect(section.getByText(`${origin}/a/agent-support`)).toBeInTheDocument()
    expect(section.getByText(`${origin}/a/agent-support/.well-known/agent-card.json`)).toBeInTheDocument()
    expect(section.getByText(/X-API-Key: \$GUARDRAIL_HUB_KEY/)).toBeInTheDocument()
  })

  it('creates a key, shows it once and puts it in the example', async () => {
    const { user, section } = await open()
    await user.click(section.getByRole('button', { name: 'Create key' }))
    expect(await section.findByText('ghk_test_1')).toBeInTheDocument()
    expect(section.getByText('Store it now, it won’t be shown again.')).toBeInTheDocument()
    expect(section.getByText(/X-API-Key: ghk_test_1/)).toBeInTheDocument()
    expect(fakeApi.gatewayKeys['agent-support']).toBe('ghk_test_1')

    await user.click(section.getByRole('button', { name: 'Copy key' }))
    expect(await navigator.clipboard.readText()).toBe('ghk_test_1')
    expect(section.getByRole('status')).toHaveTextContent('Key copied.')
  })

  it('requires confirmation before replacing a gateway key', async () => {
    const { user, section } = await open()
    await user.click(section.getByRole('button', { name: 'Create key' }))
    await section.findByText('ghk_test_1')

    await user.click(section.getByRole('button', { name: 'Create another key' }))
    expect(section.getByRole('group', { name: 'Confirm gateway key replacement' })).toBeInTheDocument()
    expect(section.getByText('Creating a key replaces the previous one; callers using it stop working.')).toBeInTheDocument()

    await user.click(section.getByRole('button', { name: 'Cancel' }))
    expect(section.queryByRole('group', { name: 'Confirm gateway key replacement' })).not.toBeInTheDocument()
    expect(fakeApi.gatewayKeys['agent-support']).toBe('ghk_test_1')

    await user.click(section.getByRole('button', { name: 'Create another key' }))
    await user.click(within(section.getByRole('group', { name: 'Confirm gateway key replacement' })).getByRole('button', {
      name: 'Create another key',
    }))
    expect(await section.findByText('ghk_test_2')).toBeInTheDocument()
    expect(fakeApi.gatewayKeys['agent-support']).toBe('ghk_test_2')
  })

  it("shows the API's message when the key can't be saved", async () => {
    server.use(
      http.post(apiPath('/agents/:id/gateway-key'), () =>
        HttpResponse.json({ detail: 'Could not save the gateway key' }, { status: 503 }),
      ),
    )
    const { user, section } = await open()
    await user.click(section.getByRole('button', { name: 'Create key' }))
    expect(await section.findByRole('alert')).toHaveTextContent('Could not save the gateway key')
  })
})
