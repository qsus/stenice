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

  const BoriginX = -44, BoriginY = 70; // from blender origins
  const floorHeight = 0.17*16; // stair height times their count per floor
  const blockWidth = 23, roomWidth = 3.75;

  let x = 0, y = 0, z = 0;

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
    z += BoriginY;
  }

  y = (1.5 + floor) * floorHeight; // skip 0. double-floor and put the pointer inside the middle  

  return [x, y, -z]
}

function roomApiPlugin() {
  return {
    name: 'room-api-plugin',
    configureServer(server) {
      server.middlewares.use('/api/infected-rooms', (req, res) => {
        try {
          const filePath = path.resolve(__dirname, 'server/status.txt')
          
          if (!fs.existsSync(filePath)) {
            res.setHeader('Content-Type', 'application/json')
            return res.end(JSON.stringify([]))
          }

          const text = fs.readFileSync(filePath, 'utf-8')
          
          const allEvents = []
          let currentFileDate = '2026-01-01' // Default fallback if file doesn't start with a date
          
          const lines = text.split(/\r?\n/)

          for (const line of lines) {
            const trimmed = line.trim()
            
            // 1. Ignore empty lines and comments
            if (!trimmed || trimmed.startsWith('#')) continue
            
            // 2. Check for date headers (e.g. 2026-01-01)
            const dateMatch = trimmed.match(/^(\d{4}-\d{2}-\d{2})/)
            if (dateMatch) {
              currentFileDate = dateMatch[1]
              continue 
            }

            // 3. Split by whitespace into room name and status
            const parts = trimmed.split(/\s+/)
            if (parts.length < 2) continue

            const rawRoom = parts[0]
            const rawStatus = parts[1].toLowerCase()
            const cleanRoom = rawRoom.replace(/-/g, '').toUpperCase()

            // 4. Push EVERY valid event to the array, carrying the current date
            if (['infected', 'quarantine', 'disinfected'].includes(rawStatus)) {
              allEvents.push({
                id: cleanRoom,
                position: getRoomCoordinates(cleanRoom),
                status: rawStatus,
                date: currentFileDate
              })
            }
          }

          res.setHeader('Content-Type', 'application/json')
          res.end(JSON.stringify(allEvents)) // Send the full timeline
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
