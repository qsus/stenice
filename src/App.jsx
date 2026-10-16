import { useState, useEffect, useMemo, Suspense } from 'react'
import { Canvas } from '@react-three/fiber'
import { useGLTF, OrbitControls, Html } from '@react-three/drei'

// Project dates
const START_DATE = '2026-10-01'
const END_DATE = '2026-10-16' 

const startMs = new Date(START_DATE).getTime()
const endMs = new Date(END_DATE).getTime()
const stepMs = 24 * 60 * 60 * 1000 // 1 day stepping

// Format helper
function formatDate(ms) {
  return new Date(ms).toISOString().split('T')[0]
}

const STATUS_CONFIG = {
  infected: { color: 'white', bg: '#ef4444', label: 'Infected' },
  quarantine: { color: 'white', bg: '#f59e0b', label: 'Quarantine' },
  disinfected: { color: 'white', bg: '#22c55e', label: 'Disinfected' },
}

function BuildingScene({ selectedDate }) {
  const { scene } = useGLTF('/building.glb')
  
  // Stores the full chronological timeline of all events
  const [allEvents, setAllEvents] = useState([])

  // Fetch only once on mount
  useEffect(() => {
    fetch('/api/infected-rooms')
      .then((res) => res.json())
      .then((data) => setAllEvents(data))
      .catch((err) => console.error('Failed to load data:', err))
  }, [])

  // Instantly recompute active points when the slider or data changes
  const visibleRooms = useMemo(() => {
    const activeMap = new Map()

    for (const event of allEvents) {
      // Replay events up to the selected date
      if (event.date <= selectedDate) {
        // Because the array is strictly chronological, later updates 
        // to the same room automatically overwrite older ones in the Map
        activeMap.set(event.id, event)
      }
    }

    return Array.from(activeMap.values())
  }, [allEvents, selectedDate])

  return (
    <group>
      <primitive object={scene} />

      {visibleRooms.map((room) => {
        const config = STATUS_CONFIG[room.status] || STATUS_CONFIG.infected

        return (
          <Html 
            key={room.id} 
            position={room.position} 
            center 
            zIndexRange={[100, 0]}
          >
            <div style={{
              background: config.bg,
              color: config.color,
              padding: '6px 10px',
              borderRadius: '6px',
              fontFamily: 'sans-serif',
              fontSize: '12px',
              fontWeight: 'bold',
              pointerEvents: 'none', 
              whiteSpace: 'nowrap',
              boxShadow: '0 2px 4px rgba(0,0,0,0.3)',
              border: '1px solid rgba(255,255,255,0.2)'
            }}>
              {config.label}
            </div>
          </Html>
        )
      })}
    </group>
  )
}

export default function App() {
  const [selectedDate, setSelectedDate] = useState(END_DATE)

  const handleSliderChange = (e) => {
    const newDateStr = formatDate(Number(e.target.value))
    setSelectedDate(newDateStr)
  }

  return (
    <div style={{ position: 'absolute', top: 0, left: 0, width: '100vw', height: '100vh', background: '#1a1a1a', overflow: 'hidden' }}>
      
      {/* UI Slider Panel */}
      <div style={{
        position: 'absolute',
        top: '20px',
        left: '20px',
        zIndex: 10,
        background: 'rgba(0, 0, 0, 0.7)',
        padding: '20px',
        borderRadius: '12px',
        color: 'white',
        fontFamily: 'sans-serif',
        minWidth: '250px',
        backdropFilter: 'blur(4px)',
        border: '1px solid rgba(255,255,255,0.1)'
      }}>
        <h3 style={{ margin: '0 0 15px 0', fontSize: '16px' }}>Status Timeline</h3>
        
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '10px', fontSize: '14px', fontWeight: 'bold' }}>
          <span>Date:</span>
          <span style={{ color: '#60a5fa' }}>{selectedDate}</span>
        </div>

        <input 
          type="range" 
          min={startMs} 
          max={endMs} 
          step={stepMs} 
          value={new Date(selectedDate).getTime()} 
          onChange={handleSliderChange}
          style={{ width: '100%', cursor: 'pointer' }}
        />
        
        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '5px', fontSize: '11px', color: '#9ca3af' }}>
          <span>{START_DATE}</span>
          <span>{END_DATE}</span>
        </div>
      </div>

      <Canvas camera={{ position: [8, 8, 8], fov: 45 }}>
        <ambientLight intensity={0.6} />
        <directionalLight position={[10, 20, 10]} intensity={1.5} />
        
        <Suspense fallback={
          <mesh>
            <boxGeometry args={[1, 1, 1]} />
            <meshStandardMaterial color="orange" />
            <Html center>
              <div style={{ color: 'white', fontFamily: 'sans-serif', marginTop: '50px', whiteSpace: 'nowrap' }}>
                Loading 3D model...
              </div>
            </Html>
          </mesh>
        }>
          <BuildingScene selectedDate={selectedDate} />
        </Suspense>

        <OrbitControls makeDefault enableDamping dampingFactor={0.05} />
      </Canvas>
    </div>
  )
}
