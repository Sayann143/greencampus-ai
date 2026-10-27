import { useState, useEffect, useRef } from 'react'
import { sendChatMessage } from '../api'
import { getEchoLocalResponse } from '../echoKnowledge'

export default function FloatingChatWidget() {
  const [isOpen, setIsOpen] = useState(false)
  const [messages, setMessages] = useState([
    {
      role: 'assistant',
      content: "Hey! 🌿 Need help with a campus problem, finding a study buddy, or eco-tips? Ask me anything or tap a topic!",
      timestamp: 'Online',
      suggested_actions: ['Library 📚', 'Wi-Fi 💻', 'Food ☕', 'Report Issue ✏️', 'Eco Tips 🌱'],
    },
  ])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const messagesEndRef = useRef(null)

  useEffect(() => {
    if (isOpen) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
    }
  }, [messages, loading, isOpen])

  const handleSend = async (textOverride = null) => {
    const query = (textOverride || input).trim()
    if (!query || loading) return

    setInput('')
    const userMsg = {
      role: 'user',
      content: query,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    }
    setMessages(prev => [...prev, userMsg])
    setLoading(true)

    try {
      const historyPayload = messages.slice(-4).map(m => ({
        role: m.role === 'user' ? 'user' : 'assistant',
        content: m.content,
      }))
      const res = await sendChatMessage(query, historyPayload)
      setMessages(prev => [
        ...prev,
        {
          role: 'assistant',
          content: res.reply,
          provider: res.provider,
          timestamp: res.timestamp || new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          suggested_actions: res.suggested_actions || [],
        },
      ])
    } catch {
      const local = getEchoLocalResponse(query)
      setMessages(prev => [
        ...prev,
        {
          role: 'assistant',
          content: local.reply,
          provider: 'echo-engine',
          timestamp: local.timestamp,
          suggested_actions: local.suggested_actions || [],
        },
      ])
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed bottom-20 right-3.5 md:bottom-6 md:right-6 z-50">
      {/* Floating Chat Modal */}
      {isOpen && (
        <div className="mb-3 w-[calc(100vw-28px)] max-w-sm sm:w-96 h-[460px] sm:h-[480px] bg-white rounded-3xl shadow-2xl border border-gray-200 overflow-hidden flex flex-col animate-fade-in backdrop-blur-lg">
          {/* Header */}
          <div className="p-3.5 bg-gradient-to-r from-emerald-800 to-teal-800 text-white flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-xl bg-white/20 flex items-center justify-center text-sm shadow">
                ✨
              </div>
              <div>
                <h4 className="text-sm font-bold leading-tight">Echo AI Assistant</h4>
                <p className="text-[10px] text-emerald-200">Live Free-Tier Failover Active</p>
              </div>
            </div>
            <button
              onClick={() => setIsOpen(false)}
              className="text-white/80 hover:text-white p-1 rounded-lg hover:bg-white/10 transition"
            >
              ✕
            </button>
          </div>

          {/* Messages Feed */}
          <div className="flex-1 overflow-y-auto p-3 space-y-2.5 bg-gray-50/50 text-xs">
            {messages.map((m, i) => (
              <div key={i}>
                <div
                  className={`flex flex-col ${m.role === 'user' ? 'items-end' : 'items-start'}`}
                >
                  <div
                    className={`max-w-[85%] rounded-2xl px-3 py-2 shadow-xs ${
                      m.role === 'user'
                        ? 'bg-emerald-600 text-white rounded-tr-xs'
                        : 'bg-white text-gray-800 border border-gray-100 rounded-tl-xs'
                    }`}
                  >
                    <p className="whitespace-pre-wrap">{m.content}</p>
                  </div>
                  <span className="text-[9px] text-gray-400 mt-0.5 px-1">{m.timestamp}</span>
                </div>

                {/* Suggested action chips for assistant messages */}
                {m.role === 'assistant' && m.suggested_actions && m.suggested_actions.length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-1.5 ml-1">
                    {m.suggested_actions.map((act, j) => (
                      <button
                        key={j}
                        onClick={() => handleSend(act)}
                        disabled={loading}
                        className="text-[10px] bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-200 px-2 py-0.5 rounded-full font-medium transition-colors disabled:opacity-50"
                      >
                        {act}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            ))}

            {/* AI is working animation */}
            {loading && (
              <div className="flex items-center gap-2 p-2.5 bg-emerald-50/80 border border-emerald-200/60 rounded-2xl max-w-[85%] text-emerald-800 animate-pulse">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-bounce"></span>
                <span className="w-2 h-2 rounded-full bg-teal-500 animate-bounce" style={{ animationDelay: '150ms' }}></span>
                <span className="w-2 h-2 rounded-full bg-cyan-500 animate-bounce" style={{ animationDelay: '300ms' }}></span>
                <span className="text-[11px] font-mono font-medium ml-1">AI thinking...</span>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Input */}
          <div className="p-2.5 bg-white border-t border-gray-100 flex items-center gap-1.5">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSend()}
              placeholder="Ask anything..."
              className="flex-1 bg-gray-50 rounded-xl px-3 py-2 text-xs text-gray-800 focus:outline-none focus:ring-1 focus:ring-emerald-500"
            />
            <button
              onClick={() => handleSend()}
              disabled={!input.trim() || loading}
              className="px-3 py-2 bg-emerald-600 text-white rounded-xl text-xs font-bold hover:bg-emerald-700 disabled:opacity-40 transition"
            >
              🚀
            </button>
          </div>
        </div>
      )}

      {/* Floating Trigger Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="group relative flex items-center gap-2 px-4 py-3 bg-gradient-to-r from-emerald-600 via-teal-600 to-green-600 hover:from-emerald-500 hover:to-teal-500 text-white font-bold text-sm rounded-full shadow-xl shadow-emerald-600/30 ring-2 ring-emerald-400/40 hover:scale-105 active:scale-95 transition-all duration-200"
        title="Chat with Campus AI"
      >
        <span className="text-lg transition-transform duration-200 group-hover:scale-125 inline-block animate-bounce">💬</span>
        <span className="font-semibold tracking-wide">Ask Echo AI</span>
        <span className="w-2.5 h-2.5 rounded-full bg-emerald-300 animate-ping"></span>
      </button>
    </div>
  )
}
