import { useState, useEffect, Suspense } from 'react'
import { Canvas } from '@react-three/fiber'
import { useGLTF, OrbitControls, Html } from '@react-three/drei'

// 1. Konfigurace stylů pro všechny tři stavy (včetně disinfected)
const STATUS_CONFIG = {
  infected: { color: 'white', bg: '#ef4444', label: 'Infected' },
  quarantine: { color: 'white', bg: '#f59e0b', label: 'Quarantine' },
  disinfected: { color: 'white', bg: '#22c55e', label: 'Disinfected' },
}

function BuildingScene() {
  const { scene } = useGLTF('/building.glb')
  const [rooms, setRooms] = useState([])

  useEffect(() => {
    // Načte vypočítaná data z našeho Vite pluginu
    fetch('/api/infected-rooms')
      .then((res) => res.json())
      .then((data) => setRooms(data))
      .catch((err) => console.error('Failed to load coordinates:', err))
  }, [])

  return (
    <group>
      {/* 3D Budova */}
      <primitive object={scene} />

      {/* HTML štítky nad místnostmi */}
      {rooms.map((room) => {
        // Fallback pro jistotu
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
              pointerEvents: 'none', // Umožní prokliknout štítek pro rotaci modelu
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
  return (
    <div style={{ position: 'absolute', top: 0, left: 0, width: '100vw', height: '100vh', background: '#1a1a1a', overflow: 'hidden' }}>
      <Canvas camera={{ position: [8, 8, 8], fov: 45 }}>
        <ambientLight intensity={0.6} />
        <directionalLight position={[10, 20, 10]} intensity={1.5} />
        
        <Suspense fallback={
          <mesh>
            <boxGeometry args={[1, 1, 1]} />
            <meshStandardMaterial color="orange" />
            <Html center>
              <div style={{ color: 'white', fontFamily: 'sans-serif', marginTop: '50px', whiteSpace: 'nowrap' }}>
                Načítám 3D model...
              </div>
            </Html>
          </mesh>
        }>
          <BuildingScene />
        </Suspense>

        <OrbitControls makeDefault enableDamping dampingFactor={0.05} />
      </Canvas>
    </div>
  )
}
