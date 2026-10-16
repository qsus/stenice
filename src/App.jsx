import { useState, useEffect, useMemo, Suspense } from 'react'
import { Canvas } from '@react-three/fiber'
import { useGLTF, OrbitControls } from '@react-three/drei'
import * as THREE from 'three'

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

// Generates a soft, non-linear radial gradient for smooth blending
function GasHeatmap({ activeRooms }) {
  const particleTexture = useMemo(() => {
    const canvas = document.createElement('canvas')
    canvas.width = 128
    canvas.height = 128
    const context = canvas.getContext('2d')
    
    const gradient = context.createRadialGradient(64, 64, 0, 64, 64, 64)
    // Lower peak opacity and a gradual falloff removes the "distinct ball" hot center
    gradient.addColorStop(0.0, 'rgba(255, 255, 255, 0.35)') 
    gradient.addColorStop(0.4, 'rgba(255, 255, 255, 0.15)') 
    gradient.addColorStop(1.0, 'rgba(255, 255, 255, 0.0)') 
    
    context.fillStyle = gradient
    context.fillRect(0, 0, 128, 128)
    return new THREE.CanvasTexture(canvas)
  }, [])

  return (
    <group>
      {activeRooms.map(room => {
        if (room.status === 'disinfected') return null;
        
        const hexColor = room.status === 'quarantine' ? '#f59e0b' : '#ef4444';

        return (
          // Scale is set large enough so neighboring points on the grid overlap naturally
          <sprite key={room.id} position={room.position} scale={[14, 14, 14]}>
            <spriteMaterial 
              map={particleTexture}
              color={hexColor}
              depthTest={false} // Allows the color to pierce through the semi-transparent walls
              transparent={true}
              blending={THREE.AdditiveBlending}
            />
          </sprite>
        )
      })}
    </group>
  )
}

function BuildingScene({ selectedDate }) {
  const { scene } = useGLTF('/building.glb')
  const [allEvents, setAllEvents] = useState([])

  // Fetch only once on mount
  useEffect(() => {
    fetch('/api/infected-rooms')
      .then((res) => res.json())
      .then((data) => setAllEvents(data))
      .catch((err) => console.error('Failed to load data:', err))
  }, [])

  // Apply the light gray mood with semi-transparency
  useEffect(() => {
    scene.traverse((node) => {
      if (node.isMesh) {
        node.material = new THREE.MeshStandardMaterial({
          color: '#cccccc',      // Preserves the neutral, light gray mood
          transparent: true,
          opacity: 0.3,          // Semi-transparent to see the heatmap inside
          depthWrite: true,     // Crucial for rendering transparent sprites behind transparent walls
          roughness: 1.0,        // Matte finish, prevents glossy reflections
          metalness: 0.0
        })
      }
    })
  }, [scene])

  // Instantly recompute active points when the slider or data changes
  const visibleRooms = useMemo(() => {
    const activeMap = new Map()

    for (const event of allEvents) {
      if (event.date <= selectedDate) {
        activeMap.set(event.id, event)
      }
    }

    return Array.from(activeMap.values())
  }, [allEvents, selectedDate])

  return (
    <group>
      <primitive object={scene} />
      <GasHeatmap activeRooms={visibleRooms} />
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

      <Canvas camera={{ position: [-200, 150, 150], fov: 40 }}>
        {/* Base lighting to keep shadows from being completely dark */}
        <ambientLight intensity={0.6} />
        
        {/* Main light shining from the South (+Z) */}
        <directionalLight position={[0, 20, 20]} intensity={1.5} />
        
        {/* Fill light shining from the North (-Z) to illuminate the back of the building */}
        <directionalLight position={[0, 20, -20]} intensity={0.8} />
        
        <Suspense fallback={null}>
          <BuildingScene selectedDate={selectedDate} />
        </Suspense>

        <OrbitControls makeDefault enableDamping dampingFactor={0.05} target={[-20, 10, -60]} />
      </Canvas>
    </div>
  )
}
