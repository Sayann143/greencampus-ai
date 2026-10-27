import { useState, useEffect } from 'react'

/**
 * Determines problem type from category, title, or description text
 */
export function detectProblemType(item = {}) {
  const text = `${item.category || ''} ${item.title || ''} ${item.description || ''} ${item.label || ''}`.toLowerCase()
  if (text.includes('water') || text.includes('leak') || text.includes('pipe') || text.includes('flood') || text.includes('tap') || text.includes('drain')) {
    return 'water'
  }
  if (text.includes('gas') || text.includes('smoke') || text.includes('fire') || text.includes('spark') || text.includes('wire') || text.includes('electric')) {
    return 'smoke'
  }
  if (text.includes('trash') || text.includes('garbage') || text.includes('waste') || text.includes('dustbin') || text.includes('cleanliness') || text.includes('litter')) {
    return 'garbage'
  }
  if (text.includes('wifi') || text.includes('wi-fi') || text.includes('internet') || text.includes('network')) {
    return 'wifi'
  }
  if (text.includes('ac') || text.includes('cool') || text.includes('hvac') || text.includes('air condition')) {
    return 'ac'
  }
  return 'water' // default fallback
}

/**
 * ProblemAnimation component renders visual particle effects
 * (water splashes, smoke puffs & sparks, tumbling garbage, wifi pings, frost flakes)
 */
