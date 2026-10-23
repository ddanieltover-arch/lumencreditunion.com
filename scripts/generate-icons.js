import fs from 'fs';
import zlib from 'zlib';

function createCRC32Table() {
  const table = new Uint32Array(256);
  for (let i = 0; i < 256; i++) {
    let c = i;
    for (let k = 0; k < 8; k++) {
      c = (c & 1) ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1);
    }
    table[i] = c >>> 0;
  }
  return table;
}

const crcTable = createCRC32Table();

function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) {
    c = (c >>> 8) ^ crcTable[(c ^ buf[i]) & 0xff];
  }
  return (c ^ 0xffffffff) >>> 0;
}

function makeChunk(type, data) {
  const typeBuf = Buffer.from(type, 'ascii');
  const lenBuf = Buffer.alloc(4);
  lenBuf.writeUInt32BE(data.length, 0);

  const crcBuf = Buffer.alloc(4);
  const toCrc = Buffer.concat([typeBuf, data]);
  crcBuf.writeUInt32BE(crc32(toCrc), 0);

  return Buffer.concat([lenBuf, typeBuf, data, crcBuf]);
}

function renderLumenfieldIcon(size, isMaskable = false) {
  // RGBA buffer: size x size x 4
  // Each scanline begins with a filter byte (0 = None)
  const rowBytes = 1 + size * 4;
  const rawData = Buffer.alloc(size * rowBytes);

  const cornerRadius = isMaskable ? 0 : size * 0.22;
  const cx = size / 2;
  const cy = size / 2;

  // Colors
  const bg = [0x0a, 0x3d, 0x3f, 255]; // #0A3D3F Teal
  const amber = [0xf5, 0xb9, 0x42, 255]; // #F5B942 Amber
  const midTeal = [0x0f, 0x76, 0x6e, 255]; // #0F766E Teal Mid

  for (let y = 0; y < size; y++) {
    const rowOffset = y * rowBytes;
    rawData[rowOffset] = 0; // Filter: None

    for (let x = 0; x < size; x++) {
      const pOffset = rowOffset + 1 + x * 4;

      // Rounded rect check
      let inCard = false;
      if (isMaskable) {
        inCard = true;
      } else {
        const dx = Math.max(0, Math.abs(x - cx) - (size / 2 - cornerRadius));
        const dy = Math.max(0, Math.abs(y - cy) - (size / 2 - cornerRadius));
        inCard = (dx * dx + dy * dy) <= (cornerRadius * cornerRadius);
      }

      if (!inCard) {
        rawData[pOffset] = 0;
        rawData[pOffset + 1] = 0;
        rawData[pOffset + 2] = 0;
        rawData[pOffset + 3] = 0;
        continue;
      }

      // Check for Lumenfield 'L' emblem in Amber:
      // Vertical bar: x from 0.25 to 0.38, y from 0.25 to 0.75
      // Horizontal foot: x from 0.25 to 0.72, y from 0.625 to 0.75
      const nx = x / size;
      const ny = y / size;

      const inVertBar = nx >= 0.25 && nx <= 0.38 && ny >= 0.25 && ny <= 0.75;
      const inHorizFoot = nx >= 0.25 && nx <= 0.72 && ny >= 0.625 && ny <= 0.75;
      const inL = inVertBar || inHorizFoot;

      // Sun/Gem circle at (0.70, 0.375), radius 0.095
      const cDist = Math.hypot(nx - 0.70, ny - 0.375);
      const inCircle = cDist <= 0.095;

      if (inL) {
        rawData[pOffset] = amber[0];
        rawData[pOffset + 1] = amber[1];
        rawData[pOffset + 2] = amber[2];
        rawData[pOffset + 3] = amber[3];
      } else if (inCircle) {
        rawData[pOffset] = midTeal[0];
        rawData[pOffset + 1] = midTeal[1];
        rawData[pOffset + 2] = midTeal[2];
        rawData[pOffset + 3] = midTeal[3];
      } else {
        rawData[pOffset] = bg[0];
        rawData[pOffset + 1] = bg[1];
        rawData[pOffset + 2] = bg[2];
        rawData[pOffset + 3] = bg[3];
      }
    }
  }

  // Create PNG
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

  const ihdrData = Buffer.alloc(13);
  ihdrData.writeUInt32BE(size, 0);
  ihdrData.writeUInt32BE(size, 4);
  ihdrData[8] = 8; // Bit depth: 8
  ihdrData[9] = 6; // Color type: 6 (RGBA)
  ihdrData[10] = 0; // Compression: 0
  ihdrData[11] = 0; // Filter: 0
  ihdrData[12] = 0; // Interlace: 0
  const ihdr = makeChunk('IHDR', ihdrData);

  const compressed = zlib.deflateSync(rawData);
  const idat = makeChunk('IDAT', compressed);
  const iend = makeChunk('IEND', Buffer.alloc(0));

  return Buffer.concat([signature, ihdr, idat, iend]);
}

// Write files
const icon192 = renderLumenfieldIcon(192);
const icon512 = renderLumenfieldIcon(512);
const iconMaskable = renderLumenfieldIcon(512, true);
const appleTouch = renderLumenfieldIcon(180);

fs.writeFileSync('public/icon-192.png', icon192);
fs.writeFileSync('public/icon-512.png', icon512);
fs.writeFileSync('public/icon-maskable.png', iconMaskable);
fs.writeFileSync('public/apple-touch-icon.png', appleTouch);

console.log('PWA icon assets created successfully: 192x192, 512x512, maskable, apple-touch-icon.');
