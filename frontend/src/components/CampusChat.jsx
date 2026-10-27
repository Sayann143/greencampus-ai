import { useState, useEffect, useRef, useCallback } from 'react';
import { fetchProfiles, fetchMyConnections, sendPeerMessage, fetchPeerThread, markMessagesRead } from '../api';
import { Link } from 'react-router-dom';

const POLL_INTERVAL_MS = 3000; // Poll every 3 seconds for new messages

export default function CampusChat() {
  const [profiles, setProfiles] = useState([]);
  const [currentProfileId, setCurrentProfileId] = useState(() => {
    return localStorage.getItem('greencampus_connect_profile_id') || '1';
  });
  const [connections, setConnections] = useState([]);
  const [selectedPeer, setSelectedPeer] = useState(null);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [errorBanner, setErrorBanner] = useState(null);
  const [searchFilter, setSearchFilter] = useState('');
  const [lastMsgId, setLastMsgId] = useState(0); // For incremental polling
  // Track unread counts per peer (keyed by peer ID)
  const [unreadCounts, setUnreadCounts] = useState({});
  // Store the last message preview per peer for the sidebar
  const [lastMessages, setLastMessages] = useState({});

  const messagesEndRef = useRef(null);
  const pollRef = useRef(null);
  const selectedPeerRef = useRef(selectedPeer);
  const currentProfileIdRef = useRef(currentProfileId);

  // Keep refs in sync with state so polling closure always uses current values
  useEffect(() => { selectedPeerRef.current = selectedPeer; }, [selectedPeer]);
  useEffect(() => { currentProfileIdRef.current = currentProfileId; }, [currentProfileId]);

  // ── Load all profiles so student can switch profile identity ─────────────
  useEffect(() => {
    fetchProfiles()
      .then(profs => {
        setProfiles(profs || []);
        if (!localStorage.getItem('greencampus_connect_profile_id') && profs.length > 0) {
          const firstId = String(profs[0].id);
          setCurrentProfileId(firstId);
          localStorage.setItem('greencampus_connect_profile_id', firstId);
        }
      })
      .catch(() => {});
  }, []);

  // ── Load mutual connections whenever currentProfileId changes ────────────
  const loadConnections = useCallback(async (profId) => {
    if (!profId) return;
    setLoading(true);
    setErrorBanner(null);
    try {
      const data = await fetchMyConnections(profId);
      setConnections(data || []);
      if (data && data.length > 0) {
        setSelectedPeer(prev => {
          if (!prev) return data[0].peer_profile;
          const stillThere = data.find(c => c.peer_profile?.id === prev.id);
          return stillThere ? stillThere.peer_profile : data[0].peer_profile;
        });
      } else {
        setSelectedPeer(null);
      }
    } catch (err) {
      console.error('Failed to load connections:', err);
      setErrorBanner('Could not load mutual connections. Backend may be waking up...');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadConnections(currentProfileId);
  }, [currentProfileId, loadConnections]);

  // ── Fetch full thread when peer changes ──────────────────────────────────
  useEffect(() => {
    if (!selectedPeer || !currentProfileId) {
      setMessages([]);
      setLastMsgId(0);
      return;
    }

    setMessages([]);
    setLastMsgId(0);
    setErrorBanner(null);

    fetchPeerThread(Number(currentProfileId), selectedPeer.id, 0)
      .then(msgs => {
        setMessages(msgs || []);
        if (msgs && msgs.length > 0) {
          setLastMsgId(msgs[msgs.length - 1].id);
          // Update last message preview for this peer
          setLastMessages(prev => ({ ...prev, [selectedPeer.id]: msgs[msgs.length - 1] }));
        }
        // Mark messages from peer as read now that we're viewing them
        markMessagesRead(Number(currentProfileId), selectedPeer.id).catch(() => {});
        // Clear unread count for this peer
        setUnreadCounts(prev => ({ ...prev, [selectedPeer.id]: 0 }));
      })
      .catch(err => {
        console.error('Failed to load thread:', err);
        setErrorBanner('Backend is waking up... Messages will load shortly. ☕');
      });
  }, [selectedPeer, currentProfileId]);

  // ── Polling for new messages every 3 seconds ─────────────────────────────
  useEffect(() => {
    // Clear any existing poll
    if (pollRef.current) clearInterval(pollRef.current);

    const poll = async () => {
      const peer = selectedPeerRef.current;
      const profId = currentProfileIdRef.current;
      if (!peer || !profId) return;

      try {
        const msgs = await fetchPeerThread(Number(profId), peer.id, lastMsgIdRef.current);
        if (msgs && msgs.length > 0) {
          setMessages(prev => {
            // Deduplicate by id
            const existingIds = new Set(prev.map(m => m.id));
            const newOnes = msgs.filter(m => !existingIds.has(m.id));
            if (newOnes.length === 0) return prev;
            const updated = [...prev, ...newOnes];
            lastMsgIdRef.current = updated[updated.length - 1].id;

            // Update last message preview in sidebar
            setLastMessages(p => ({ ...p, [peer.id]: updated[updated.length - 1] }));

            // Count new messages FROM peer (for unread badge if on a different chat)
            const fromPeer = newOnes.filter(m => String(m.sender_id) !== String(profId));
            if (fromPeer.length > 0) {
              // Mark as read immediately since we're viewing this conversation
              markMessagesRead(Number(profId), peer.id).catch(() => {});
            }

            return updated;
          });
        }
      } catch {
        // Silently ignore polling errors (network blip / server cold start)
      }
    };

    pollRef.current = setInterval(poll, POLL_INTERVAL_MS);
    return () => clearInterval(pollRef.current);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedPeer, currentProfileId]);

  // Keep lastMsgId in a ref so polling closure always reads current value
  const lastMsgIdRef = useRef(0);
  useEffect(() => { lastMsgIdRef.current = lastMsgId; }, [lastMsgId]);

  // Also sync messages last id to ref whenever messages change
  useEffect(() => {
    if (messages.length > 0) {
      lastMsgIdRef.current = messages[messages.length - 1].id;
    }
  }, [messages]);

  // ── Auto-scroll to bottom of conversation ────────────────────────────────
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // ── Switch student profile ────────────────────────────────────────────────
  const handleProfileSwitch = (newId) => {
    setCurrentProfileId(newId);
    localStorage.setItem('greencampus_connect_profile_id', newId);
  };

  // ── Switch to peer identity (quick "reply as peer" button) ───────────────
  const handleSwitchToPeer = () => {
    if (!selectedPeer) return;
    const oldProfile = profiles.find(p => String(p.id) === String(currentProfileId));
    handleProfileSwitch(String(selectedPeer.id));
    if (oldProfile) setSelectedPeer(oldProfile);
  };

  // ── Send a message to the backend ────────────────────────────────────────
  const handleSend = async () => {
    const text = input.trim();
    if (!text || !selectedPeer || sending) return;

    setInput('');
    setSending(true);
    setErrorBanner(null);

    try {
      const saved = await sendPeerMessage(
        Number(currentProfileId),
        selectedPeer.id,
        text,
      );
      // Optimistically add the returned message
      setMessages(prev => {
        const existingIds = new Set(prev.map(m => m.id));
        if (existingIds.has(saved.id)) return prev;
        const updated = [...prev, saved];
        lastMsgIdRef.current = saved.id;
        setLastMessages(p => ({ ...p, [selectedPeer.id]: saved }));
        return updated;
      });
    } catch (err) {
      setErrorBanner(`Failed to send: ${err.message}`);
      // Restore input so user doesn't lose their message
      setInput(text);
    } finally {
      setSending(false);
    }
  };

  const currentProfile = profiles.find(p => String(p.id) === String(currentProfileId));

  const filteredConnections = connections.filter(c => {
    const peer = c.peer_profile;
    if (!peer) return false;
    const q = searchFilter.toLowerCase();
    return peer.name.toLowerCase().includes(q) || (peer.department && peer.department.toLowerCase().includes(q));
  });

  return (
    <div className="max-w-6xl mx-auto space-y-4">
      {/* Top Header & Student Identity Switcher */}
      <div className="bg-white rounded-2xl border border-gray-200 p-4 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs font-bold mb-1">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
            Live Cross-Device Chat
          </div>
          <h2 className="text-xl sm:text-2xl font-black text-gray-900 tracking-tight">
            Campus Connect Peer Messenger
          </h2>
          <p className="text-xs text-gray-500">
            Real messages synced via the server — open on any device and they'll appear instantly.
          </p>
        </div>

        {/* Current Student Profile Switcher */}
        <div className="flex items-center gap-2.5 bg-gray-50 p-2 rounded-xl border border-gray-200">
          <span className="text-xs font-bold text-gray-600 flex-shrink-0">Chatting as:</span>
          <select
            value={currentProfileId}
            onChange={(e) => handleProfileSwitch(e.target.value)}
            className="text-xs bg-white border border-gray-300 rounded-lg px-2.5 py-1.5 font-bold text-gray-800 focus:outline-none focus:ring-2 focus:ring-emerald-500"
          >
            {profiles.map(p => (
              <option key={p.id} value={p.id}>
                {p.name} ({p.study_year} • {p.department})
              </option>
            ))}
          </select>
          <Link
            to="/connect"
            className="text-xs bg-emerald-600 hover:bg-emerald-700 text-white px-3 py-1.5 rounded-lg font-bold transition-all shadow-xs"
          >
            Directory 🤝
          </Link>
        </div>
      </div>

      {/* Error Banner */}
      {errorBanner && (
        <div className="bg-amber-50 border border-amber-200 text-amber-800 text-xs px-4 py-2.5 rounded-xl flex items-center justify-between gap-3 shadow-xs">
          <span>⚠️ {errorBanner}</span>
          <button onClick={() => setErrorBanner(null)} className="text-amber-600 hover:text-amber-800 font-bold text-sm leading-none">×</button>
        </div>
      )}

      {/* Main Split Chat View */}
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden grid grid-cols-1 md:grid-cols-12 min-h-[550px]">
        {/* Left Sidebar: Friends & Mutual Connections */}
        <div className="md:col-span-4 lg:col-span-4 border-r border-gray-200 flex flex-col bg-gray-50/50">
          <div className="p-3.5 border-b border-gray-200 bg-white">
            <div className="flex items-center justify-between mb-2">
              <h3 className="font-extrabold text-xs uppercase tracking-wider text-gray-700">
                Mutual Friends ({connections.length})
              </h3>
              <span className="text-[10px] bg-emerald-100 text-emerald-800 font-bold px-2 py-0.5 rounded-full">
                Live ⚡
              </span>
            </div>
            <div className="relative">
              <span className="absolute left-2.5 top-2 text-gray-400 text-xs">🔍</span>
              <input
                type="text"
                placeholder="Search friends..."
                value={searchFilter}
                onChange={(e) => setSearchFilter(e.target.value)}
                className="w-full bg-gray-50 border border-gray-200 rounded-xl pl-8 pr-3 py-1.5 text-xs text-gray-700 focus:outline-none focus:ring-1 focus:ring-emerald-500"
              />
            </div>
          </div>

          <div className="flex-1 overflow-y-auto divide-y divide-gray-100 p-2 space-y-1">
            {loading ? (
              <div className="text-center py-12 text-gray-400 text-xs">
                <span className="inline-block animate-spin text-xl mb-1">🌿</span>
                <p>Loading mutual connections...</p>
              </div>
            ) : filteredConnections.length === 0 ? (
              <div className="p-6 text-center text-gray-400 space-y-3">
                <p className="text-3xl">🤝</p>
                <p className="text-xs font-bold text-gray-600">No mutual friends yet</p>
                <p className="text-[11px] text-gray-400 leading-relaxed">
                  Go to Campus Connect directory, find an active peer, and send a connection request!
                </p>
                <Link
                  to="/connect"
                  className="inline-block text-xs bg-emerald-600 hover:bg-emerald-700 text-white font-bold px-3 py-1.5 rounded-xl transition shadow-xs"
                >
                  Find Peers in Directory →
                </Link>
              </div>
            ) : (
              filteredConnections.map(c => {
                const peer = c.peer_profile;
                if (!peer) return null;
                const isSelected = selectedPeer?.id === peer.id;
                const lastMsg = lastMessages[peer.id] || null;
                const unread = unreadCounts[peer.id] || 0;

                return (
                  <button
                    key={c.connection_id}
                    onClick={() => setSelectedPeer(peer)}
                    className={`w-full text-left p-3 rounded-xl transition-all flex items-start gap-3 ${
                      isSelected
                        ? 'bg-emerald-50 border border-emerald-300 shadow-sm'
                        : 'hover:bg-gray-100 border border-transparent'
                    }`}
                  >
                    <div className="relative">
                      <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-emerald-500 to-teal-500 text-white flex items-center justify-center font-bold text-sm shadow-xs flex-shrink-0">
                        {peer.name.charAt(0)}
                      </div>
                      {unread > 0 && (
                        <span className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 text-white text-[9px] font-black rounded-full flex items-center justify-center shadow-xs">
                          {unread}
                        </span>
                      )}
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <h4 className="text-xs font-bold text-gray-900 truncate">{peer.name}</h4>
                        {lastMsg ? (
                          <span className="text-[10px] text-gray-400 font-mono">
                            {lastMsg.created_at?.slice(11, 16) || ''}
                          </span>
                        ) : (
                          <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                        )}
                      </div>

                      <p className="text-[11px] text-gray-500 truncate">
                        {lastMsg
                          ? (String(lastMsg.sender_id) === String(currentProfileId) ? 'You: ' : '') + lastMsg.content
                          : `${peer.study_year} • ${peer.department}`}
                      </p>

                      {unread > 0 && (
                        <span className="inline-block mt-0.5 text-[9px] bg-red-100 text-red-700 font-bold px-1.5 rounded-full">
                          {unread} new
                        </span>
                      )}
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </div>

        {/* Right Chat Conversation View */}
        <div className="md:col-span-8 lg:col-span-8 flex flex-col bg-white">
          {selectedPeer ? (
            <>
              {/* Active Conversation Top Bar */}
              <div className="p-3.5 border-b border-gray-200 flex items-center justify-between bg-white/80 backdrop-blur-sm">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-emerald-600 to-teal-500 text-white flex items-center justify-center font-bold text-base shadow-sm">
                    {selectedPeer.name.charAt(0)}
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-gray-900 flex items-center gap-1.5">
                      <span>{selectedPeer.name}</span>
                      <span className="text-[10px] bg-emerald-100 text-emerald-800 font-bold px-2 py-0.5 rounded-full">
                        Connected
                      </span>
                    </h3>
                    <p className="text-xs text-gray-500">
                      {selectedPeer.study_year} • {selectedPeer.department}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={handleSwitchToPeer}
                    className="text-xs bg-emerald-50 hover:bg-emerald-100 text-emerald-700 font-bold px-2.5 py-1.5 rounded-lg border border-emerald-200 transition flex items-center gap-1 shadow-2xs"
                    title={`Switch active user identity to ${selectedPeer.name} to view/reply`}
                  >
                    <span>Reply as {selectedPeer.name.split(' ')[0]} 👤</span>
                  </button>
                  <div className="text-[10px] text-emerald-600 font-bold flex items-center gap-1 bg-emerald-50 px-2 py-1.5 rounded-lg border border-emerald-200">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse inline-block"></span>
                    Live
                  </div>
                </div>
              </div>

              {/* Message List */}
              <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-gradient-to-b from-gray-50/50 to-white min-h-[380px] max-h-[460px]">
                {messages.length === 0 ? (
                  <div className="text-center py-16 text-gray-400 space-y-2">
                    <p className="text-3xl">👋</p>
                    <p className="text-xs font-bold text-gray-600">Start the conversation with {selectedPeer.name}!</p>
                    <p className="text-[11px] text-gray-400 max-w-sm mx-auto">
                      Say hello, plan a study session, or share notes. Messages sync across all devices in real time.
                    </p>
                  </div>
                ) : (
                  messages.map(msg => {
                    const isUser = String(msg.sender_id) === String(currentProfileId);
                    const timeStr = msg.created_at
                      ? msg.created_at.slice(11, 16)
                      : new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

                    return (
                      <div
                        key={msg.id}
                        className={`flex items-start gap-2.5 ${isUser ? 'flex-row-reverse' : 'flex-row'}`}
                      >
                        <div className="w-8 h-8 rounded-xl flex items-center justify-center text-xs font-bold flex-shrink-0 shadow-xs">
                          {isUser ? (
                            <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-emerald-600 to-teal-600 text-white flex items-center justify-center">
                              {currentProfile?.name ? currentProfile.name.charAt(0) : 'U'}
                            </div>
                          ) : (
                            <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-blue-600 to-indigo-600 text-white flex items-center justify-center">
                              {selectedPeer.name.charAt(0)}
                            </div>
                          )}
                        </div>

                        <div
                          className={`max-w-[80%] rounded-2xl px-4 py-2.5 shadow-xs transition-all ${
                            isUser
                              ? 'bg-gradient-to-r from-emerald-600 to-teal-600 text-white rounded-tr-xs'
                              : 'bg-white border border-gray-200 text-gray-800 rounded-tl-xs shadow-sm'
                          }`}
                        >
                          <div className="flex items-center justify-between gap-3 mb-0.5">
                            <span className={`text-[10px] font-bold ${isUser ? 'text-emerald-100' : 'text-gray-500'}`}>
                              {isUser ? 'You' : selectedPeer.name}
                            </span>
                            <span className={`text-[9px] ${isUser ? 'text-emerald-200' : 'text-gray-400'}`}>
                              {timeStr}
                            </span>
                          </div>
                          <p className="text-xs leading-relaxed whitespace-pre-wrap">{msg.content}</p>

                          {/* Delivery status indicator */}
                          {isUser && (
                            <div className="text-[9px] text-emerald-200/90 text-right mt-1 font-mono flex items-center justify-end gap-1">
                              {msg.is_read === 1 ? (
                                <span>✓✓ Seen by {selectedPeer.name}</span>
                              ) : (
                                <span>✓ Delivered • Waiting for {selectedPeer.name}</span>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })
                )}

                {/* Status notice when waiting for peer reply */}
                {messages.length > 0 && String(messages[messages.length - 1].sender_id) === String(currentProfileId) && (
                  <div className="p-2 bg-emerald-50/60 border border-emerald-100 rounded-xl text-center text-[11px] text-emerald-700 animate-fade-in flex items-center justify-center gap-1.5 max-w-md mx-auto">
                    <span>⏳</span>
                    <span>
                      Message delivered to <strong>{selectedPeer.name}</strong>. Chat stays open until they reply.
                    </span>
                  </div>
                )}

                <div ref={messagesEndRef} />
              </div>

              {/* Message Input Box */}
              <div className="p-3 border-t border-gray-200 bg-white flex items-center gap-2">
                <input
                  type="text"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      handleSend();
                    }
                  }}
                  placeholder={`Write message to ${selectedPeer.name}...`}
                  className="flex-1 bg-gray-50 border border-gray-200 rounded-xl px-3.5 py-2 text-xs text-gray-800 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition"
                  disabled={sending}
                />
                <button
                  onClick={handleSend}
                  disabled={!input.trim() || sending}
                  className="bg-emerald-600 hover:bg-emerald-700 disabled:opacity-40 text-white px-4 py-2 rounded-xl text-xs font-bold transition shadow-xs flex items-center gap-1.5"
                >
                  {sending ? (
                    <span className="inline-block animate-spin">⏳</span>
                  ) : (
                    <>
                      <span>Send</span>
                      <span>🚀</span>
                    </>
                  )}
                </button>
              </div>
            </>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center p-8 text-center text-gray-400">
              <div className="w-16 h-16 rounded-3xl bg-emerald-50 text-emerald-600 flex items-center justify-center text-3xl mb-3 shadow-inner">
                💬
              </div>
              <h3 className="text-base font-bold text-gray-700 mb-1">No peer selected</h3>
              <p className="text-xs text-gray-400 max-w-sm mb-4 leading-relaxed">
                Choose a connection from the list on the left to start chatting! Messages sync live across all devices.
              </p>
              {connections.length === 0 && (
                <Link
                  to="/connect"
                  className="px-4 py-2 bg-emerald-600 text-white rounded-xl text-xs font-bold hover:bg-emerald-700 transition shadow-xs"
                >
                  Explore Available Students →
                </Link>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Info Footer */}
      <div className="text-center text-[11px] text-gray-400 flex items-center justify-center gap-2">
        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse inline-block"></span>
        Messages sync every {POLL_INTERVAL_MS / 1000}s across all devices •
        <span className="text-emerald-600 font-bold">WhatsApp-style delivery receipts</span>
      </div>
    </div>
  );
}
