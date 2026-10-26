import { useState, useEffect, useCallback } from 'react'
import TicketCard from './TicketCard'
import { fetchTickets, fetchDashboardSummary, updateTicketStatus } from '../api'

// ─── Summary stats displayed at the top ───────────────────────────────────────
function StatsBar({ summary, tickets }) {
  // Use server summary if available, otherwise compute from local ticket list
  const total      = summary?.total       ?? tickets.length
  const open       = summary?.open        ?? tickets.filter(t => t.status === 'Open').length
  const inProgress = summary?.in_progress ?? tickets.filter(t => t.status === 'In Progress').length
  const resolved   = summary?.resolved    ?? tickets.filter(t => t.status === 'Resolved').length
  const high       = summary?.high        ?? tickets.filter(t => t.priority === 'High').length

  const stats = [
    { label: 'Total Tickets', value: total,      icon: '🎫', color: 'bg-blue-50 border-blue-200 text-blue-700' },
    { label: 'Open',          value: open,       icon: '📬', color: 'bg-red-50 border-red-200 text-red-700' },
    { label: 'In Progress',   value: inProgress, icon: '⚙️',  color: 'bg-orange-50 border-orange-200 text-orange-700' },
    { label: 'Resolved',      value: resolved,   icon: '✅', color: 'bg-green-50 border-green-200 text-green-700' },
    { label: 'High Priority', value: high,       icon: '🔴', color: 'bg-pink-50 border-pink-200 text-pink-700' },
  ]

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 mb-6">
      {stats.map(s => (
        <div key={s.label} className={`rounded-xl border p-4 text-center ${s.color}`}>
          <div className="text-2xl mb-1">{s.icon}</div>
          <div className="text-2xl font-bold">{s.value}</div>
          <div className="text-xs font-medium mt-0.5">{s.label}</div>
        </div>
      ))}
    </div>
  )
}

// ─── Filter bar ───────────────────────────────────────────────────────────────
function FilterBar({ filter, setFilter, counts }) {
  const buttons = [
    { key: 'All', label: 'All', count: counts.total },
    { key: 'Open', label: 'Open', count: counts.open },
    { key: 'In Progress', label: 'In Progress', count: counts.inProgress },
    { key: 'Resolved', label: 'Resolved', count: counts.resolved },
  ]

  return (
    <div className="flex flex-wrap gap-2 mb-6">
      {buttons.map(b => (
        <button
          key={b.key}
          onClick={() => setFilter(b.key)}
          className={`px-4 py-1.5 rounded-full text-sm font-medium border transition-colors duration-200 flex items-center gap-1.5 ${
            filter === b.key
              ? 'bg-green-600 text-white border-green-600 shadow-sm'
              : 'bg-white text-gray-600 border-gray-200 hover:border-green-400 hover:text-green-600'
          }`}
        >
          <span>{b.label}</span>
          {typeof b.count === 'number' && (
            <span className={`text-xs px-1.5 py-0.2 rounded-full ${
              filter === b.key ? 'bg-green-700 text-white' : 'bg-gray-100 text-gray-600'
            }`}>
              {b.count}
            </span>
          )}
        </button>
      ))}
    </div>
  )
}

