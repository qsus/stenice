// server/api.js
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const STATUS_FILE = path.join(__dirname, 'status.txt');
const PORT = process.env.PORT || 3001;

function getRoomCoordinates(roomName) {
  roomName = roomName.replace('-', '');

  const building = roomName[0];
  const floor = Number(roomName.slice(1, -2));
  const room = Number(roomName.slice(-2));

  const BoriginX = -44, BoriginY = 70;
  const floorHeight = 0.17 * 16;
  const blockWidth = 23, roomWidth = 3.75;

  const buildingRowRooms = building === 'A' ? 12 : 8;
  const isOnEast = room > buildingRowRooms;
  const nthFromSouthZeroIndexed = (buildingRowRooms - 1) - ((room - 1) % buildingRowRooms);

  let z = (nthFromSouthZeroIndexed + 0.5) * roomWidth;
  let x = isOnEast ? (3 / 4) * blockWidth : (1 / 4) * blockWidth;

  if (building === 'B') {
    x += BoriginX;
    z += BoriginY;
  }

  const y = (1.5 + floor) * floorHeight;
  return [x, y, -z];
}

function parseStatusFile() {
  if (!fs.existsSync(STATUS_FILE)) return [];

  const text = fs.readFileSync(STATUS_FILE, 'utf-8');
  const allEvents = [];
  let currentFileDate = '2026-01-01';

  for (const line of text.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;

    const dateMatch = trimmed.match(/^(\d{4}-\d{2}-\d{2})/);
    if (dateMatch) {
      currentFileDate = dateMatch[1];
      continue;
    }

    const parts = trimmed.split(/\s+/);
    if (parts.length < 2) continue;

    const cleanRoom = parts[0].replace(/-/g, '').toUpperCase();
    const rawStatus = parts[1].toLowerCase();

    if (['infected', 'quarantine', 'disinfected'].includes(rawStatus)) {
      allEvents.push({
        id: cleanRoom,
        position: getRoomCoordinates(cleanRoom),
        status: rawStatus,
        date: currentFileDate,
      });
    }
  }

  return allEvents;
}

const server = http.createServer((req, res) => {
  if (req.url === '/api/infected-rooms' && req.method === 'GET') {
    try {
      const data = parseStatusFile();
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(data));
    } catch (err) {
      console.error('API Error:', err);
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Failed to read room status file' }));
    }
    return;
  }

  res.writeHead(404, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ error: 'Not found' }));
});

server.listen(PORT, '127.0.0.1', () => {
  console.log(`Room API listening on http://127.0.0.1:${PORT}`);
});
