import { Link } from 'react-router'
import type { Agent } from '../../api/types'
import { LoadingRows, TableFrame } from '../../ui/Page'
import { cardSummary } from './agentDisplay'

const HEADERS = ['Agent', 'Description', 'Agent URL', 'Agent Card', 'Auth header']
const cell = 'px-5 py-4 align-middle'

export function AgentsTable({ agents, highlightId }: { agents: readonly Agent[]; highlightId: string | null }) {
  return (
    <TableFrame label="Agents table">
      <table className="w-full min-w-[920px] border-collapse text-left text-sm">
        <thead className="bg-[#F9F9F6]">
          <tr className="border-b border-line text-[11px] tracking-[0.08em] text-muted uppercase">
            {HEADERS.map((header) => (
              <th key={header} scope="col" className="px-5 py-3.5 font-semibold">
                {header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>{agents.map((agent) => {
        const highlighted = agent.id === highlightId
        return (
          <tr
            key={agent.id}
            data-highlight={highlighted}
            className={`group border-b border-line transition-colors last:border-b-0 ${highlighted ? 'bg-teal-soft' : 'hover:bg-[#FAFAF7]'}`}
          >
            <td className={cell}>
              <Link to={`/agents/${agent.id}`} className="font-semibold text-ink group-hover:text-teal-dark">
                {agent.name}
              </Link>
            </td>
            <td className={`${cell} max-w-72 text-muted`}>{agent.description || '—'}</td>
            <td className={`${cell} font-mono text-[13px] break-all text-muted`}>{agent.base_url}</td>
            <td className={`${cell} whitespace-nowrap ${agent.agent_card ? '' : 'text-danger'}`}>
              {cardSummary(agent.agent_card)}
            </td>
            <td className={`${cell} ${agent.auth_header_name ? 'font-mono text-[13px]' : 'text-muted'}`}>
              {agent.auth_header_name ?? 'None'}
            </td>
          </tr>
        )
        })}</tbody>
      </table>
    </TableFrame>
  )
}

export function AgentsTableSkeleton() {
  return <LoadingRows label="Loading agents" count={4} />
}
