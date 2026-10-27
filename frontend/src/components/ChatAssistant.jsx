import { useState, useEffect, useRef } from 'react'
import { sendChatMessage } from '../api'
import { getEchoLocalResponse } from '../echoKnowledge'
import { Link } from 'react-router-dom'

// ─── Preset Quick Starter Prompts for Students ───────────────────────────────
const QUICK_PROMPTS = [
  { icon: '💧', label: 'Report a water leak', text: 'There is a water pipe leaking on the floor. How do I report it?' },
  { icon: '❄️', label: 'AC broken in lab', text: 'The AC in Tech Building Lab 3 is blowing warm air. Who fixes this?' },
  { icon: '♻️', label: 'Recycle e-waste', text: 'Where can I recycle old electronics and batteries on campus?' },
  { icon: '☕', label: 'Find study partner', text: 'How does Campus Connect work to find a study buddy right now?' },
  { icon: '⚡', label: 'Exposed wires/hazard', text: 'I spotted an electrical hazard with sparks. What should I do immediately?' },
  { icon: '📊', label: 'Campus tickets status', text: 'What are the top open safety issues reported across campus right now?' },
]

// ─── Dynamic Animated "AI is Working" Indicator ─────────────────────────────
function AIWorkingIndicator() {
  const [phaseIndex, setPhaseIndex] = useState(0)
  const phases = [
    '✨ Scanning campus telemetry...',
    '🧠 Querying Gemini AI free model...',
    '⚡ Analyzing facilities triage knowledge graph...',
    '🌿 Synthesizing actionable eco-friendly advice...',
    '🚀 Finalizing answer for you...',
  ]

  useEffect(() => {
    const interval = setInterval(() => {
      setPhaseIndex(prev => (prev + 1) % phases.length)
    }, 1800)
    return () => clearInterval(interval)
  }, [phases.length])

  return (
    <div className="flex items-start gap-3 my-3 animate-fade-in">
      {/* Bot Avatar with glowing pulse aura */}
      <div className="relative flex-shrink-0">
        <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-emerald-500 to-teal-400 flex items-center justify-center text-lg shadow-lg shadow-emerald-500/25 ring-2 ring-emerald-400/40 animate-pulse">
          🌿
        </div>
        <span className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-emerald-400 border-2 border-white rounded-full animate-ping"></span>
      </div>

      {/* Animated Thought Bubble */}
      <div className="bg-gradient-to-r from-emerald-950/80 via-gray-900/90 to-emerald-950/80 border border-emerald-500/30 rounded-2xl rounded-tl-sm px-4 py-3 shadow-xl max-w-sm backdrop-blur-md">
        <div className="flex items-center gap-2 mb-1.5">
          {/* 3 Bouncing Gradient Pearls */}
          <div className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-bounce" style={{ animationDelay: '0ms' }}></span>
            <span className="w-2 h-2 rounded-full bg-teal-400 animate-bounce" style={{ animationDelay: '150ms' }}></span>
            <span className="w-2 h-2 rounded-full bg-cyan-400 animate-bounce" style={{ animationDelay: '300ms' }}></span>
          </div>
          <span className="text-xs font-semibold text-emerald-400 tracking-wide uppercase">Echo AI Working</span>
        </div>

        {/* Dynamic cycling status message */}
        <p className="text-xs text-gray-300 font-mono transition-opacity duration-300">
          {phases[phaseIndex]}
        </p>

        {/* Shimmer progress bar */}
        <div className="w-full bg-emerald-950/80 rounded-full h-1 mt-2.5 overflow-hidden">
          <div className="bg-gradient-to-r from-emerald-500 via-teal-300 to-emerald-500 h-1 w-full animate-pulse"></div>
        </div>
      </div>
    </div>
  )
}

