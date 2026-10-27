import { Routes, Route, Navigate } from 'react-router-dom'
import Navbar from './components/Navbar'
import Dashboard from './components/Dashboard'
import ReportForm from './components/ReportForm'
import CampusConnect from './components/CampusConnect'
import CampusChat from './components/CampusChat'
import ChatAssistant from './components/ChatAssistant'
import FloatingChatWidget from './components/FloatingChatWidget'

function App() {
  return (
    <div className="min-h-screen bg-gray-50 flex flex-col justify-between">
      <div>
        <Navbar />
        <main className="max-w-6xl mx-auto px-4 py-8">
          <Routes>
            {/* Default route → Dashboard */}
            <Route path="/" element={<Navigate to="/dashboard" replace />} />
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/report" element={<ReportForm />} />
            <Route path="/connect" element={<CampusConnect />} />
            <Route path="/connect/chat" element={<CampusChat />} />
            <Route path="/chat" element={<ChatAssistant />} />
          </Routes>
        </main>
      </div>

      {/* Floating 24/7 AI Chat Launcher available across all pages */}
      <FloatingChatWidget />
    </div>
  )
}

export default App
