import { useState, useEffect, useRef } from 'react';
import { fetchProfiles, fetchMyConnections, sendChatMessage } from '../api';
import { Link } from 'react-router-dom';

// Suggested conversational starters for students
const CONVERSATION_STARTERS = [
  'Hey! Are you free for a study session at Central Library? 📚',
  'Want to grab coffee at SAC Cafeteria in 15 mins? ☕',
  'Did you finish the lab assignment for this week? 💻',
  'Hey, let us take a campus walk around the Green Lawn! 🚶🌿',
];

export default function CampusChat() {
  const [profiles, setProfiles] = useState([]);
  const [currentProfileId, setCurrentProfileId] = useState(() => {
    return localStorage.getItem('greencampus_connect_profile_id') || '1';
  });
  const [connections, setConnections] = useState([]);
  const [selectedPeer, setSelectedPeer] = useState(null);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorBanner, setErrorBanner] = useState(null);
  const [searchFilter, setSearchFilter] = useState('');
  const messagesEndRef = useRef(null);

  // Load all profiles so student can switch profile identity if desired
  useEffect(() => {
    fetchProfiles()
      .then(profs => {
        setProfiles(profs);
        if (!localStorage.getItem('greencampus_connect_profile_id') && profs.length > 0) {
          const firstId = String(profs[0].id);
          setCurrentProfileId(firstId);
          localStorage.setItem('greencampus_connect_profile_id', firstId);
        }
      })
      .catch(() => {});
  }, []);

  // Load mutual connections whenever currentProfileId changes
  const loadConnections = async (profId) => {
    if (!profId) return;
    setLoading(true);
    setErrorBanner(null);
    try {
      const data = await fetchMyConnections(profId);
      setConnections(data || []);
      if (data && data.length > 0) {
        // Auto-select first peer if none selected
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
      setErrorBanner('Could not sync connections from backend. Showing local peer state.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadConnections(currentProfileId);
  }, [currentProfileId]);

  // Load messages from localStorage when selectedPeer changes
  useEffect(() => {
    if (!selectedPeer || !currentProfileId) {
      setMessages([]);
      return;
    }
    const storageKey = `greencampus_chat_${currentProfileId}_${selectedPeer.id}`;
    const saved = localStorage.getItem(storageKey);
    if (saved) {
      try {
        setMessages(JSON.parse(saved));
      } catch {
        setMessages([]);
      }
    } else {
      // Seed initial welcome message from peer
      const initialMsgs = [
        {
          id: 'init-1',
          role: 'peer',
          senderName: selectedPeer.name,
          content: `Hey! 👋 We are connected on Campus Connect. Feel free to message me for study sessions, notes, or coffee meetups!`,
          timestamp: 'Connected',
        },
      ];
      setMessages(initialMsgs);
      localStorage.setItem(storageKey, JSON.stringify(initialMsgs));
    }
  }, [selectedPeer, currentProfileId]);

  // Auto-scroll to bottom of conversation
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isTyping]);

  // Persist messages to localStorage
  const saveMessages = (peerId, newMsgs) => {
    const storageKey = `greencampus_chat_${currentProfileId}_${peerId}`;
    localStorage.setItem(storageKey, JSON.stringify(newMsgs));
  };

  // Switch student user profile
  const handleProfileSwitch = (newId) => {
    setCurrentProfileId(newId);
    localStorage.setItem('greencampus_connect_profile_id', newId);
    setSelectedPeer(null);
    setMessages([]);
  };

  // Send a message
  const handleSend = async (customText = null) => {
    const text = (customText || input).trim();
    if (!text || !selectedPeer) return;

    setInput('');
    setErrorBanner(null);

    const userMsg = {
      id: Date.now() + '-user',
      role: 'user',
      senderName: 'You',
      content: text,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    const updated = [...messages, userMsg];
    setMessages(updated);
    saveMessages(selectedPeer.id, updated);

    // Simulated peer typing + response
    setIsTyping(true);

    setTimeout(async () => {
      try {
        // Try getting an intelligent peer response via the backend AI engine
        let replyText = '';
        try {
          const aiResponse = await sendChatMessage(
            `You are roleplaying as ${selectedPeer.name}, a university student in ${selectedPeer.department} (${selectedPeer.study_year}). ` +
            `Bio: "${selectedPeer.bio || 'Campus student'}". A fellow student just messaged you on Campus Connect: "${text}". ` +
            `Respond warmly and casually as this student peer in 1-2 friendly sentences with emojis. Do not break character.`,
            []
          );
          replyText = aiResponse.reply;
        } catch {
          // Fallback peer replies if offline
          const friendlyReplies = [
            `Sounds awesome! Count me in. Let us catch up near the ${selectedPeer.department || 'Library'}! 🙌`,
            `Great hearing from you! I am just wrapping up my study notes. Let me know the time! ☕`,
            `Definitely! Thanks for reaching out. See you around campus! ✨`,
            `Hey! I was thinking the same thing. Let us connect in 15 minutes! 📚`,
          ];
          replyText = friendlyReplies[Math.floor(Math.random() * friendlyReplies.length)];
        }

        const peerMsg = {
          id: Date.now() + '-peer',
          role: 'peer',
          senderName: selectedPeer.name,
          content: replyText,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        };

        setMessages(prev => {
          const next = [...prev, peerMsg];
          saveMessages(selectedPeer.id, next);
          return next;
        });
      } catch (err) {
        console.error('Peer message error:', err);
        setErrorBanner('Notice: Peer offline, message cached in local session.');
      } finally {
        setIsTyping(false);
      }
    }, 1200);
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
      {/* Top Header & Identity Switcher */}
      <div className="bg-white rounded-2xl border border-gray-200 p-4 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs font-bold mb-1">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
            Campus Connect Peer Messenger
          </div>
          <h2 className="text-xl sm:text-2xl font-black text-gray-900 tracking-tight">
            Student Direct Chat
          </h2>
          <p className="text-xs text-gray-500">
            Real-time messaging between mutual study buddies and campus connections.
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
                {p.name} ({p.study_year})
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

      {/* Error / Offline Alert Banner */}
      {errorBanner && (
        <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-800 flex items-center justify-between animate-fade-in">
          <div className="flex items-center gap-2">
            <span>⚠️</span>
            <span>{errorBanner}</span>
          </div>
          <button
            onClick={() => setErrorBanner(null)}
            className="text-amber-600 hover:text-amber-800 font-bold"
          >
            ✕
          </button>
        </div>
      )}

      {/* Main Chat Interface Split View */}
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden grid grid-cols-1 md:grid-cols-12 min-h-[550px]">
        {/* Left Sidebar: Friends & Mutual Connections */}
        <div className="md:col-span-4 lg:col-span-4 border-r border-gray-200 flex flex-col bg-gray-50/50">
          <div className="p-3.5 border-b border-gray-200 bg-white">
            <div className="flex items-center justify-between mb-2">
              <h3 className="font-extrabold text-xs uppercase tracking-wider text-gray-700">
                Mutual Friends ({connections.length})
              </h3>
              <span className="text-[10px] bg-emerald-100 text-emerald-800 font-bold px-2 py-0.5 rounded-full">
                Active
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
                    <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-emerald-500 to-teal-500 text-white flex items-center justify-center font-bold text-sm shadow-xs flex-shrink-0">
                      {peer.name.charAt(0)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <h4 className="text-xs font-bold text-gray-900 truncate">{peer.name}</h4>
                        <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                      </div>
                      <p className="text-[11px] text-gray-500 truncate">
                        {peer.study_year} • {peer.department}
                      </p>
                      {peer.interests && peer.interests.length > 0 && (
                        <p className="text-[10px] text-emerald-700 truncate font-mono mt-0.5">
                          #{peer.interests.slice(0, 2).join(' #')}
                        </p>
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
                      <span className="text-[10px] bg-emerald-100 text-emerald-800 font-bold px-2 py-0.2 rounded-full">
                        Online
                      </span>
                    </h3>
                    <p className="text-xs text-gray-500">
                      {selectedPeer.study_year} • {selectedPeer.department}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => {
                      if (window.confirm('Clear conversation history with this peer?')) {
                        setMessages([]);
                        saveMessages(selectedPeer.id, []);
                      }
                    }}
                    className="text-xs text-gray-400 hover:text-red-600 px-2.5 py-1 rounded-lg border border-gray-200 hover:border-red-200 transition"
                    title="Clear Chat History"
                  >
                    🗑️ Clear
                  </button>
                  <Link
                    to="/connect"
                    className="text-xs bg-gray-100 hover:bg-gray-200 text-gray-700 px-3 py-1 rounded-lg font-semibold transition"
                  >
                    View Bio
                  </Link>
                </div>
              </div>

              {/* Message List */}
              <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-gradient-to-b from-gray-50/50 to-white min-h-[380px] max-h-[460px]">
                {messages.map(msg => {
                  const isUser = msg.role === 'user';
                  return (
                    <div
                      key={msg.id}
                      className={`flex items-start gap-2.5 ${isUser ? 'flex-row-reverse' : 'flex-row'}`}
                    >
                      <div className="w-8 h-8 rounded-xl flex items-center justify-center text-xs font-bold flex-shrink-0 shadow-xs">
                        {isUser ? (
                          <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-emerald-600 to-teal-600 text-white flex items-center justify-center">
                            👤
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
                        <div className="flex items-center justify-between gap-2 mb-0.5">
                          <span className={`text-[10px] font-bold ${isUser ? 'text-emerald-100' : 'text-gray-500'}`}>
                            {isUser ? 'You' : selectedPeer.name}
                          </span>
                          <span className={`text-[9px] ${isUser ? 'text-emerald-200' : 'text-gray-400'}`}>
                            {msg.timestamp}
                          </span>
                        </div>
                        <p className="text-xs leading-relaxed whitespace-pre-wrap">{msg.content}</p>
                      </div>
                    </div>
                  );
                })}

                {/* Animated Typing Indicator */}
                {isTyping && (
                  <div className="flex items-center gap-2 text-xs text-gray-400 italic py-1 animate-fade-in">
                    <div className="w-6 h-6 rounded-lg bg-gray-200 flex items-center justify-center text-[10px] font-bold text-gray-600">
                      {selectedPeer.name.charAt(0)}
                    </div>
                    <span>{selectedPeer.name} is typing</span>
                    <span className="flex items-center gap-1">
                      <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce"></span>
                      <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce [animation-delay:0.2s]"></span>
                      <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce [animation-delay:0.4s]"></span>
                    </span>
                  </div>
                )}

                <div ref={messagesEndRef} />
              </div>

              {/* Quick Starters Carousel */}
              <div className="px-4 py-2 border-t border-gray-100 bg-gray-50/80 flex items-center gap-2 overflow-x-auto no-scrollbar">
                <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider flex-shrink-0">
                  Quick Prompt:
                </span>
                {CONVERSATION_STARTERS.map((s, idx) => (
                  <button
                    key={idx}
                    onClick={() => handleSend(s)}
                    className="text-[11px] whitespace-nowrap bg-white hover:bg-emerald-50 hover:text-emerald-700 border border-gray-200 px-2.5 py-1 rounded-full font-medium transition-all shadow-2xs"
                  >
                    {s}
                  </button>
                ))}
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
                  placeholder={`Message ${selectedPeer.name}...`}
                  className="flex-1 bg-gray-50 border border-gray-200 rounded-xl px-3.5 py-2 text-xs text-gray-800 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition"
                />
                <button
                  onClick={() => handleSend()}
                  disabled={!input.trim()}
                  className="bg-emerald-600 hover:bg-emerald-700 disabled:opacity-40 text-white px-4 py-2 rounded-xl text-xs font-bold transition shadow-xs flex items-center gap-1.5"
                >
                  <span>Send</span>
                  <span>🚀</span>
                </button>
              </div>
            </>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center p-8 text-center text-gray-400">
              <div className="w-16 h-16 rounded-3xl bg-emerald-50 text-emerald-600 flex items-center justify-center text-3xl mb-3 shadow-inner">
                💬
              </div>
              <h3 className="text-base font-bold text-gray-700 mb-1">No conversation selected</h3>
              <p className="text-xs text-gray-400 max-w-sm mb-4 leading-relaxed">
                Choose a connection from the list on the left to start chatting, plan study groups, or grab lunch together!
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
    </div>
  );
}
