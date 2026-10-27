import { useState, useEffect, useRef, useCallback } from 'react';
import { fetchProfiles, fetchMyConnections, sendPeerMessage, fetchPeerThread, markMessagesRead } from '../api';
import { Link } from 'react-router-dom';

const POLL_INTERVAL_MS = 3000; // Poll every 3 seconds for new messages

// Local cross-tab & profile cache helpers
const getThreadCacheKey = (id1, id2) => {
  const [a, b] = [Number(id1), Number(id2)].sort((x, y) => x - y);
  return `greencampus_thread_${a}_${b}`;
};

const getLocalThread = (id1, id2) => {
  try {
    const raw = localStorage.getItem(getThreadCacheKey(id1, id2));
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
};

const saveLocalThread = (id1, id2, msgs) => {
  try {
    localStorage.setItem(getThreadCacheKey(id1, id2), JSON.stringify(msgs));
  } catch {}
};

// Cross-tab live broadcast bus (works across tabs and windows instantly)
const chatChannel = typeof window !== 'undefined' && 'BroadcastChannel' in window
  ? new window.BroadcastChannel('greencampus_peer_chat_bus')
  : null;

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
  const [unreadCounts, setUnreadCounts] = useState({});
  const [lastMessages, setLastMessages] = useState({});

  const messagesEndRef = useRef(null);
  const pollRef = useRef(null);
  const selectedPeerRef = useRef(selectedPeer);
  const currentProfileIdRef = useRef(currentProfileId);

  // Keep refs in sync with state so polling closure always uses current values
  useEffect(() => { selectedPeerRef.current = selectedPeer; }, [selectedPeer]);
  useEffect(() => { currentProfileIdRef.current = currentProfileId; }, [currentProfileId]);

  // ── BroadcastChannel listener for instant cross-tab sync ─────────────────
  useEffect(() => {
    if (!chatChannel) return;
    const handler = (event) => {
      if (event.data?.type === 'PEER_MESSAGE') {
        const newMsg = event.data.message;
        const peer = selectedPeerRef.current;
        const profId = currentProfileIdRef.current;

        // Update preview in sidebar
        const otherId = String(newMsg.sender_id) === String(profId) ? newMsg.recipient_id : newMsg.sender_id;
        setLastMessages(prev => ({ ...prev, [otherId]: newMsg }));

        // Check if message belongs to currently open conversation
        const isCurrentThread =
          (String(newMsg.sender_id) === String(profId) && String(newMsg.recipient_id) === String(peer?.id)) ||
          (String(newMsg.sender_id) === String(peer?.id) && String(newMsg.recipient_id) === String(profId));

        if (isCurrentThread) {
          setMessages(prev => {
            if (prev.some(m => m.id === newMsg.id || (m.content === newMsg.content && m.sender_id === newMsg.sender_id))) {
              return prev;
            }
            const updated = [...prev, newMsg];
            saveLocalThread(profId, peer.id, updated);
            return updated;
          });
        }
      }
    };

    chatChannel.addEventListener('message', handler);
    return () => chatChannel.removeEventListener('message', handler);
  }, []);

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
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadConnections(currentProfileId);
  }, [currentProfileId, loadConnections]);

  // ── Fetch thread when peer changes (Local Cache + Backend Sync) ──────────
  useEffect(() => {
    if (!selectedPeer || !currentProfileId) {
      setMessages([]);
      setLastMsgId(0);
      return;
    }

    const senderId = Number(currentProfileId);
    const peerId = selectedPeer.id;

    // Step 1: Load from local cache immediately (0ms delay!)
    const cached = getLocalThread(senderId, peerId);
    setMessages(cached);
    if (cached.length > 0) {
      const validNumeric = cached.filter(m => typeof m.id === 'number');
      if (validNumeric.length > 0) {
        setLastMsgId(validNumeric[validNumeric.length - 1].id);
      }
      setLastMessages(prev => ({ ...prev, [peerId]: cached[cached.length - 1] }));
    }
    setErrorBanner(null);

    // Step 2: Sync with backend server
    fetchPeerThread(senderId, peerId, 0)
      .then(serverMsgs => {
        if (serverMsgs && serverMsgs.length > 0) {
          setMessages(prev => {
            // Deduplicate and merge server messages with local-only messages
            const serverIds = new Set(serverMsgs.map(m => m.id));
            const serverContentKey = new Set(serverMsgs.map(m => `${m.sender_id}_${m.content}`));
            const localPending = prev.filter(m => m.is_local && !serverContentKey.has(`${m.sender_id}_${m.content}`));
            const merged = [...serverMsgs, ...localPending];
            merged.sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
            saveLocalThread(senderId, peerId, merged);
            return merged;
          });
          const lastServer = serverMsgs[serverMsgs.length - 1];
          setLastMsgId(lastServer.id);
          setLastMessages(prev => ({ ...prev, [peerId]: lastServer }));
        }
        markMessagesRead(senderId, peerId).catch(() => {});
        setUnreadCounts(prev => ({ ...prev, [peerId]: 0 }));
      })
      .catch(err => {
        console.log('Peer thread background sync note:', err.message);
      });
  }, [selectedPeer, currentProfileId]);

  // ── Polling for new messages every 3 seconds ─────────────────────────────
  useEffect(() => {
    if (pollRef.current) clearInterval(pollRef.current);

    const poll = async () => {
      const peer = selectedPeerRef.current;
      const profId = currentProfileIdRef.current;
      if (!peer || !profId) return;

      try {
        const msgs = await fetchPeerThread(Number(profId), peer.id, lastMsgIdRef.current);
        if (msgs && msgs.length > 0) {
          setMessages(prev => {
            const existingIds = new Set(prev.map(m => m.id));
            const newOnes = msgs.filter(m => !existingIds.has(m.id));
            if (newOnes.length === 0) return prev;
            const updated = [...prev, ...newOnes];
            lastMsgIdRef.current = updated[updated.length - 1].id;
            saveLocalThread(profId, peer.id, updated);
            setLastMessages(p => ({ ...p, [peer.id]: updated[updated.length - 1] }));

            const fromPeer = newOnes.filter(m => String(m.sender_id) !== String(profId));
            if (fromPeer.length > 0) {
              markMessagesRead(Number(profId), peer.id).catch(() => {});
            }
            return updated;
          });
        }
      } catch {
        // Silently ignore polling network blips
      }
    };

    pollRef.current = setInterval(poll, POLL_INTERVAL_MS);
    return () => clearInterval(pollRef.current);
  }, [selectedPeer, currentProfileId]);

  // Keep lastMsgId in a ref so polling closure always reads current value
  const lastMsgIdRef = useRef(0);
  useEffect(() => { lastMsgIdRef.current = lastMsgId; }, [lastMsgId]);

  useEffect(() => {
    if (messages.length > 0) {
      const numeric = messages.filter(m => typeof m.id === 'number');
      if (numeric.length > 0) {
        lastMsgIdRef.current = numeric[numeric.length - 1].id;
      }
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

  // ── Resilient Send (Optimistic + Local Broadcast + Backend Sync) ─────────
  const handleSend = async () => {
    const text = input.trim();
    if (!text || !selectedPeer || sending) return;

    setInput('');
    setErrorBanner(null);

    const senderId = Number(currentProfileId);
    const peerId = selectedPeer.id;
    const tempId = `local_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    const nowStr = new Date().toISOString().replace('T', ' ').slice(0, 19);

    const optimisticMsg = {
      id: tempId,
      sender_id: senderId,
      recipient_id: peerId,
      content: text,
      created_at: nowStr,
      is_read: 0,
      is_local: true,
      sync_pending: true,
    };

    // 1. Instantly display in conversation (WhatsApp feel)
    setMessages(prev => {
      const updated = [...prev, optimisticMsg];
      saveLocalThread(senderId, peerId, updated);
      return updated;
    });
    setLastMessages(p => ({ ...p, [peerId]: optimisticMsg }));

    // 2. Broadcast to other open windows/tabs on this device
    if (chatChannel) {
      try {
        chatChannel.postMessage({
          type: 'PEER_MESSAGE',
          message: optimisticMsg,
        });
      } catch {}
    }

    // 3. Send to server for cross-device persistence
    setSending(true);
    try {
      const saved = await sendPeerMessage(senderId, peerId, text);
      // Replace optimistic message with confirmed server message
      setMessages(prev => {
        const updated = prev.map(m => m.id === tempId ? { ...saved, is_local: false, sync_pending: false } : m);
        saveLocalThread(senderId, peerId, updated);
        lastMsgIdRef.current = saved.id;
        setLastMessages(p => ({ ...p, [peerId]: saved }));
        return updated;
      });
    } catch (err) {
      console.warn('Backend message sync queued locally:', err);
      // Keep message in thread marked as delivered locally
      setMessages(prev => {
        const updated = prev.map(m => m.id === tempId ? { ...m, sync_pending: false, is_delivered_locally: true } : m);
        saveLocalThread(senderId, peerId, updated);
        return updated;
      });
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
          <h2 className="text-xl sm:text-2xl font-black text-gray-900 tracking-tight flex items-center gap-2">
            <span>Campus Connect Peer Messenger</span>
            <span className="text-xl transition-transform hover:scale-125 duration-200 inline-block cursor-default">💬</span>
          </h2>
          <p className="text-xs text-gray-500">
            Real peer chat synced live. Send messages to your campus friends anytime!
          </p>
        </div>

        {/* Current Student Profile Switcher */}
        <div className="flex items-center gap-2.5 bg-gray-50 p-2 rounded-xl border border-gray-200">
          <span className="text-xs font-bold text-gray-600 flex-shrink-0">Chatting as:</span>
          <select
            value={currentProfileId}
            onChange={(e) => handleProfileSwitch(e.target.value)}
            className="text-xs bg-white border border-gray-300 rounded-lg px-2.5 py-1.5 font-bold text-gray-800 focus:outline-none focus:ring-2 focus:ring-emerald-500 hover:border-emerald-400 transition"
          >
            {profiles.map(p => (
              <option key={p.id} value={p.id}>
                {p.name} ({p.study_year} • {p.department})
              </option>
            ))}
          </select>
          <Link
            to="/connect"
            className="text-xs bg-emerald-600 hover:bg-emerald-700 text-white px-3 py-1.5 rounded-lg font-bold transition-all shadow-xs flex items-center gap-1 hover:scale-105 active:scale-95 duration-150"
          >
            <span>Directory</span>
            <span className="inline-block transition-transform hover:scale-125">🤝</span>
          </Link>
        </div>
      </div>

      {/* Error / Status Banner */}
      {errorBanner && (
        <div className="bg-amber-50 border border-amber-200 text-amber-800 text-xs px-4 py-2.5 rounded-xl flex items-center justify-between gap-3 shadow-xs">
          <span>⚠️ {errorBanner}</span>
          <button onClick={() => setErrorBanner(null)} className="text-amber-600 hover:text-amber-800 font-bold text-sm leading-none">×</button>
        </div>
      )}

      {/* Main Split Chat View */}
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden grid grid-cols-1 md:grid-cols-12 min-h-[550px]">
        {/* Left Sidebar: Friends & Mutual Connections */}
        <div className={`md:col-span-4 lg:col-span-4 border-r border-gray-200 flex flex-col bg-gray-50/50 ${selectedPeer ? 'hidden md:flex' : 'flex'}`}>
          <div className="p-3.5 border-b border-gray-200 bg-white">
            <div className="flex items-center justify-between mb-2">
              <h3 className="font-extrabold text-xs uppercase tracking-wider text-gray-700 flex items-center gap-1.5">
                <span className="inline-block transition-transform hover:scale-125 duration-150">🤝</span>
                <span>Mutual Friends ({connections.length})</span>
              </h3>
              <span className="text-[10px] bg-emerald-100 text-emerald-800 font-bold px-2 py-0.5 rounded-full flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                Live ⚡
              </span>
            </div>
            <div className="relative">
              <span className="absolute left-2.5 top-2 text-gray-400 text-xs inline-block transition-transform hover:scale-125 duration-150">🔍</span>
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
                <p className="text-3xl transition-transform hover:scale-125 duration-200 inline-block">🤝</p>
                <p className="text-xs font-bold text-gray-600">No mutual friends yet</p>
                <p className="text-[11px] text-gray-400 leading-relaxed">
                  Go to Campus Connect directory, find an active peer, and send a connection request!
                </p>
                <Link
                  to="/connect"
                  className="inline-block text-xs bg-emerald-600 hover:bg-emerald-700 text-white font-bold px-3 py-1.5 rounded-xl transition shadow-xs hover:scale-105 active:scale-95 duration-150"
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
                    className={`w-full text-left p-3 rounded-xl transition-all flex items-start gap-3 group ${
                      isSelected
                        ? 'bg-emerald-50 border border-emerald-300 shadow-sm'
                        : 'hover:bg-gray-100 border border-transparent'
                    }`}
                  >
                    <div className="relative">
                      <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-emerald-500 to-teal-500 text-white flex items-center justify-center font-bold text-sm shadow-xs flex-shrink-0 transition-transform duration-200 group-hover:scale-110">
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
                        <h4 className="text-xs font-bold text-gray-900 truncate group-hover:text-emerald-700 transition-colors">{peer.name}</h4>
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
        <div className={`md:col-span-8 lg:col-span-8 flex flex-col bg-white ${!selectedPeer ? 'hidden md:flex' : 'flex'}`}>
          {selectedPeer ? (
            <>
              {/* Active Conversation Top Bar */}
              <div className="p-3.5 border-b border-gray-200 flex items-center justify-between bg-white/80 backdrop-blur-sm">
                <div className="flex items-center gap-2.5">
                  <button
                    onClick={() => setSelectedPeer(null)}
                    className="md:hidden px-2.5 py-1.5 text-gray-600 hover:text-emerald-700 font-bold text-xs bg-gray-100 hover:bg-emerald-50 rounded-xl transition flex items-center gap-1 active:scale-95 flex-shrink-0"
                    title="Back to Friends"
                  >
                    <span>←</span>
                    <span className="hidden xs:inline">Friends</span>
                  </button>
                  <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-2xl bg-gradient-to-tr from-emerald-600 to-teal-500 text-white flex items-center justify-center font-bold text-sm sm:text-base shadow-sm transition-transform hover:scale-110 duration-200 flex-shrink-0">
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
                  <div className="text-[10px] text-emerald-600 font-bold flex items-center gap-1 bg-emerald-50 px-2 py-1.5 rounded-lg border border-emerald-200">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse inline-block"></span>
                    Live Sync
                  </div>
                </div>
              </div>

              {/* Message List */}
              <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-gradient-to-b from-gray-50/50 to-white min-h-[380px] max-h-[460px]">
                {messages.length === 0 ? (
                  <div className="text-center py-16 text-gray-400 space-y-2">
                    <p className="text-3xl transition-transform hover:scale-125 duration-200 inline-block cursor-default">👋</p>
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
                        <div className="w-8 h-8 rounded-xl flex items-center justify-center text-xs font-bold flex-shrink-0 shadow-xs transition-transform hover:scale-110 duration-150">
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
                              ) : msg.sync_pending ? (
                                <span>⏳ Sending...</span>
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
                    <span className="inline-block transition-transform hover:scale-125 duration-150">⏳</span>
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
                  className="group bg-emerald-600 hover:bg-emerald-700 disabled:opacity-40 text-white px-4 py-2 rounded-xl text-xs font-bold transition-all shadow-xs flex items-center gap-1.5 hover:scale-105 active:scale-95 duration-150"
                >
                  {sending ? (
                    <span className="inline-block animate-spin">⏳</span>
                  ) : (
                    <>
                      <span>Send</span>
                      <span className="inline-block transition-transform duration-200 group-hover:scale-125">🚀</span>
                    </>
                  )}
                </button>
              </div>
            </>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center p-8 text-center text-gray-400">
              <div className="w-16 h-16 rounded-3xl bg-emerald-50 text-emerald-600 flex items-center justify-center text-3xl mb-3 shadow-inner transition-transform hover:scale-110 duration-200 cursor-default">
                💬
              </div>
              <h3 className="text-base font-bold text-gray-700 mb-1">No peer selected</h3>
              <p className="text-xs text-gray-400 max-w-sm mb-4 leading-relaxed">
                Choose a connection from the list on the left to start chatting! Messages sync live across all devices.
              </p>
              {connections.length === 0 && (
                <Link
                  to="/connect"
                  className="px-4 py-2 bg-emerald-600 text-white rounded-xl text-xs font-bold hover:bg-emerald-700 transition shadow-xs hover:scale-105 active:scale-95 duration-150"
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
        <span className="text-emerald-600 font-bold">WhatsApp-style instant delivery receipts</span>
      </div>
    </div>
  );
}
