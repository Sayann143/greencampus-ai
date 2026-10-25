import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { createTicket } from '../api'
import { PriorityBadge } from './TicketCard'

// Categories a student can choose from
const CATEGORIES = [
  'Water & Plumbing',
  'Electrical',
  'Cleanliness',
  'Infrastructure',
  'Sustainability',
  'Internet & IT',
  'Safety & Security',
  'Other',
]

// Field wrapper for consistent layout
function Field({ label, required, children, hint }) {
  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1">
        {label} {required && <span className="text-red-500">*</span>}
      </label>
      {children}
      {hint && <p className="text-xs text-gray-400 mt-1">{hint}</p>}
    </div>
  )
}

export default function ReportForm() {
  const navigate = useNavigate()

  // Form state
  const [form, setForm] = useState({
    name: '',
    email: '',
    location: '',
    category: '',
    title: '',
    description: '',
  })

  const [createdTicket, setCreatedTicket] = useState(null)
  const [loading, setLoading] = useState(false)
  const [errors, setErrors] = useState({})
  const [serverError, setServerError] = useState(null)

  // Update a single field
  const update = (field) => (e) =>
    setForm(prev => ({ ...prev, [field]: e.target.value }))

  // Client-side validation
  function validate() {
    const errs = {}
    if (!form.name.trim())        errs.name = 'Your name is required'
    if (!form.location.trim())    errs.location = 'Campus location is required'
    if (!form.category)           errs.category = 'Please choose a category'
    if (!form.title.trim())       errs.title = 'A short title is required (min 5 characters)'
    else if (form.title.trim().length < 5)
      errs.title = 'Title must be at least 5 characters'
    if (form.description.trim().length < 20)
      errs.description = 'Please describe the issue in at least 20 characters'
    return errs
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setServerError(null)

    const errs = validate()
    if (Object.keys(errs).length > 0) {
      setErrors(errs)
      return
    }

    setErrors({})
    setLoading(true)

    try {
      // Send real POST request to backend API
      const newTicket = await createTicket({
        title: form.title.trim(),
        description: form.description.trim(),
        category: form.category,
        location: form.location.trim(),
        submitted_by: form.name.trim() || 'Anonymous',
      })

      setCreatedTicket(newTicket)
    } catch (err) {
      console.error('Failed to submit ticket:', err)
      setServerError(
        err.message || 'Unable to submit report. Please check that the backend server is running at http://localhost:8000.'
      )
    } finally {
      setLoading(false)
    }
  }

  // Input styling
  const inputClass = (field) =>
    `w-full rounded-lg border px-3 py-2 text-sm text-gray-800 outline-none transition-colors focus:ring-2 focus:ring-green-500 focus:border-green-500 ${
      errors[field] ? 'border-red-400 bg-red-50' : 'border-gray-300 bg-white hover:border-gray-400'
    }`

  // ── Success screen ──────────────────────────────────────────────────────────
  if (createdTicket) {
    return (
      <div className="max-w-xl mx-auto mt-10">
        <div className="bg-white rounded-2xl border border-green-200 shadow-lg p-8 text-center">
          <div className="text-5xl mb-3">🎉</div>
          <h2 className="text-2xl font-bold text-green-700 mb-1">Report Submitted!</h2>
          <p className="text-gray-500 text-sm mb-6">
            Ticket <strong className="font-mono text-gray-800">#{createdTicket.id}</strong> has been saved to the campus database.
          </p>

          {/* AI Triage Card */}
          <div className="bg-green-50 border border-green-200 rounded-xl p-5 mb-6 text-left space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-green-800 uppercase tracking-wider">
                🤖 AI Triage Results
              </span>
              <PriorityBadge priority={createdTicket.priority} />
            </div>

            <div className="text-sm text-gray-700 space-y-1">
              <p>
                <strong className="text-gray-900">Category:</strong> {createdTicket.category}
              </p>
              <p>
                <strong className="text-gray-900">Department:</strong> {createdTicket.department}
              </p>
              <p>
                <strong className="text-gray-900">Location:</strong> {createdTicket.location}
              </p>
            </div>

            {createdTicket.ai_suggestion && (
              <div className="pt-2 border-t border-green-200">
                <p className="text-xs font-semibold text-green-800 mb-1">Recommendation:</p>
                <p className="text-xs text-green-700 leading-relaxed">
                  {createdTicket.ai_suggestion}
                </p>
              </div>
            )}
          </div>

          <div className="flex flex-col sm:flex-row gap-3">
            <button
              onClick={() => {
                setCreatedTicket(null)
                setForm({ name: '', email: '', location: '', category: '', title: '', description: '' })
              }}
              className="flex-1 px-4 py-2.5 border border-gray-300 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-50 transition-colors"
            >
              Submit Another Report
            </button>
            <button
              onClick={() => navigate('/dashboard')}
              className="flex-1 px-4 py-2.5 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700 transition-colors shadow-sm"
            >
              View in Dashboard →
            </button>
          </div>
        </div>
      </div>
    )
  }

  // ── Report Form ─────────────────────────────────────────────────────────────
  return (
    <div className="max-w-2xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-gray-800">Report a Campus Issue</h2>
        <p className="text-gray-500 text-sm mt-1">
          Submit campus infrastructure, safety, or cleanliness issues. Our backend AI
          automatically categorises your report, sets urgency, and routes it to the right department.
        </p>
      </div>

      {/* Server error alert banner */}
      {serverError && (
        <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700 flex items-start gap-3">
          <span className="text-lg">⚠️</span>
          <div>
            <p className="font-semibold mb-0.5">Submission Error</p>
            <p className="text-red-600 leading-relaxed">{serverError}</p>
          </div>
        </div>
      )}

      <form onSubmit={handleSubmit} className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6 space-y-5">
        {/* Row: Name + Email */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Field label="Your Name" required>
            <input
              type="text"
              placeholder="e.g. Arjun Mehta"
              className={inputClass('name')}
              value={form.name}
              onChange={update('name')}
            />
            {errors.name && <p className="text-xs text-red-500 mt-1">{errors.name}</p>}
          </Field>
          <Field label="Email (optional)" hint="For status updates on this ticket">
            <input
              type="email"
              placeholder="you@college.edu"
              className={inputClass('email')}
              value={form.email}
              onChange={update('email')}
            />
          </Field>
        </div>

        {/* Location */}
        <Field label="Location" required hint="Be specific: building name, floor, room number">
          <input
            type="text"
            placeholder="e.g. Library, Basement Floor 1, near reading area"
            className={inputClass('location')}
            value={form.location}
            onChange={update('location')}
          />
          {errors.location && <p className="text-xs text-red-500 mt-1">{errors.location}</p>}
        </Field>

        {/* Category */}
        <Field label="Category" required hint="Choose the type that best describes the problem">
          <select
            className={inputClass('category')}
            value={form.category}
            onChange={update('category')}
          >
            <option value="">-- Select a category --</option>
            {CATEGORIES.map(c => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
          {errors.category && <p className="text-xs text-red-500 mt-1">{errors.category}</p>}
        </Field>

        {/* Short title */}
        <Field label="Issue Title" required hint="A short summary (max 80 characters)">
          <input
            type="text"
            maxLength={80}
            placeholder="e.g. Water leak in Library basement"
            className={inputClass('title')}
            value={form.title}
            onChange={update('title')}
          />
          <p className="text-xs text-gray-400 mt-1 text-right">{form.title.length}/80</p>
          {errors.title && <p className="text-xs text-red-500 mt-1">{errors.title}</p>}
        </Field>

        {/* Description */}
        <Field label="Description" required hint="Describe what you see or smell. More detail leads to a better AI recommendation.">
          <textarea
            rows={4}
            placeholder="Describe the issue in detail. What exactly is wrong? Since when? Any safety hazards?"
            className={inputClass('description')}
            value={form.description}
            onChange={update('description')}
          />
          {errors.description && <p className="text-xs text-red-500 mt-1">{errors.description}</p>}
        </Field>

        {/* AI preview banner */}
        <div className="bg-green-50 border border-green-100 rounded-xl p-4">
          <p className="text-xs font-semibold text-green-700 mb-1 flex items-center gap-1">
            <span>🤖</span> What happens upon submission
          </p>
          <p className="text-xs text-green-700 leading-relaxed">
            The backend AI analyzes your report, assesses urgency (High / Medium / Low),
            assigns the responsible department, generates an initial action plan, and creates
            a tracked ticket in the campus database.
          </p>
        </div>

        {/* Submit button */}
        <button
          type="submit"
          disabled={loading}
          className="w-full py-3 bg-green-600 text-white font-semibold rounded-xl hover:bg-green-700 active:bg-green-800 transition-colors disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2 shadow-sm"
        >
          {loading ? (
            <>
              <svg className="animate-spin h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
              </svg>
              <span>Analyzing & Submitting…</span>
            </>
          ) : (
            '📤 Submit Report'
          )}
        </button>
      </form>
    </div>
  )
}
