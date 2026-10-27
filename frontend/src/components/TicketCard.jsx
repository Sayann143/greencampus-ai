import { useState } from 'react'
import ProblemAnimation, { detectProblemType } from './ProblemAnimation'

// Priority badge with animated pulse for High urgency
export function PriorityBadge({ priority }) {
  const styles = {
    High:   'bg-red-50 text-red-700 border border-red-300 ring-2 ring-red-400/30 shadow-xs',
    Medium: 'bg-amber-50 text-amber-700 border border-amber-200',
    Low:    'bg-emerald-50 text-emerald-700 border border-emerald-200',
  }
  const icons = { High: '🔴', Medium: '🟡', Low: '🟢' }

  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-bold ${styles[priority] || styles.Low}`}>
      <span className={priority === 'High' ? 'animate-ping inline-block w-1.5 h-1.5 rounded-full bg-red-500 mr-0.5' : ''}></span>
      <span>{icons[priority]}</span>
      <span>{priority}</span>
    </span>
  )
}

// Status badge with smooth pill styling
export function StatusBadge({ status }) {
  const styles = {
    Open:          'bg-blue-50 text-blue-700 border border-blue-200 shadow-2xs',
    'In Progress': 'bg-amber-50 text-amber-700 border border-amber-200 shadow-2xs animate-pulse',
    Resolved:      'bg-emerald-50 text-emerald-700 border border-emerald-200 shadow-2xs',
  }
  const dots = {
    Open: 'bg-blue-500',
    'In Progress': 'bg-amber-500',
    Resolved: 'bg-emerald-500',
  }

  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold ${styles[status] || styles.Open}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${dots[status] || 'bg-gray-400'}`}></span>
      <span>{status}</span>
    </span>
  )
}

