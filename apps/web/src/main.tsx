import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import { Placeholder } from './pages/Placeholder'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Placeholder title="Guardrail Hub" issue="D-01" />
  </StrictMode>,
)