export default function ProblemAnimation({ type = 'water', active = false, onComplete }) {
  const [animating, setAnimating] = useState(active)

  useEffect(() => {
    if (active) {
      setAnimating(true)
      const t = setTimeout(() => {
        setAnimating(false)
        if (onComplete) onComplete()
      }, 1600)
      return () => clearTimeout(t)
    }
  }, [active, onComplete])

  if (!animating) return null

  return (
    <div className="absolute inset-0 pointer-events-none overflow-hidden rounded-2xl z-30 flex items-center justify-center">
      {/* ── 1. WATER SPLASH ── */}
      {type === 'water' && (
        <div className="relative w-full h-full flex items-center justify-center">
          {/* Water Expanding Ripple */}
          <div
            className="absolute w-24 h-24 rounded-full border-4 border-cyan-400 bg-cyan-200/30"
            style={{ animation: 'waterRipple 0.9s ease-out forwards' }}
          />
          <div
            className="absolute w-16 h-16 rounded-full border-2 border-blue-400"
            style={{ animation: 'waterRipple 1.2s ease-out 0.2s forwards' }}
          />

          {/* 10 Radiating Splash Drops */}
          {[
            { tx: -45, ty: -55, delay: 0 },
            { tx: 45,  ty: -60, delay: 0.05 },
            { tx: -65, ty: -20, delay: 0.1 },
            { tx: 65,  ty: -25, delay: 0.08 },
            { tx: -35, ty: 45,  delay: 0.15 },
            { tx: 40,  ty: 40,  delay: 0.12 },
            { tx: 0,   ty: -70, delay: 0.02 },
            { tx: -20, ty: -60, delay: 0.07 },
            { tx: 25,  ty: -55, delay: 0.04 },
            { tx: 0,   ty: 50,  delay: 0.18 },
          ].map((drop, i) => (
            <span
              key={i}
              className="absolute text-base select-none"
              style={{
                '--tx': `${drop.tx}px`,
                '--ty': `${drop.ty}px`,
                animation: `waterDropSplash 1s cubic-bezier(0.25, 1, 0.5, 1) ${drop.delay}s forwards`,
              }}
            >
              💧
            </span>
          ))}

          <span className="text-2xl animate-bounce">💦</span>
        </div>
      )}

      {/* ── 2. SMOKE & SPARKS (Gas leak / Electrical) ── */}
      {type === 'smoke' && (
        <div className="relative w-full h-full flex items-center justify-center">
          {/* Billowing Smoke Puffs */}
          {[
            { sx: -25, delay: 0, bg: 'bg-gray-400/50', size: 'w-10 h-10' },
            { sx: 30,  delay: 0.1, bg: 'bg-slate-400/50', size: 'w-14 h-14' },
            { sx: -10, delay: 0.2, bg: 'bg-gray-500/40', size: 'w-16 h-16' },
            { sx: 20,  delay: 0.3, bg: 'bg-zinc-400/50', size: 'w-12 h-12' },
            { sx: 0,   delay: 0.4, bg: 'bg-gray-300/40', size: 'w-20 h-20' },
          ].map((puff, i) => (
            <div
              key={i}
              className={`absolute rounded-full ${puff.bg} ${puff.size} backdrop-blur-sm shadow-inner`}
              style={{
                '--sx': `${puff.sx}px`,
                animation: `smokeBillow 1.3s ease-out ${puff.delay}s forwards`,
              }}
            />
          ))}

          {/* Crackling Electrical Sparks */}
          {[
            { kx: -30, ky: -25, delay: 0.05, icon: '⚡' },
            { kx: 35,  ky: -35, delay: 0.15, icon: '✨' },
            { kx: -20, ky: 20,  delay: 0.25, icon: '💥' },
            { kx: 25,  ky: 15,  delay: 0.18, icon: '⚡' },
          ].map((spark, i) => (
            <span
              key={i}
              className="absolute text-lg select-none"
              style={{
                '--kx': `${spark.kx}px`,
                '--ky': `${spark.ky}px`,
                animation: `sparkFlash 0.9s ease-in-out ${spark.delay}s forwards`,
              }}
            >
              {spark.icon}
            </span>
          ))}

          <span className="text-xl animate-pulse">💨</span>
        </div>
      )}

      {/* ── 3. GARBAGE FLOW (Trash / Cleanliness) ── */}
      {type === 'garbage' && (
        <div className="relative w-full h-full flex items-center justify-center">
          {/* Swirling Trash Particles */}
          {[
            { gx: 60,  gy: 45,  delay: 0,    item: '📄' },
            { gx: -70, gy: 30,  delay: 0.1,  item: '🍂' },
            { gx: 50,  gy: -50, delay: 0.15, item: '🥤' },
            { gx: -50, gy: -40, delay: 0.05, item: '🍏' },
            { gx: 75,  gy: -15, delay: 0.2,  item: '📦' },
            { gx: -40, gy: 55,  delay: 0.25, item: '🗑️' },
          ].map((trash, i) => (
            <span
              key={i}
              className="absolute text-lg select-none"
              style={{
                '--gx': `${trash.gx}px`,
                '--gy': `${trash.gy}px`,
                animation: `garbageTumble 1.3s cubic-bezier(0.2, 0.8, 0.4, 1) ${trash.delay}s forwards`,
              }}
            >
              {trash.item}
            </span>
          ))}
          <span className="text-2xl animate-spin">🌪️</span>
        </div>
      )}

      {/* ── 4. WI-FI WAVES ── */}
      {type === 'wifi' && (
        <div className="relative w-full h-full flex items-center justify-center">
          {[0, 0.25, 0.5].map((delay, i) => (
            <div
              key={i}
              className="absolute w-20 h-20 rounded-full border-4 border-cyan-400 bg-cyan-100/20"
              style={{ animation: `wifiPing 1.2s ease-out ${delay}s forwards` }}
            />
          ))}
          <span className="text-3xl animate-bounce">📶</span>
        </div>
      )}

      {/* ── 5. AC / FROST FLUTTER ── */}
      {type === 'ac' && (
        <div className="relative w-full h-full flex items-center justify-center">
          {[
            { fx: -45, delay: 0 },
            { fx: 35,  delay: 0.1 },
            { fx: -20, delay: 0.2 },
            { fx: 40,  delay: 0.15 },
            { fx: 0,   delay: 0.05 },
          ].map((flake, i) => (
            <span
              key={i}
              className="absolute text-base select-none"
              style={{
                '--fx': `${flake.fx}px`,
                animation: `snowFlutter 1.3s ease-out ${flake.delay}s forwards`,
              }}
            >
              ❄️
            </span>
          ))}
          <span className="text-2xl animate-pulse">🥶</span>
        </div>
      )}
    </div>
  )
}