function formatDate(dateStr) {
  if (!dateStr) return ''
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

export default function TicketCard({ ticket, onStatusChange, onVote }) {
  const [isUpdating, setIsUpdating] = useState(false)
  const [isVoting, setIsVoting] = useState(false)
  const [showAiDetails, setShowAiDetails] = useState(false)
  const [showAnimation, setShowAnimation] = useState(false)
  const [localVotes, setLocalVotes] = useState(ticket.votes || 0)

  const votes = typeof ticket.votes === 'number' ? ticket.votes : localVotes

  // Dynamic priority calculation based on community votes:
  // >= 15 votes: High Priority
  // 8 - 14 votes: Medium Priority
  // < 8 votes: Low Priority (unless safety-critical emergency)
  const textContent = `${ticket.title} ${ticket.description}`.toLowerCase()
  const isEmergency = ['gas leak', 'spark', 'smoke', 'fire', 'bare wire', 'flood', 'burst pipe'].some(w => textContent.includes(w))

  let priority = ticket.priority
  if (votes >= 15) {
    priority = 'High'
  } else if (votes >= 8) {
    priority = isEmergency ? 'High' : 'Medium'
  } else {
    priority = isEmergency ? 'High' : (ticket.priority === 'High' && !isEmergency ? 'Medium' : ticket.priority || 'Low')
  }

  const isHigh = priority === 'High'
  const isMedium = priority === 'Medium'
  const submittedBy = ticket.submitted_by || ticket.submittedBy || 'Anonymous'
  const dateDisplay = formatDate(ticket.created_at || ticket.date)
  const aiSuggestion = ticket.ai_suggestion || ticket.aiSuggestion
  const aiAction = ticket.ai_action
  const problemType = detectProblemType(ticket)

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

  async function handleVote(direction) {
    if (isVoting || !onVote) return
    setIsVoting(true)
    // Trigger problem animation on vote!
    setShowAnimation(true)
    const delta = direction === 'up' ? 1 : -1
    const nextVotes = Math.max(0, votes + delta)
    setLocalVotes(nextVotes)
    try {
      await onVote(ticket.id, direction)
    } catch (err) {
      setLocalVotes(votes)
      console.error('Failed to vote:', err)
    } finally {
      setIsVoting(false)
    }
  }

  // Label for problem effect
  const effectLabels = {
    water: '💧 Water Splash',
    smoke: '💨 Smoke & Sparks',
    garbage: '🗑️ Trash Flow',
    wifi: '📶 Wi-Fi Ping',
    ac: '❄️ Frost Breeze',
  }

  return (
    <div className={`relative group bg-white rounded-2xl border transition-all duration-300 flex flex-col justify-between p-5 hover:-translate-y-1 hover:shadow-xl ${
      isHigh
        ? 'border-red-300 hover:border-red-400 shadow-sm shadow-red-500/10 ring-1 ring-red-400/20'
        : isMedium
        ? 'border-amber-200 hover:border-amber-300 shadow-sm'
        : 'border-gray-200 hover:border-emerald-300 shadow-sm'
    }`}>
      {/* Interactive Problem Animation Overlay (Water splash, Smoke, Trash flow, etc.) */}
      <ProblemAnimation
        type={problemType}
        active={showAnimation}
        onComplete={() => setShowAnimation(false)}
      />

      <div>
        {/* Top meta row */}
        <div className="flex items-start justify-between gap-2 mb-2.5">
          <div className="flex items-center gap-2">
            <span className="font-mono text-xs font-bold text-gray-400 bg-gray-50 border border-gray-100 rounded-md px-1.5 py-0.5">
              #{typeof ticket.id === 'number' ? `GC-${String(ticket.id).padStart(3, '0')}` : ticket.id}
            </span>
            <span className="text-[11px] text-gray-400">{dateDisplay}</span>
          </div>
          <PriorityBadge priority={priority} />
        </div>

        {/* Title (clickable to trigger problem animation) */}
        <h3
          onClick={() => setShowAnimation(true)}
          className="font-bold text-gray-800 text-base leading-snug group-hover:text-emerald-700 transition-colors mb-2 cursor-pointer flex items-center justify-between"
          title="Click to see problem animation"
        >
          <span>{ticket.title}</span>
        </h3>

        {/* Description */}
        <p className="text-xs text-gray-600 mb-3 line-clamp-2 leading-relaxed">
          {ticket.description}
        </p>

        {/* Voting & Community Escalation Bar (15+ High, 8-14 Medium, <8 Low) */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-3.5 bg-gray-50/90 border border-gray-200/80 rounded-xl p-2.5">
          <div className="flex items-center gap-2">
            <span className="text-[11px] font-bold text-gray-600">Upvote:</span>
            <div className="inline-flex items-center rounded-lg bg-white border border-gray-200 shadow-2xs overflow-hidden">
              <button
                onClick={() => handleVote('up')}
                disabled={isVoting}
                className="px-2.5 py-1 hover:bg-emerald-50 text-emerald-700 hover:text-emerald-800 font-bold transition flex items-center gap-1 text-xs active:scale-95"
                title="Upvote: I am also experiencing this issue"
              >
                ▲ <span className="text-[10px]">Vote</span>
              </button>
              <span className={`px-2.5 py-1 text-xs font-black border-x border-gray-100 ${
                votes >= 15 ? 'text-red-600 bg-red-50' : votes >= 8 ? 'text-amber-700 bg-amber-50' : 'text-gray-800'
              }`}>
                {votes}
              </span>
              <button
                onClick={() => handleVote('down')}
                disabled={isVoting || votes <= 0}
                className="px-2 py-1 hover:bg-red-50 text-gray-400 hover:text-red-600 font-bold transition disabled:opacity-30 text-xs active:scale-95"
                title="Downvote"
              >
                ▼
              </button>
            </div>
          </div>

          {/* Tier Escalation Status */}
          <div className="flex items-center gap-1.5 self-end sm:self-auto">
            {votes >= 15 ? (
              <span className="inline-flex items-center gap-1 text-[10px] font-black text-red-700 bg-red-100 border border-red-300 rounded-full px-2 py-0.5 animate-pulse">
                🔥 High Priority ({votes} votes)
              </span>
            ) : votes >= 8 ? (
              <span className="inline-flex items-center gap-1 text-[10px] font-black text-amber-800 bg-amber-100 border border-amber-300 rounded-full px-2 py-0.5">
                ⚡ Medium ({votes}/15 for High)
              </span>
            ) : (
              <span className="text-[10px] text-gray-500 font-medium">
                {votes}/8 to Medium • {15 - votes} to High
              </span>
            )}

            {/* Interactive Animation Trigger Button */}
            <button
              type="button"
              onClick={() => setShowAnimation(true)}
              className="text-[10px] font-bold text-emerald-700 hover:text-white bg-emerald-50 hover:bg-emerald-600 border border-emerald-200 rounded-lg px-1.5 py-0.5 transition-colors shadow-2xs"
              title="Click to view problem visual effect"
            >
              {effectLabels[problemType] || '✨ Effect'}
            </button>
          </div>
        </div>

        {/* Category & Location Badges */}
        <div className="flex flex-wrap gap-1.5 text-xs text-gray-600 mb-4">
          <span
            onClick={() => setShowAnimation(true)}
            className="cursor-pointer bg-emerald-50/80 hover:bg-emerald-100 text-emerald-800 border border-emerald-100/80 rounded-lg px-2.5 py-1 font-medium flex items-center gap-1 transition"
            title="Click to trigger effect"
          >
            🏷️ {ticket.category}
          </span>
          <span className="bg-gray-50 text-gray-700 border border-gray-200/60 rounded-lg px-2.5 py-1 font-medium flex items-center gap-1">
            📍 {ticket.location}
          </span>
          <span className="bg-purple-50 text-purple-700 border border-purple-100 rounded-lg px-2.5 py-1 font-medium flex items-center gap-1">
            🏢 {ticket.department || 'Unassigned'}
          </span>
        </div>
      </div>

      <div>
        {/* Expandable AI Triage Suggestion */}
        {(aiSuggestion || aiAction) && (
          <div className="mb-3.5">
            <button
              onClick={() => setShowAiDetails(!showAiDetails)}
              className="w-full text-left text-xs font-bold text-emerald-700 hover:text-emerald-800 bg-emerald-50/60 hover:bg-emerald-100/60 border border-emerald-200/60 rounded-xl px-3 py-1.5 transition-colors flex items-center justify-between"
            >
              <span className="flex items-center gap-1.5">
                <span className="animate-spin text-[10px]">✨</span>
                <span>AI Facility Recommendation</span>
              </span>
              <span className="text-gray-400 text-xs font-mono">{showAiDetails ? '▲ Hide' : '▼ View'}</span>
            </button>

            {showAiDetails && (
              <div className="mt-2 p-3 bg-gradient-to-r from-emerald-50/90 to-teal-50/90 border border-emerald-200/80 rounded-xl text-xs text-emerald-900 leading-relaxed shadow-xs animate-fade-in">
                <p className="font-medium">{aiSuggestion}</p>
                {aiAction && (
                  <p className="mt-1.5 pt-1.5 border-t border-emerald-200/60 font-semibold text-emerald-950">
                    Action: {aiAction}
                  </p>
                )}
              </div>
            )}
          </div>
        )}

        {/* Footer: Status changer dropdown & reporter */}
        <div className="flex items-center justify-between pt-3 border-t border-gray-100 text-xs">
          <div className="flex items-center gap-2">
            <StatusBadge status={ticket.status} />
            {onStatusChange && (
              <select
                aria-label="Update ticket status"
                value={ticket.status}
                onChange={handleStatusSelect}
                disabled={isUpdating}
                className="text-xs bg-gray-50 hover:bg-gray-100 border border-gray-200 rounded-lg px-2 py-1 text-gray-700 font-medium focus:outline-none focus:ring-2 focus:ring-emerald-500 cursor-pointer disabled:opacity-50 transition"
              >
                <option value="Open">Open</option>
                <option value="In Progress">In Progress</option>
                <option value="Resolved">Resolved</option>
              </select>
            )}
            {isUpdating && <span className="text-[10px] text-gray-400 animate-pulse">saving...</span>}
          </div>

          <span className="text-[11px] text-gray-400 font-medium">
            By <strong className="text-gray-600">{submittedBy}</strong>
          </span>
        </div>
      </div>
    </div>
  )
}
