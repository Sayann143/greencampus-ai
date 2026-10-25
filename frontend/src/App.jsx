import { Routes, Route, Navigate } from 'react-router-dom'
import Navbar from './components/Navbar'
import Dashboard from './components/Dashboard'
import ReportForm from './components/ReportForm'
import CampusConnect from './components/CampusConnect'

function App() {
  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />
      <main className="max-w-6xl mx-auto px-4 py-8">
        <Routes>
          {/* Default route → Dashboard */}
          <Route path="/" element={<Navigate to="/dashboard" replace />} />
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/report" element={<ReportForm />} />
          <Route path="/connect" element={<CampusConnect />} />
        </Routes>
      </main>
    </div>
  )
}

export default App
