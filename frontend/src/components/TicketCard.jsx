import { useState } from 'react'

// Priority badge: colour changes based on urgency level
export function PriorityBadge({ priority }) {
  const styles = {
    High:   'bg-red-100 text-red-700 border border-red-200',
    Medium: 'bg-yellow-100 text-yellow-700 border border-yellow-200',
    Low:    'bg-green-100 text-green-700 border border-green-200',
  }
  const icons = { High: '🔴', Medium: '🟡', Low: '🟢' }

  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold ${styles[priority] || styles.Low}`}>
      {icons[priority]} {priority}
    </span>
  )
}

// Status badge: shows ticket lifecycle
export function StatusBadge({ status }) {
  const styles = {
    Open:          'bg-blue-100 text-blue-700 border border-blue-200',
    'In Progress': 'bg-orange-100 text-orange-700 border border-orange-200',
    Resolved:      'bg-gray-100 text-gray-600 border border-gray-200',
  }

  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${styles[status] || styles.Open}`}>
      {status}
    </span>
  )
}

// Helper to format timestamps nicely
function formatDate(dateStr) {
  if (!dateStr) return ''
  // If already user-formatted (e.g. "Today, 09:12 AM")
  if (dateStr.includes('Today') || dateStr.includes('Yesterday') || dateStr.includes('ago')) {
    return dateStr
  }
  try {
    const d = new Date(dateStr)
    if (isNaN(d.getTime())) return dateStr
    return d.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  } catch {
    return dateStr
  }
}

// One ticket card
export default function TicketCard({ ticket, onStatusChange }) {
  const [isUpdating, setIsUpdating] = useState(false)

  // Normalise backend vs frontend field names
  const submittedBy = ticket.submitted_by || ticket.submittedBy || 'Anonymous'
  const dateDisplay = formatDate(ticket.created_at || ticket.date)
  const aiSuggestion = ticket.ai_suggestion || ticket.aiSuggestion

  async function handleStatusSelect(e) {
    const newStatus = e.target.value
    if (newStatus === ticket.status || !onStatusChange) return
    setIsUpdating(true)
    try {
      await onStatusChange(ticket.id, newStatus)
    } finally {
      setIsUpdating(false)
    }
  }

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm hover:shadow-md transition-shadow duration-200 flex flex-col justify-between">
      <div>
        {/* Header row */}
        <div className="flex items-start justify-between gap-2 mb-3">
          <div>
            <span className="text-xs font-mono text-gray-400">
              #{typeof ticket.id === 'number' ? `GC-${String(ticket.id).padStart(3, '0')}` : ticket.id}
            </span>
            <h3 className="font-semibold text-gray-800 text-sm mt-0.5">{ticket.title}</h3>
          </div>
          <PriorityBadge priority={ticket.priority} />
        </div>

        {/* Description */}
        <p className="text-sm text-gray-500 mb-4 line-clamp-2">{ticket.description}</p>

        {/* Meta row */}
        <div className="flex flex-wrap gap-2 text-xs text-gray-500 mb-3">
          <span className="bg-gray-50 border border-gray-100 rounded px-2 py-1">
            🏷️ {ticket.category}
          </span>
          <span className="bg-gray-50 border border-gray-100 rounded px-2 py-1">
            📍 {ticket.location}
          </span>
          <span className="bg-gray-50 border border-gray-100 rounded px-2 py-1">
            🏢 {ticket.department || 'Unassigned'}
          </span>
        </div>
      </div>

      <div>
        {/* Footer row with status changer */}
        <div className="flex items-center justify-between pt-3 border-t border-gray-100 gap-2">
          <div className="flex items-center gap-1.5">
            <StatusBadge status={ticket.status} />
            {onStatusChange && (
              <select
                aria-label="Change status"
                value={ticket.status}
                onChange={handleStatusSelect}
                disabled={isUpdating}
                className="text-xs bg-gray-50 border border-gray-200 rounded px-1.5 py-0.5 text-gray-600 focus:outline-none focus:ring-1 focus:ring-green-500 cursor-pointer disabled:opacity-50"
              >
                <option value="Open">Open</option>
                <option value="In Progress">In Progress</option>
                <option value="Resolved">Resolved</option>
              </select>
            )}
            {isUpdating && (
              <span className="text-xs text-gray-400 animate-pulse">saving…</span>
            )}
          </div>
          <div className="text-right">
            <p className="text-xs text-gray-400">{submittedBy}</p>
            <p className="text-xs text-gray-300">{dateDisplay}</p>
          </div>
        </div>

        {/* AI suggestion box */}
        {aiSuggestion && (
          <div className="mt-3 bg-green-50 border border-green-100 rounded-lg p-3">
            <p className="text-xs font-semibold text-green-700 mb-1 flex items-center gap-1">
              <span>🤖</span> AI Recommendation
            </p>
            <p className="text-xs text-green-700 leading-relaxed">{aiSuggestion}</p>
          </div>
        )}
      </div>
    </div>
  )
}
