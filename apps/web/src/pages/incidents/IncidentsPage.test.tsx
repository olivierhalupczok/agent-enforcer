import { screen } from '@testing-library/react'
import { http, HttpResponse } from 'msw'
import { describe, expect, it } from 'vitest'
import { apiPath } from '../../api/client'
import { renderApp } from '../../test/renderApp'
import { server } from '../../test/server'

describe('IncidentsPage', () => {
  it('shows query errors without leaving the loading state visible', async () => {
    server.use(http.get(apiPath('/pi/incidents'), () => HttpResponse.error(), { once: true }))
    renderApp('/incidents', undefined, { mode: 'agent' })

    expect(screen.getByRole('heading', { name: 'Incidents' })).toBeInTheDocument()
    expect(await screen.findByRole('alert')).toHaveTextContent("Couldn't load incidents")
    expect(screen.queryByRole('status', { name: 'Loading incidents' })).not.toBeInTheDocument()
  })
})
