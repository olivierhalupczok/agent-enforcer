import { TableFrame } from 'web'

const HEADERS = ['Agent', 'Agent URL', 'Auth header']
const cell = 'px-5 py-4 align-middle'
const ROWS = [
  { name: 'support-triage-bot', url: 'https://triage.internal.acme.dev', auth: 'X-Api-Key' },
  { name: 'invoice-reader', url: 'https://invoices.internal.acme.dev', auth: null },
  { name: 'sales-research', url: 'https://research.internal.acme.dev', auth: 'Authorization' },
]

export const AgentsTable = () => (
  <div className="bg-canvas p-6">
    <TableFrame label="Agents table">
      <table className="w-full min-w-[560px] border-collapse text-left text-sm">
        <thead className="bg-[#F9F9F6]">
          <tr className="border-b border-line text-[11px] tracking-[0.08em] text-muted uppercase">
            {HEADERS.map((header) => (
              <th key={header} scope="col" className="px-5 py-3.5 font-semibold">
                {header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {ROWS.map((row, i) => (
            <tr key={row.name} className={`border-b border-line last:border-b-0 ${i === 0 ? 'bg-teal-soft' : ''}`}>
              <td className={cell}>
                <a href="#" className="font-semibold text-ink">
                  {row.name}
                </a>
              </td>
              <td className={`${cell} font-mono text-[13px] break-all text-muted`}>{row.url}</td>
              <td className={`${cell} ${row.auth ? 'font-mono text-[13px]' : 'text-muted'}`}>{row.auth ?? 'None'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </TableFrame>
  </div>
)

export const StatusPills = () => (
  <div className="bg-canvas p-6">
    <TableFrame label="Guardrails table">
      <table className="w-full min-w-[560px] border-collapse text-left text-sm">
        <thead className="bg-[#F9F9F6]">
          <tr className="border-b border-line text-[11px] tracking-[0.08em] text-muted uppercase">
            {['Guardrail', 'Engine', 'Status'].map((h) => (
              <th key={h} scope="col" className="px-5 py-3.5 font-semibold">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {[
            ['Block prompt injection', 'regex', 'Mandatory', 'bg-teal-soft text-teal-dark'],
            ['Redact customer emails', 'presidio', 'Draft', 'bg-warn-bg text-warn-fg'],
            ['Cap tokens per reply', 'limit', 'Active', 'bg-teal-soft text-teal-dark'],
          ].map(([name, engine, status, tone]) => (
            <tr key={name} className="border-b border-line last:border-b-0">
              <td className={`${cell} font-semibold`}>{name}</td>
              <td className={`${cell} font-mono text-[13px] text-muted`}>{engine}</td>
              <td className={cell}>
                <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold whitespace-nowrap ${tone}`}>{status}</span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </TableFrame>
  </div>
)
