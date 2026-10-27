import { useState, useEffect, useCallback, useMemo } from 'react'
import TicketCard from './TicketCard'
import { fetchTickets, fetchDashboardSummary, updateTicketStatus } from '../api'

// ─── Summary Stats Bar with Resolution Rate & Hover Animations ────────────────
function StatsBar({ summary, tickets }) {
  const total      = summary?.total       ?? tickets.length
  const open       = summary?.open        ?? tickets.filter(t => t.status === 'Open').length
  const inProgress = summary?.in_progress ?? tickets.filter(t => t.status === 'In Progress').length
  const resolved   = summary?.resolved    ?? tickets.filter(t => t.status === 'Resolved').length
  const high       = summary?.high        ?? tickets.filter(t => t.priority === 'High').length

  const resolutionRate = total > 0 ? Math.round((resolved / total) * 100) : 0

  const stats = [
    { label: 'Total Reports',  value: total,      icon: '🎫', bg: 'bg-gradient-to-br from-blue-50 to-indigo-50 border-blue-200 text-blue-800' },
    { label: 'Open',           value: open,       icon: '📬', bg: 'bg-gradient-to-br from-red-50 to-rose-50 border-red-200 text-red-700' },
    { label: 'In Progress',    value: inProgress, icon: '⚙️',  bg: 'bg-gradient-to-br from-amber-50 to-orange-50 border-amber-200 text-amber-800' },
    { label: 'Resolved',       value: resolved,   icon: '✅', bg: 'bg-gradient-to-br from-emerald-50 to-teal-50 border-emerald-200 text-emerald-800' },
    { label: 'High Urgency',   value: high,       icon: '🚨', bg: 'bg-gradient-to-br from-pink-50 to-rose-100 border-pink-200 text-pink-700' },
  ]

  return (
    <div className="mb-6 space-y-4">
      {/* 5 Top KPI Cards with Hover Lift */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3.5">
        {stats.map(s => (
        <div
          key={s.label}
          className={`rounded-2xl border p-4 text-center transition-all duration-300 transform hover:-translate-y-1.5 hover:shadow-lg shadow-sm cursor-pointer backdrop-blur-sm ${s.bg}`}
          onClick={() => s.label === 'Total Reports' && setShowTotalModal(true)}
        >
          <div className="text-2xl mb-1.5 transform hover:scale-110 transition-transform">{s.icon}</div>
          <div className="text-3xl font-extrabold tracking-tight">{s.value}</div>
          <div className="text-xs font-semibold mt-0.5 opacity-90">{s.label}</div>
        </div>
      ))}
          <div
            key={s.label}
            className={`rounded-2xl border p-4 text-center transition-all duration-300 transform hover:-translate-y-1.5 hover:shadow-lg shadow-sm cursor-default backdrop-blur-sm ${s.bg}`}
          >
            <div className="text-2xl mb-1.5 transform hover:scale-110 transition-transform">{s.icon}</div>
            <div className="text-3xl font-extrabold tracking-tight">{s.value}</div>
            <div className="text-xs font-semibold mt-0.5 opacity-90">{s.label}</div>
          </div>
        ))}
      </div>

      {/* Resolution Rate Progress Meter */}
      <div className="p-4 bg-white rounded-2xl border border-gray-200 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-emerald-500/10 text-emerald-600 flex items-center justify-center text-lg font-bold">
            📈
          </div>
          <div>
            <h4 className="text-xs font-bold text-gray-700">Campus Resolution Efficiency</h4>
            <p className="text-[11px] text-gray-400">Ratio of resolved issues vs total campus complaints</p>
          </div>
        </div>

        <div className="flex items-center gap-3 flex-1 max-w-md sm:ml-4">
          <div className="w-full bg-gray-100 rounded-full h-2.5 overflow-hidden border border-gray-200/60">
            <div
              className="bg-gradient-to-r from-emerald-500 to-teal-500 h-2.5 rounded-full transition-all duration-700 shadow-xs"
              style={{ width: `${Math.max(5, resolutionRate)}%` }}
            ></div>
          </div>
          <span className="text-xs font-extrabold text-emerald-700 font-mono flex-shrink-0">
            {resolutionRate}%
          </span>
        </div>
      </div>
    </div>
  )
}

