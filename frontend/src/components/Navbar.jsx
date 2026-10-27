import { Link, useLocation } from 'react-router-dom'

export default function Navbar() {
  const location = useLocation()

  const linkClass = (path) => {
    const isActive = location.pathname === path || (path === '/connect' && location.pathname.startsWith('/connect'))
    return `px-3 sm:px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 flex items-center gap-1.5 group ${
      isActive
        ? 'bg-green-600 text-white shadow-sm'
        : 'text-gray-600 hover:bg-green-50 hover:text-green-700'
    }`
  }

  return (
    <nav className="bg-white border-b border-gray-200 shadow-sm sticky top-0 z-50">
      <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between">
        {/* Logo + Brand */}
        <Link to="/dashboard" className="flex items-center gap-3 group">
          <img
            src="/logo.jpg"
            alt="GreenCampus AI School Crest"
            className="w-10 h-10 sm:w-11 sm:h-11 rounded-xl shadow-md border-2 border-emerald-300 object-cover group-hover:scale-105 group-hover:shadow-emerald-500/20 transition-all duration-200 bg-white"
          />
          <div>
            <h1 className="text-lg font-extrabold text-green-700 leading-tight tracking-tight group-hover:text-green-800 transition-colors">GreenCampus AI</h1>
            <p className="text-[11px] text-gray-400 font-medium leading-tight">Smart Campus & Student Connect</p>
          </div>
        </Link>

        {/* Navigation Links */}
        <div className="flex items-center gap-1 sm:gap-2">
          <Link to="/dashboard" className={linkClass('/dashboard')}>
            <span className="inline-block transition-transform duration-200 group-hover:scale-125">📊</span>
            <span className="hidden sm:inline">Dashboard</span>
          </Link>
          <Link to="/report" className={linkClass('/report')}>
            <span className="inline-block transition-transform duration-200 group-hover:scale-125">✏️</span>
            <span className="hidden sm:inline">Report Issue</span>
          </Link>
          <Link to="/connect" className={linkClass('/connect')}>
            <span className="inline-block transition-transform duration-200 group-hover:scale-125">🤝</span>
            <span>Campus Connect</span>
          </Link>
          <Link to="/chat" className={linkClass('/chat')}>
            <span className="inline-block transition-transform duration-200 group-hover:scale-125">💬</span>
            <span>EcoChat</span>
            <span className="hidden md:inline px-1.5 py-0.2 text-[10px] bg-emerald-100 text-emerald-800 font-bold rounded-full animate-pulse">
              AI
            </span>
          </Link>
        </div>
      </div>
    </nav>
  )
}
