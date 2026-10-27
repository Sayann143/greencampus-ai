import { useState, useEffect } from 'react'
import { Link, useLocation } from 'react-router-dom'

export default function Navbar() {
  const location = useLocation()
  const [installPrompt, setInstallPrompt] = useState(null)
  const [isInstalled, setIsInstalled] = useState(false)
  const [showIosTip, setShowIosTip] = useState(false)

  // Detect PWA installability
  useEffect(() => {
    // Check if already in standalone app mode
    if (window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone) {
      setIsInstalled(true)
    }

    const handler = (e) => {
      e.preventDefault()
      setInstallPrompt(e)
    }
    window.addEventListener('beforeinstallprompt', handler)
    window.addEventListener('appinstalled', () => {
      setIsInstalled(true)
      setInstallPrompt(null)
    })
    return () => window.removeEventListener('beforeinstallprompt', handler)
  }, [])

  const handleInstallClick = async () => {
    if (installPrompt) {
      installPrompt.prompt()
      const { outcome } = await installPrompt.userChoice
      if (outcome === 'accepted') {
        setIsInstalled(true)
        setInstallPrompt(null)
      }
    } else {
      // iOS or browser without beforeinstallprompt
      setShowIosTip(true)
      setTimeout(() => setShowIosTip(false), 5000)
    }
  }

  const isTabActive = (path) => {
    if (path === '/connect') {
      return location.pathname.startsWith('/connect')
    }
    return location.pathname === path
  }

  const desktopLinkClass = (path) => {
    const active = isTabActive(path)
    return `px-3 sm:px-4 py-2 rounded-xl text-sm font-semibold transition-all duration-200 flex items-center gap-1.5 group ${
      active
        ? 'bg-emerald-600 text-white shadow-sm shadow-emerald-600/20'
        : 'text-gray-600 hover:bg-emerald-50 hover:text-emerald-700'
    }`
  }

  const mobileTabClass = (path) => {
    const active = isTabActive(path)
    return `flex-1 py-2 flex flex-col items-center justify-center text-[10px] font-bold transition-all relative ${
      active
        ? 'text-emerald-700'
        : 'text-gray-400 hover:text-gray-700'
    }`
  }

  return (
    <>
      {/* ── TOP HEADER (Desktop & Mobile) ─────────────────────────────────── */}
      <nav className="bg-white/95 backdrop-blur-md border-b border-gray-200/80 shadow-xs sticky top-0 z-40">
        <div className="max-w-6xl mx-auto px-3.5 sm:px-4 py-2.5 sm:py-3 flex items-center justify-between">
          {/* Logo + Brand */}
          <Link to="/dashboard" className="flex items-center gap-2.5 sm:gap-3 group min-w-0">
            <img
              src="/logo.jpg"
              alt="GreenCampus AI Crest"
              className="w-9 h-9 sm:w-11 sm:h-11 rounded-xl shadow-xs border border-emerald-300 object-cover group-hover:scale-105 transition-transform duration-200 bg-white flex-shrink-0"
            />
            <div className="min-w-0">
              <h1 className="text-base sm:text-lg font-black text-emerald-800 leading-tight tracking-tight group-hover:text-emerald-900 transition-colors truncate">
                GreenCampus AI
              </h1>
              <p className="text-[10px] sm:text-[11px] text-gray-400 font-medium leading-tight truncate">
                Smart Campus & Connect
              </p>
            </div>
          </Link>

          {/* Desktop Navigation Links (>= md) */}
          <div className="hidden md:flex items-center gap-1.5 sm:gap-2">
            <Link to="/dashboard" className={desktopLinkClass('/dashboard')}>
              <span className="inline-block transition-transform duration-200 group-hover:scale-125">📊</span>
              <span>Dashboard</span>
            </Link>
            <Link to="/report" className={desktopLinkClass('/report')}>
              <span className="inline-block transition-transform duration-200 group-hover:scale-125">✏️</span>
              <span>Report Issue</span>
            </Link>
            <Link to="/connect" className={desktopLinkClass('/connect')}>
              <span className="inline-block transition-transform duration-200 group-hover:scale-125">🤝</span>
              <span>Campus Connect</span>
            </Link>
            <Link to="/chat" className={desktopLinkClass('/chat')}>
              <span className="inline-block transition-transform duration-200 group-hover:scale-125">💬</span>
              <span>EcoChat</span>
              <span className="px-1.5 py-0.2 text-[9px] bg-emerald-100 text-emerald-800 font-bold rounded-full animate-pulse">
                AI
              </span>
            </Link>
          </div>

          {/* Install App Button (PWA) */}
          <div className="flex items-center gap-2">
            {!isInstalled && (
              <button
                onClick={handleInstallClick}
                className="inline-flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white text-[11px] sm:text-xs font-bold shadow-xs hover:scale-105 active:scale-95 transition-all duration-150"
                title="Install as Phone App (Android/iOS)"
              >
                <span>📲</span>
                <span className="hidden xs:inline">Install App</span>
                <span className="xs:hidden">App</span>
              </button>
            )}

            {isInstalled && (
              <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-1 rounded-lg hidden sm:inline-block">
                ✓ App Installed
              </span>
            )}
          </div>
        </div>

        {/* iOS Install Tooltip Popover */}
        {showIosTip && (
          <div className="bg-emerald-900 text-white text-xs px-4 py-2.5 shadow-lg flex items-center justify-between animate-fade-in">
            <span>
              📲 To install on iPhone/iPad: Tap <strong>Share</strong> (square with arrow) then <strong>'Add to Home Screen'</strong>!
            </span>
            <button onClick={() => setShowIosTip(false)} className="text-white/80 hover:text-white font-bold ml-2">
              ✕
            </button>
          </div>
        )}
      </nav>

      {/* ── MOBILE BOTTOM NAVIGATION BAR (< md) ───────────────────────────── */}
      {/* Native App Style Tab Bar (iOS / Android Bottom Nav) */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-white/95 backdrop-blur-lg border-t border-gray-200/80 shadow-lg px-2 py-1 flex items-center justify-around safe-bottom">
        <Link to="/dashboard" className={mobileTabClass('/dashboard')}>
          <span className="text-lg mb-0.5">📊</span>
          <span>Dashboard</span>
          {isTabActive('/dashboard') && (
            <span className="w-1 h-1 rounded-full bg-emerald-600 mt-0.5"></span>
          )}
        </Link>

        <Link to="/report" className={mobileTabClass('/report')}>
          <span className="text-lg mb-0.5">✏️</span>
          <span>Report</span>
          {isTabActive('/report') && (
            <span className="w-1 h-1 rounded-full bg-emerald-600 mt-0.5"></span>
          )}
        </Link>

        <Link to="/connect" className={mobileTabClass('/connect')}>
          <span className="text-lg mb-0.5">🤝</span>
          <span>Connect</span>
          {isTabActive('/connect') && (
            <span className="w-1 h-1 rounded-full bg-emerald-600 mt-0.5"></span>
          )}
        </Link>

        <Link to="/chat" className={mobileTabClass('/chat')}>
          <span className="text-lg mb-0.5 relative">
            💬
            <span className="absolute -top-1 -right-2 w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
          </span>
          <span>EcoChat</span>
          {isTabActive('/chat') && (
            <span className="w-1 h-1 rounded-full bg-emerald-600 mt-0.5"></span>
          )}
        </Link>
      </nav>
    </>
  )
}
