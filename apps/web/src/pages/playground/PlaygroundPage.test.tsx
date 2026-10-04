import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { http, HttpResponse } from 'msw'
import { describe, expect, it } from 'vitest'
import { apiPath } from '../../api/client'
import { renderApp } from '../../test/renderApp'
import { server } from '../../test/server'

describe('PlaygroundPage', () => {
  it('clears results when the simulated host changes', async () => {
    const user = userEvent.setup()
    renderApp('/playground', undefined, { mode: 'agent' })
    await user.click((await screen.findAllByRole('button', { name: 'Run scenario' }))[0])
    expect(await screen.findByText('simulated pi output (test double)')).toBeInTheDocument()

    await user.selectOptions(screen.getByLabelText('Simulated host'), 'amir')
    expect(screen.queryByText('simulated pi output (test double)')).not.toBeInTheDocument()
  })

  it('keeps the heading and disables runs when hosts fail', async () => {
    server.use(http.get(apiPath('/pi/playground/hosts'), () => HttpResponse.error(), { once: true }))
    renderApp('/playground', undefined, { mode: 'agent' })

    expect(screen.getByRole('heading', { name: 'Playground' })).toBeInTheDocument()
    expect(await screen.findByRole('alert')).toHaveTextContent("Couldn't load playground hosts")
    await waitFor(() => expect(screen.getAllByRole('button', { name: 'Run scenario' })[0]).toBeDisabled())
  })

  it('announces sandbox reset failures as alerts', async () => {
    const user = userEvent.setup()
    server.use(
      http.post(
        apiPath('/pi/playground/reset-sandbox'),
        () => HttpResponse.json({ detail: 'Sandbox unavailable.' }, { status: 500 }),
        { once: true },
      ),
    )
    renderApp('/playground', undefined, { mode: 'agent' })
    await user.click(await screen.findByRole('button', { name: 'Reset sandbox' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('Sandbox unavailable')
  })
})
