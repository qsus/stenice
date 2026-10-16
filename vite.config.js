import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import fs from 'fs'
import path from 'path'

// Server-side coordinate mapping
function getRoomCoordinates(roomName) {
  roomName = roomName.replace('-', '');

  const building = roomName[0];
  const floor = Number(roomName.slice(1, -2));
  const room = Number(roomName.slice(-2));

  const Ay = 45, blockWidth = 23, By = 31;
  const BoriginX = -20 - blockWidth, BoriginY = 26 + Ay;
  const floorY = 0.17*16; // stair height times their count per floor
  const roomWidth = 3.875;

  // Generate random coordinates spread across a 10x10x10 area for testing
  let x = 0;
  let y = 0;
  let z = 0;


  // determine east/west location and calculate number of rooms from south
  const buildingRowRooms = building === 'A' ? 12 : 8; // TODO: verify for A
  const isOnEast = (room > buildingRowRooms);
  const nthFromSouthZeroIndexed = (buildingRowRooms - 1) - (room - 1) % buildingRowRooms;

  z = (nthFromSouthZeroIndexed + 0.5) * roomWidth;
  console.log(roomName, z);

  x = isOnEast ? 3/4 * blockWidth : 1/4 * blockWidth;

  // move to building B origin
  if (building === 'B') {
    x += BoriginX;
    z += BoriginY; // I don't get why this should be negative
  }

  y = (2.5 + floor) * floorY; // skip 0. and 1. floor and put the pointer inside the middle  

  return [x, y, -z]
}

function roomApiPlugin() {
  return {
    name: 'room-api-plugin',
    configureServer(server) {
      server.middlewares.use('/api/infected-rooms', (req, res) => {
        try {
          const filePath = path.resolve(__dirname, 'server/status.txt')
          
          // Return an empty array safely if the file doesn't exist yet
          if (!fs.existsSync(filePath)) {
            res.setHeader('Content-Type', 'application/json')
            return res.end(JSON.stringify([]))
          }

          const text = fs.readFileSync(filePath, 'utf-8')

          // Using a Map guarantees we only keep the latest status per room ID
          const latestRoomsMap = new Map()
          const lines = text.split(/\r?\n/)

          for (const line of lines) {
            const trimmed = line.trim()
            
            // 1. Ignore empty lines and comments
            if (!trimmed || trimmed.startsWith('#')) continue
            
            // 2. Ignore date headers (e.g. 2026-01-01)
            if (/^\d{4}-\d{2}-\d{2}/.test(trimmed)) continue

            // 3. Split by whitespace into room name and status
            const parts = trimmed.split(/\s+/)
            if (parts.length < 2) continue

            const rawRoom = parts[0]
            const rawStatus = parts[1].toLowerCase()

            // Remove hyphens (e.g. B-106 -> B106)
            const cleanRoom = rawRoom.replace(/-/g, '').toUpperCase()

            // 4. Store the state - allowing infected, quarantine, and disinfected
            if (['infected', 'quarantine', 'disinfected'].includes(rawStatus)) {
              latestRoomsMap.set(cleanRoom, {
                id: cleanRoom,
                position: getRoomCoordinates(cleanRoom),
                status: rawStatus
              })
            }
          }

          // Convert the Map values to a clean array for JSON
          const roomsData = Array.from(latestRoomsMap.values())

          res.setHeader('Content-Type', 'application/json')
          res.end(JSON.stringify(roomsData))
        } catch (error) {
          console.error("API Error:", error)
          res.statusCode = 500
          res.end(JSON.stringify({ error: 'Failed to read room status file' }))
        }
      })
    }
  }
}

export default defineConfig({
  plugins: [react(), roomApiPlugin()],
})