// ─── Main Dashboard component ─────────────────────────────────────────────────
export default function Dashboard() {
  const [tickets, setTickets] = useState([])
  const [summary, setSummary] = useState(null)
  const [filter, setFilter] = useState('All')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [actionError, setActionError] = useState(null)

  // Fetch all tickets & summary from the backend
  const loadData = useCallback(async () => {
    setLoading(true)
    setError(null)
    setActionError(null)

    try {
      // Fetch tickets and summary in parallel
      const [ticketsData, summaryData] = await Promise.all([
        fetchTickets(),
        fetchDashboardSummary().catch(() => null),
      ])
      setTickets(ticketsData)
      if (summaryData) setSummary(summaryData)
    } catch (err) {
      console.error('Error fetching dashboard data:', err)
      setError(
  'Unable to connect to the backend server at https://greencampus-ai-tfjl.onrender.com. ' +
  'Please check that the backend is running and try again.'
)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadData()
  }, [loadData])

  // Handle status update from a ticket card
  const handleStatusChange = async (ticketId, newStatus) => {
    setActionError(null)
    try {
      const updatedTicket = await updateTicketStatus(ticketId, newStatus)

      // Update local ticket list
      setTickets(prev =>
        prev.map(t => (t.id === ticketId ? { ...t, ...updatedTicket } : t))
      )

      // Re-fetch summary in background to update counts accurately
      fetchDashboardSummary().then(setSummary).catch(() => {})
    } catch (err) {
      console.error(`Failed to update status for ticket #${ticketId}:`, err)
      setActionError(`Could not update ticket #${ticketId}: ${err.message}`)
    }
  }

  // Filter tickets by selected status
  const filtered = filter === 'All'
    ? tickets
    : tickets.filter(t => t.status === filter)

  // Computed counts for filter pills
  const counts = {
    total:      tickets.length,
    open:       tickets.filter(t => t.status === 'Open').length,
    inProgress: tickets.filter(t => t.status === 'In Progress').length,
    resolved:   tickets.filter(t => t.status === 'Resolved').length,
  }

  return (
    <div>
      {/* Page header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <div>
          <h2 className="text-2xl font-bold text-gray-800">Admin Dashboard</h2>
          <p className="text-gray-500 text-sm mt-1">
            Monitor and manage live campus issue reports. Powered by AI categorisation and real SQLite persistence.
          </p>
        </div>
        <button
          onClick={loadData}
          disabled={loading}
          className="self-start sm:self-auto px-4 py-2 bg-white border border-gray-200 text-gray-700 text-sm font-medium rounded-lg hover:bg-gray-50 hover:border-gray-300 transition-colors flex items-center gap-2 shadow-sm disabled:opacity-50"
          title="Reload tickets from server"
        >
          <span className={loading ? 'animate-spin' : ''}>🔄</span>
          <span>Refresh</span>
        </button>
      </div>

      {/* Action error banner (e.g. status change failure) */}
      {actionError && (
        <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700 flex items-start justify-between gap-2">
          <div className="flex items-center gap-2">
            <span>⚠️</span>
            <span>{actionError}</span>
          </div>
          <button
            onClick={() => setActionError(null)}
            className="text-red-500 hover:text-red-700 font-bold"
          >
            ✕
          </button>
        </div>
      )}

      {/* Backend connection error banner */}
      {error ? (
        <div className="p-8 bg-red-50 border border-red-200 rounded-2xl text-center my-6">
          <div className="text-4xl mb-3">⚠️</div>
          <h3 className="text-lg font-bold text-red-800 mb-2">Backend Connection Error</h3>
          <p className="text-sm text-red-600 max-w-xl mx-auto mb-5 leading-relaxed">
            {error}
          </p>
          <button
            onClick={loadData}
            className="px-5 py-2.5 bg-red-600 text-white rounded-lg text-sm font-medium hover:bg-red-700 transition-colors shadow-sm"
          >
            🔄 Retry Connection
          </button>
        </div>
      ) : (
        <>
          {/* Summary stats bar */}
          <StatsBar summary={summary} tickets={tickets} />

          {/* Filter bar */}
          <FilterBar filter={filter} setFilter={setFilter} counts={counts} />

          {/* Ticket grid / Loading / Empty states */}
          {loading ? (
            <div className="text-center py-20 text-gray-400">
              <div className="inline-block animate-spin text-3xl mb-3">🌿</div>
              <p className="text-base font-medium text-gray-600">Loading tickets from database…</p>
            </div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-16 bg-white rounded-2xl border border-gray-200 p-8 shadow-sm">
              <p className="text-4xl mb-3">🎉</p>
              <p className="text-lg font-medium text-gray-700">No tickets with status &quot;{filter}&quot;</p>
              <p className="text-sm text-gray-400 mt-1">
                {tickets.length === 0
                  ? 'No reports submitted yet. Use the "Report Issue" tab to create one.'
                  : 'Try selecting a different status filter above.'}
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {filtered.map(ticket => (
                <TicketCard
                  key={ticket.id}
                  ticket={ticket}
                  onStatusChange={handleStatusChange}
                />
              ))}
            </div>
          )}

          {/* Live sync footer badge */}
          <div className="mt-8 flex items-center justify-between p-3 bg-green-50 border border-green-200 rounded-xl text-xs text-green-800">
            <span className="flex items-center gap-1.5 font-medium">
              <span className="h-2 w-2 rounded-full bg-green-500 animate-pulse"></span>
              Connected to SQLite Backend (https://greencampus-ai-tfjl.onrender.com)
            </span>
            <span className="text-green-600">
              {tickets.length} total ticket{tickets.length === 1 ? '' : 's'} loaded
            </span>
          </div>
        </>
      )}
    </div>
  )
}