// ─── Single Chat Bubble Component ───────────────────────────────────────────
function MessageBubble({ msg, onActionClick }) {
  const isUser = msg.role === 'user'
  const [copied, setCopied] = useState(false)

  const copyText = () => {
    navigator.clipboard.writeText(msg.content)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className={`flex items-start gap-3 my-3.5 ${isUser ? 'flex-row-reverse' : 'flex-row'}`}>
      {/* Avatar */}
      <div className="flex-shrink-0">
        {isUser ? (
          <div className="w-9 h-9 rounded-2xl bg-gradient-to-tr from-blue-600 to-indigo-600 flex items-center justify-center text-sm font-bold text-white shadow-md shadow-indigo-500/20 ring-2 ring-indigo-400/30">
            👤
          </div>
        ) : (
          <div className="w-9 h-9 rounded-2xl bg-gradient-to-tr from-emerald-500 to-teal-400 flex items-center justify-center text-base shadow-md shadow-emerald-500/20 ring-2 ring-emerald-400/30">
            ✨
          </div>
        )}
      </div>

      {/* Bubble Content */}
      <div className={`max-w-[85%] sm:max-w-[75%] rounded-2xl px-4 py-3 shadow-md transition-all duration-200 ${
        isUser
          ? 'bg-gradient-to-r from-emerald-600 to-teal-600 text-white rounded-tr-sm shadow-emerald-600/10'
          : 'bg-white border border-gray-100 text-gray-800 rounded-tl-sm shadow-gray-100'
      }`}>
        {/* Header (Bot name + badge) */}
        {!isUser && (
          <div className="flex items-center justify-between gap-2 mb-1.5 pb-1 border-b border-gray-100/80 text-[11px]">
            <div className="flex items-center gap-1.5">
              <span className="font-bold text-emerald-700">Echo Assistant</span>
              {msg.provider && (
                <span className={`px-1.5 py-0.5 rounded-full font-mono text-[10px] font-medium ${
                  msg.provider === 'gemini'
                    ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                    : msg.provider === 'grok'
                    ? 'bg-purple-50 text-purple-700 border border-purple-200'
                    : msg.provider === 'openai'
                    ? 'bg-blue-50 text-blue-700 border border-blue-200'
                    : 'bg-gray-100 text-gray-700 border border-gray-200'
                }`}>
                  {msg.provider === 'gemini' ? '⚡ Gemini Free' : msg.provider === 'grok' ? '🤖 xAI Grok' : msg.provider === 'openai' ? '🧠 OpenAI' : '🌿 Campus Engine'}
                </span>
              )}
            </div>
            <button
              onClick={copyText}
              className="text-gray-400 hover:text-gray-600 transition-colors p-1"
              title="Copy answer"
            >
              {copied ? '✓ Copied' : '📋'}
            </button>
          </div>
        )}

        {/* Message body with formatted markdown-like paragraphs */}
        <div className="text-sm leading-relaxed whitespace-pre-wrap break-words">
          {msg.content}
        </div>

        {/* Suggested Quick Action Chips (if returned by backend) */}
        {!isUser && msg.suggested_actions && msg.suggested_actions.length > 0 && (
          <div className="mt-3 pt-2.5 border-t border-gray-100 flex flex-wrap gap-1.5">
            {msg.suggested_actions.map((act, i) => (
              <button
                key={i}
                onClick={() => onActionClick(act)}
                className="text-xs bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-200 px-2.5 py-1 rounded-full font-medium transition-colors duration-150 flex items-center gap-1"
              >
                <span>{act}</span>
              </button>
            ))}
          </div>
        )}

        {/* Timestamp */}
        <div className={`text-[10px] mt-1.5 text-right ${isUser ? 'text-emerald-100/80' : 'text-gray-400'}`}>
          {msg.timestamp || 'Just now'}
        </div>
      </div>
    </div>
  )
}