// ─── Filter Bar + Search Bar ────────────────────────────────────────────────
function FilterAndSearchBar({
  filter,
  setFilter,
  selectedCategory,
  setSelectedCategory,
  searchQuery,
  setSearchQuery,
  counts,
  categories,
}) {
  const statusButtons = [
    { key: 'All', label: 'All', count: counts.total },
    { key: 'Open', label: 'Open', count: counts.open },
    { key: 'In Progress', label: 'In Progress', count: counts.inProgress },
    { key: 'Resolved', label: 'Resolved', count: counts.resolved },
  ]

  return (
    <div className="bg-white p-4 rounded-2xl border border-gray-200/80 shadow-sm mb-6 space-y-3.5">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
        {/* Status Pill Filters */}
        <div className="flex flex-wrap items-center gap-2">
          {statusButtons.map(b => (
            <button
              key={b.key}
              onClick={() => setFilter(b.key)}
              className={`px-3.5 py-1.5 rounded-full text-xs font-bold border transition-all duration-200 flex items-center gap-1.5 ${
                filter === b.key
                  ? 'bg-emerald-600 text-white border-emerald-600 shadow-sm shadow-emerald-600/20 scale-102'
                  : 'bg-gray-50 text-gray-600 border-gray-200 hover:bg-gray-100'
              }`}
            >
              <span>{b.label}</span>
              {typeof b.count === 'number' && (
                <span className={`text-[10px] px-1.5 py-0.2 rounded-full ${
                  filter === b.key ? 'bg-emerald-700 text-white' : 'bg-gray-200 text-gray-600'
                }`}>
                  {b.count}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* Live Search Input */}
        <div className="relative flex-1 max-w-sm">
          <span className="absolute left-3 top-2.5 text-gray-400 text-sm">🔍</span>
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search tickets by title, room, block..."
            className="w-full bg-gray-50 border border-gray-200 rounded-xl pl-9 pr-3 py-1.5 text-xs text-gray-700 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all placeholder-gray-400"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-3 top-2 text-gray-400 hover:text-gray-600 text-xs"
            >
              ✕
            </button>
          )}
        </div>
      </div>

      {/* Category Tag Pills */}
      <div className="flex items-center gap-1.5 overflow-x-auto pt-2 border-t border-gray-100 no-scrollbar">
        <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider flex-shrink-0 mr-1">
          Category:
        </span>
        {categories.map(cat => (
          <button
            key={cat}
            onClick={() => setSelectedCategory(cat)}
            className={`flex-shrink-0 text-[11px] px-2.5 py-1 rounded-lg font-medium transition-all ${
              selectedCategory === cat
                ? 'bg-emerald-100 text-emerald-800 font-bold border border-emerald-300'
                : 'bg-gray-50 hover:bg-gray-100 text-gray-600 border border-transparent'
            }`}
          >
            {cat}
          </button>
        ))}
      </div>
    </div>
  )
}

// ─── Main Dashboard Component ─────────────────────────────────────────────────
import Modal from './Modal.jsx';

export default function Dashboard() {
  // Modal for Total Reports details
  // Imported from ./Modal.jsx
  // Modal for Total Reports details
  // Imported from ./Modal.jsx
  const [showTotalModal, setShowTotalModal] = useState(false);
  const [tickets, setTickets] = useState([])
  const [summary, setSummary] = useState(null)
  const [filter, setFilter] = useState('All')
  const [selectedCategory, setSelectedCategory] = useState('All')
  const [searchQuery, setSearchQuery] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [actionError, setActionError] = useState(null)

  // Fetch tickets & summary from backend
  const loadData = useCallback(async () => {
    setLoading(true)
    setError(null)
    setActionError(null)

    try {
      const [ticketsData, summaryData] = await Promise.all([
        fetchTickets(),
        fetchDashboardSummary().catch(() => null),
      ])
      setTickets(ticketsData)
      if (summaryData) setSummary(summaryData)
    } catch (err) {
      console.error('Error fetching dashboard data:', err)
      setError(
        'Unable to connect to the backend server. Please verify the backend is online and try again.'
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
      setTickets(prev =>
        prev.map(t => (t.id === ticketId ? { ...t, ...updatedTicket } : t))
      )
      fetchDashboardSummary().then(setSummary).catch(() => {})
    } catch (err) {
      console.error(`Failed to update status for ticket #${ticketId}:`, err)
      setActionError(`Could not update ticket #${ticketId}: ${err.message}`)
    }
  }

  // Derive unique categories from current ticket list
  const categories = useMemo(() => {
    const set = new Set(tickets.map(t => t.category).filter(Boolean))
    return ['All', ...Array.from(set)]
  }, [tickets])

  // Urgent active tickets (High Priority + not resolved)
  const urgentTickets = useMemo(() => {
    return tickets.filter(t => t.priority === 'High' && t.status !== 'Resolved')
  }, [tickets])

  // Filter and search
  const filtered = useMemo(() => {
    return tickets.filter(t => {
      const matchStatus = filter === 'All' || t.status === filter
      const matchCat = selectedCategory === 'All' || t.category === selectedCategory
      const query = searchQuery.trim().toLowerCase()
      const matchSearch =
        !query ||
        t.title.toLowerCase().includes(query) ||
        t.description.toLowerCase().includes(query) ||
        t.location.toLowerCase().includes(query) ||
        (t.department && t.department.toLowerCase().includes(query))

      return matchStatus && matchCat && matchSearch
    })
  }, [tickets, filter, selectedCategory, searchQuery])

  const counts = {
    total:      tickets.length,
    open:       tickets.filter(t => t.status === 'Open').length,
    inProgress: tickets.filter(t => t.status === 'In Progress').length,
    resolved:   tickets.filter(t => t.status === 'Resolved').length,
  }

  return (
    <div>
      {/* Animated Emergency Alert Banner (shown when High Priority issues exist) */}
      {urgentTickets.length > 0 && (
        <div className="mb-6 overflow-hidden rounded-2xl bg-gradient-to-r from-red-600 via-rose-600 to-amber-600 text-white p-3.5 sm:p-4 shadow-lg shadow-red-600/20 flex flex-col sm:flex-row sm:items-center justify-between gap-3 animate-fade-in border border-red-400/40">
          <div className="flex items-center gap-3 overflow-hidden">
            <span className="px-2.5 py-1 rounded-full bg-white text-red-700 text-[10px] font-black uppercase tracking-wider flex-shrink-0 animate-pulse shadow-xs">
              🚨 LIVE URGENT HAZARD
            </span>
            <p className="text-xs sm:text-sm font-bold truncate">
              {urgentTickets[0].title} — 📍 {urgentTickets[0].location} ({urgentTickets[0].status})
            </p>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            <span className="text-[11px] text-red-100 hidden sm:inline">
              {urgentTickets.length} active high-risk issue{urgentTickets.length > 1 ? 's' : ''}
            </span>
            <button
              onClick={() => {
                setFilter('All')
                setSearchQuery(urgentTickets[0].title)
              }}
              className="text-xs bg-white/20 hover:bg-white text-white hover:text-red-700 px-3 py-1 rounded-lg font-bold transition-all"
            >
              Inspect Ticket →
            </button>
          </div>
        </div>
      )}

            {/* Modal for Total Reports */}
      <Modal isOpen={showTotalModal} onClose={() => setShowTotalModal(false)}>
        <h2 className="text-xl font-bold mb-4">Total Reports Overview</h2>
        <div className="grid grid-cols-2 gap-4">
          <div className="p-3 bg-emerald-50 rounded-lg border border-emerald-200">
            <p className="text-sm font-medium text-emerald-800">Total Reports</p>
            <p className="text-2xl font-bold text-emerald-900">{counts.total}</p>
          </div>
          <div className="p-3 bg-blue-50 rounded-lg border border-blue-200">
            <p className="text-sm font-medium text-blue-800">Open</p>
            <p className="text-2xl font-bold text-blue-900">{counts.open}</p>
          </div>
          <div className="p-3 bg-amber-50 rounded-lg border border-amber-200">
            <p className="text-sm font-medium text-amber-800">In Progress</p>
            <p className="text-2xl font-bold text-amber-900">{counts.inProgress}</p>
          </div>
          <div className="p-3 bg-teal-50 rounded-lg border border-teal-200">
            <p className="text-sm font-medium text-teal-800">Resolved</p>
            <p className="text-2xl font-bold text-teal-900">{counts.resolved}</p>
          </div>
        </div>
        <div className="mt-4 text-right">
          <button
            className="px-4 py-2 bg-emerald-600 text-white rounded hover:bg-emerald-700 transition"
            onClick={() => setShowTotalModal(false)}
          >
            Close
          </button>
        </div>
      </Modal>
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <div>
          <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-700 text-[11px] font-bold mb-1.5">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
            Real-Time Facilities Command
          </div>
          <h2 className="text-2xl sm:text-3xl font-extrabold text-gray-900 tracking-tight">
            Campus Operations Dashboard
          </h2>
          <p className="text-gray-500 text-xs sm:text-sm mt-0.5">
            Automated issue classification, risk priority analysis, and live maintenance workflows.
          </p>
        </div>

        <button
          onClick={loadData}
          disabled={loading}
          className="self-start sm:self-auto px-4 py-2 bg-white hover:bg-gray-50 border border-gray-200 text-gray-700 text-xs font-bold rounded-xl transition-all flex items-center gap-2 shadow-xs hover:shadow-sm disabled:opacity-50"
          title="Reload tickets from server"
        >
          <span className={loading ? 'animate-spin' : ''}>🔄</span>
          <span>{loading ? 'Syncing...' : 'Live Refresh'}</span>
        </button>
      </div>

      {/* Action error banner */}
      {actionError && (
        <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-2xl text-xs text-red-700 flex items-start justify-between gap-2 animate-fade-in">
          <div className="flex items-center gap-2">
            <span>⚠️</span>
            <span>{actionError}</span>
          </div>
          <button onClick={() => setActionError(null)} className="text-red-500 hover:text-red-700 font-bold">✕</button>
        </div>
      )}

      {/* Backend connection error banner */}
      {error ? (
        <div className="p-8 bg-red-50 border border-red-200 rounded-3xl text-center my-6 shadow-sm">
          <div className="text-4xl mb-3">⚠️</div>
          <h3 className="text-lg font-bold text-red-800 mb-2">Backend Connection Error</h3>
          <p className="text-xs text-red-600 max-w-xl mx-auto mb-5 leading-relaxed">
            {error}
          </p>
          <button
            onClick={loadData}
            className="px-5 py-2.5 bg-red-600 text-white rounded-xl text-xs font-bold hover:bg-red-700 transition shadow-sm"
          >
            🔄 Retry Connection
          </button>
        </div>
      ) : (
        <>
          {/* Summary stats bar */}
          <StatsBar summary={summary} tickets={tickets} />

          {/* Filter & Search Controls */}
          <FilterAndSearchBar
            filter={filter}
            setFilter={setFilter}
            selectedCategory={selectedCategory}
            setSelectedCategory={setSelectedCategory}
            searchQuery={searchQuery}
            setSearchQuery={setSearchQuery}
            counts={counts}
            categories={categories}
          />

          {/* Ticket Grid / Loading / Empty State */}
          {loading ? (
            <div className="text-center py-20 text-gray-400">
              <div className="inline-block animate-spin text-3xl mb-3">🌿</div>
              <p className="text-sm font-semibold text-gray-600">Syncing tickets from database...</p>
            </div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-16 bg-white rounded-3xl border border-gray-200 p-8 shadow-sm">
              <p className="text-4xl mb-2">🎉</p>
              <p className="text-base font-bold text-gray-800">No tickets found</p>
              <p className="text-xs text-gray-400 mt-1 max-w-sm mx-auto">
                {searchQuery
                  ? `No issues match "${searchQuery}". Try clearing search or selecting a different filter.`
                  : 'All caught up in this filter category!'}
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

          {/* Live Sync Badge Footer */}
          <div className="mt-8 flex flex-col sm:flex-row sm:items-center justify-between p-3.5 bg-gradient-to-r from-emerald-50 to-teal-50 border border-emerald-200/80 rounded-2xl text-xs text-emerald-900 gap-2">
            <span className="flex items-center gap-2 font-medium">
              <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse"></span>
              Live Database Connected • Multi-Tier AI Triage Active
            </span>
            <span className="text-emerald-700 font-semibold font-mono text-[11px]">
              {filtered.length} of {tickets.length} ticket{tickets.length === 1 ? '' : 's'} displayed
            </span>
          </div>
        </>
      )}
    </div>
  )
}
