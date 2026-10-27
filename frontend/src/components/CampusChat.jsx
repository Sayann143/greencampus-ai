import { useState, useEffect, useRef } from 'react';
import { fetchMyConnections, sendChatMessage } from '../api';

// Simple Campus Connect chat UI – shows list of accepted connections and a chat window per connection.
export default function CampusChat() {
  const [connections, setConnections] = useState([]);
  const [selectedConn, setSelectedConn] = useState(null);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const messagesEndRef = useRef(null);

  // Load accepted connections for the current profile (profile id stored in localStorage by CampusConnect)
  const loadConnections = async () => {
    const profileId = localStorage.getItem('greencampus_connect_profile_id');
    if (!profileId) return;
    try {
      const conns = await fetchMyConnections(profileId);
      setConnections(conns);
    } catch (err) {
      console.error(err);
      setError('Failed to load connections.');
    }
  };

  useEffect(() => {
    loadConnections();
  }, []);

  // Auto‑scroll
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = async () => {
    const text = input.trim();
    if (!text || !selectedConn) return;
    setLoading(true);
    setError(null);
    const userMsg = { role: 'user', content: text, timestamp: new Date().toLocaleTimeString() };
    setMessages(prev => [...prev, userMsg]);
    setInput('');
    try {
      const reply = await sendChatMessage({
        profile_id: selectedConn.id,
        message: text,
        history: messages.map(m => ({ role: m.role, content: m.content })),
      });
      const botMsg = { role: 'assistant', content: reply.reply, provider: reply.provider, timestamp: new Date().toLocaleTimeString() };
      setMessages(prev => [...prev, botMsg]);
    } catch (e) {
      console.error(e);
      setError('Message failed.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto p-4">
      <h2 className="text-xl font-bold mb-4">Campus Connect Chat</h2>
      {error && <div className="mb-2 text-red-600 font-medium">{error}</div>}
      <div className="flex gap-4">
        {/* Connections list */}
        <div className="w-48 border rounded-lg p-2 overflow-y-auto max-h-96">
          <h3 className="font-semibold mb-2">Friends</h3>
          {connections.length === 0 && <p className="text-sm text-gray-500">No connections yet.</p>}
          {connections.map(conn => (
            <button
              key={conn.id}
              onClick={() => {
                setSelectedConn(conn);
                setMessages([]);
              }}
              className={`block w-full text-left p-2 rounded ${selectedConn?.id === conn.id ? 'bg-emerald-100' : 'hover:bg-gray-100'}`}
            >
              {conn.name}
            </button>
          ))}
        </div>
        {/* Chat window */}
        <div className="flex-1 flex flex-col border rounded-lg p-2 max-h-96">
          {selectedConn ? (
            <>
              <div className="flex-1 overflow-y-auto mb-2">
                {messages.map((msg, i) => (
                  <div
                    key={i}
                    className={`mb-2 flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                  >
                    <div
                      className={`px-3 py-2 rounded-lg max-w-xs ${msg.role === 'user' ? 'bg-emerald-600 text-white' : 'bg-gray-100 text-gray-800'}`}
                    >
                      {msg.content}
                    </div>
                  </div>
                ))}
                <div ref={messagesEndRef} />
              </div>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={input}
                  onChange={e => setInput(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleSend()}
                  placeholder="Type a message..."
                  className="flex-1 border rounded px-2 py-1"
                />
                <button
                  onClick={handleSend}
                  disabled={loading}
                  className="bg-emerald-600 text-white px-4 py-1 rounded disabled:opacity-50"
                >
                  Send
                </button>
              </div>
            </>
          ) : (
            <p className="text-gray-600">Select a connection to start chatting.</p>
          )}
        </div>
      </div>
    </div>
  );
    <div className="max-w-4xl mx-auto p-4">
      <h2 className="text-xl font-bold mb-4">Campus Connect Chat</h2>
      {error && <div className="text-red-600 mb-2">{error}</div>}
      <div className="flex gap-4">
        {/* Connections list */}
        <div className="w-48 border rounded-lg p-2 overflow-y-auto max-h-96">
          <h3 className="font-semibold mb-2">Friends</h3>
          {connections.length === 0 && <p className="text-sm text-gray-500">No connections yet.</p>}
          {connections.map(conn => (
            <button
              key={conn.id}
              onClick={() => {
                setSelectedConn(conn);
                setMessages([]);
              }}
              className={`block w-full text-left p-2 rounded ${selectedConn?.id === conn.id ? 'bg-emerald-100' : 'hover:bg-gray-100'}`}
            >
              {conn.name}
            </button>
          ))}
        </div>
        {/* Chat window */}
        <div className="flex-1 flex flex-col border rounded-lg p-2 max-h-96">
          {selectedConn ? (
            <>
              <div className="flex-1 overflow-y-auto mb-2">
                {messages.map((msg, i) => (
                  <div
                    key={i}
                    className={`mb-2 flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                  >
                    <div
                      className={`px-3 py-2 rounded-lg max-w-xs ${msg.role === 'user' ? 'bg-emerald-600 text-white' : 'bg-gray-100 text-gray-800'}`}
                    >
                      {msg.content}
                    </div>
                  </div>
                ))}
                <div ref={messagesEndRef} />
              </div>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={input}
                  onChange={e => setInput(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleSend()}
                  placeholder="Type a message..."
                  className="flex-1 border rounded px-2 py-1"
                />
                <button
                  onClick={handleSend}
                  disabled={loading}
                  className="bg-emerald-600 text-white px-4 py-1 rounded disabled:opacity-50"
                >
                  Send
                </button>
              </div>
            </>
          ) : (
            <p className="text-gray-600">Select a connection to start chatting.</p>
          )}
        </div>
      </div>
    </div>
  );
}