// ─── Main ChatAssistant Component ───────────────────────────────────────────
export default function ChatAssistant() {
  const [messages, setMessages] = useState([
    {
      role: 'assistant',
      content:
        "Yo! 👋 I'm **Echo**, your 24/7 GreenCampus AI companion. " +
        "Spot a leaking pipe? Broken AC in lab? Need to find a study buddy or want green living tips? " +
        "Ask me anything or tap one of the quick cards below! 🌿✨\n\n" +
        "**Here's what I can help with:**\n" +
        "• 📚 Library hours & study spaces\n" +
        "• 💻 Wi-Fi & IT support\n" +
        "• ☕ Cafeteria & dining options\n" +
        "• 🏆 Clubs, sports & gym\n" +
        "• ⚡ Report facility issues\n" +
        "• 🤝 Find study buddies\n" +
        "• 🌱 Sustainability & eco tips\n\n" +
        "Tap a topic below to get started! ⬇️",
      provider: 'gemini',
      timestamp: 'Online',
      suggested_actions: ['Library Hours 📚', 'Campus Wi-Fi 💻', 'Cafeteria ☕', 'Report Issue ✏️', 'Find Study Buddy 🤝', 'Eco Tips 🌱', 'Clubs & Sports 🏆'],
    },
  ])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [errorBanner, setErrorBanner] = useState(null)
  const messagesEndRef = useRef(null)
  const inputRef = useRef(null)

  // Auto-scroll to bottom of messages
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  useEffect(() => {
    scrollToBottom()
  }, [messages, loading])

  // Handle send message
  const handleSend = async (textToSend = null) => {
    const query = (textToSend || input).trim()
    if (!query || loading) return

    setInput('')
    setErrorBanner(null)

    // Add user message to UI immediately
    const userMsg = {
      role: 'user',
      content: query,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    }
    const updatedHistory = [...messages, userMsg]
    setMessages(updatedHistory)
    setLoading(true)

    try {
      // Build lightweight history payload
      const historyPayload = messages.slice(-6).map(m => ({
        role: m.role === 'user' ? 'user' : 'assistant',
        content: m.content,
      }))

      const response = await sendChatMessage(query, historyPayload)

      // Add bot reply to conversation
      setMessages(prev => [
        ...prev,
        {
          role: 'assistant',
          content: response.reply,
          provider: response.provider,
          model_used: response.model_used,
          timestamp: response.timestamp || new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          suggested_actions: response.suggested_actions || [],
        },
      ])
    } catch (err) {
      console.warn('Backend unavailable or rate-limited. Activating Echo local campus engine:', err)
      const local = getEchoLocalResponse(query)
      setMessages(prev => [
        ...prev,
        {
          role: 'assistant',
          content: local.reply,
          provider: 'local-engine',
          timestamp: local.timestamp,
          suggested_actions: local.suggested_actions || [],
        },
      ])
    } finally {
      setLoading(false)
      inputRef.current?.focus()
    }
  }

  // Handle pressing Enter
  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  // Clear conversation
  const clearChat = () => {
    setMessages([
      {
        role: 'assistant',
        content: "Fresh slate! ✨ What's happening on campus? Tap a topic below or ask me anything!\n\n" +
          "• 📚 Library & Study   • 💻 Wi-Fi & IT   • ☕ Food & Dining\n" +
          "• 🏆 Clubs & Sports   • ⚡ Report Issue   • 🤝 Campus Connect",
        provider: 'gemini',
        timestamp: 'Reset',
        suggested_actions: ['Library Hours 📚', 'Campus Wi-Fi 💻', 'Report Issue ✏️', 'Find Study Buddy 🤝', 'Eco Tips 🌱'],
      },
    ])
  }

  return (
    <div className="max-w-4xl mx-auto">
      {/* Gen Z Hero Header */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-emerald-900 via-gray-900 to-teal-900 p-6 sm:p-8 text-white shadow-xl mb-6 border border-emerald-500/20">
        <div className="absolute top-0 right-0 -mt-6 -mr-6 w-48 h-48 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none"></div>
        <div className="absolute bottom-0 left-1/3 -mb-10 w-40 h-40 bg-teal-500/10 rounded-full blur-2xl pointer-events-none"></div>

        <div className="relative z-10 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/20 border border-emerald-400/30 text-emerald-300 text-xs font-semibold mb-2 backdrop-blur-md">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
              Live Multi-Tier AI Failover Active
            </div>
            <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight bg-gradient-to-r from-white via-emerald-100 to-teal-200 bg-clip-text text-transparent">
              Echo — Campus AI Assistant ✨
            </h2>
            <p className="text-sm text-emerald-100/70 mt-1 max-w-xl">
              Real-time campus issue triage, zero-waste tips, and student connect.
              Backed by Gemini Free Tier $\rightarrow$ Grok AI $\rightarrow$ Local Knowledge Fallback.
            </p>
          </div>

          <div className="flex items-center gap-2 self-start sm:self-auto">
            <button
              onClick={clearChat}
              className="px-3 py-1.5 rounded-xl bg-white/10 hover:bg-white/15 border border-white/10 text-xs font-medium text-white transition-colors flex items-center gap-1.5"
              title="Clear conversation"
            >
              🔄 <span>Reset Chat</span>
            </button>
            <Link
              to="/report"
              className="px-3.5 py-1.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-gray-950 font-bold text-xs transition-colors shadow-lg shadow-emerald-500/20 flex items-center gap-1.5"
            >
              ✏️ <span>File Ticket</span>
            </Link>
          </div>
        </div>
      </div>

      {/* Error alert if any */}
      {errorBanner && (
        <div className="mb-4 p-3 bg-amber-50 border border-amber-200 text-amber-800 rounded-xl text-xs flex items-center justify-between">
          <span>⚠️ {errorBanner}</span>
          <button onClick={() => setErrorBanner(null)} className="text-amber-600 font-bold ml-2">✕</button>
        </div>
      )}

      {/* Main Chat Box Container */}
      <div className="bg-white rounded-3xl border border-gray-200/80 shadow-lg overflow-hidden flex flex-col h-[600px]">
        {/* Chat top status bar */}
        <div className="px-5 py-3 bg-gradient-to-r from-gray-50 to-emerald-50/40 border-b border-gray-100 flex items-center justify-between text-xs text-gray-500">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-ping"></span>
            <span className="font-semibold text-gray-700">Echo Assistant Online</span>
            <span className="hidden sm:inline text-gray-400">• Free Tier Failover Enabled</span>
          </div>
          <span className="text-[11px] font-mono text-emerald-700 bg-emerald-100/60 px-2 py-0.5 rounded-md">
            v1.3 AI Ready
          </span>
        </div>

        {/* Message Feed */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-2 bg-gradient-to-b from-gray-50/50 via-white to-gray-50/30">
          {messages.map((msg, idx) => (
            <MessageBubble
              key={idx}
              msg={msg}
              onActionClick={(actionText) => handleSend(actionText)}
            />
          ))}

          {/* Animated AI is working indicator */}
          {loading && <AIWorkingIndicator />}

          <div ref={messagesEndRef} />
        </div>

        {/* Quick starter pill suggestions (sticky above input) */}
        <div className="px-4 py-2 bg-gray-50 border-t border-gray-100 flex items-center gap-2 overflow-x-auto no-scrollbar">
          <span className="text-[11px] font-bold text-gray-400 uppercase tracking-wider flex-shrink-0">
            Quick Ask:
          </span>
          {QUICK_PROMPTS.map((p, idx) => (
            <button
              key={idx}
              onClick={() => handleSend(p.text)}
              disabled={loading}
              className="flex-shrink-0 text-xs bg-white hover:bg-emerald-50 text-gray-700 hover:text-emerald-700 border border-gray-200 hover:border-emerald-300 rounded-full px-3 py-1 font-medium transition-all shadow-2xs disabled:opacity-50 flex items-center gap-1.5"
            >
              <span>{p.icon}</span>
              <span>{p.label}</span>
            </button>
          ))}
        </div>

        {/* Input Bar */}
        <div className="p-3 sm:p-4 bg-white border-t border-gray-100">
          <div className="relative flex items-center gap-2 bg-gray-50 rounded-2xl border border-gray-200 focus-within:border-emerald-500 focus-within:ring-2 focus-within:ring-emerald-500/20 px-3 py-2 transition-all">
            <span className="text-lg text-emerald-600">💬</span>
            <input
              ref={inputRef}
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              disabled={loading}
              placeholder="Ask Echo anything about campus, broken facilities, or eco-tips..."
              className="w-full bg-transparent text-sm text-gray-800 placeholder-gray-400 focus:outline-none"
            />
            <button
              onClick={() => handleSend()}
              disabled={!input.trim() || loading}
              className={`flex-shrink-0 px-4 py-2 rounded-xl font-bold text-xs transition-all duration-200 flex items-center gap-1.5 shadow-sm ${
                input.trim() && !loading
                  ? 'bg-gradient-to-r from-emerald-600 to-teal-600 text-white hover:opacity-95 cursor-pointer shadow-emerald-600/20 scale-100 active:scale-95'
                  : 'bg-gray-200 text-gray-400 cursor-not-allowed'
              }`}
            >
              <span>Send</span>
              <span>🚀</span>
            </button>
          </div>
          <div className="flex items-center justify-between text-[11px] text-gray-400 mt-2 px-1">
            <span>Powered by Google Gemini 🌿 & xAI Grok fallback</span>
            <span>Press Enter to send ↵</span>
          </div>
        </div>
      </div>
    </div>
  )
}
