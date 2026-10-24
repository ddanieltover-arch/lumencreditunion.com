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

const BG = [0x0a, 0x3d, 0x3f, 255]; // #0A3D3F Teal
const AMBER = [0xf5, 0xb9, 0x42, 255]; // #F5B942 Amber
const MID_TEAL = [0x0f, 0x76, 0x6e, 255]; // #0F766E Teal Mid

function encodePng(width, height, rawData) {
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

  const ihdrData = Buffer.alloc(13);
  ihdrData.writeUInt32BE(width, 0);
  ihdrData.writeUInt32BE(height, 4);
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

function paintEmblem(rawData, width, height, markX, markY, markSize) {
  const rowBytes = 1 + width * 4;

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (x < markX || y < markY || x >= markX + markSize || y >= markY + markSize) {
        continue;
      }

      const lx = x - markX;
      const ly = y - markY;
      const nx = lx / markSize;
      const ny = ly / markSize;

      const inVertBar = nx >= 0.25 && nx <= 0.38 && ny >= 0.25 && ny <= 0.75;
      const inHorizFoot = nx >= 0.25 && nx <= 0.72 && ny >= 0.625 && ny <= 0.75;
      const inL = inVertBar || inHorizFoot;

      const cDist = Math.hypot(nx - 0.70, ny - 0.375);
      const inCircle = cDist <= 0.095;

      if (!inL && !inCircle) continue;

      const pOffset = y * rowBytes + 1 + x * 4;
      const color = inL ? AMBER : MID_TEAL;
      rawData[pOffset] = color[0];
      rawData[pOffset + 1] = color[1];
      rawData[pOffset + 2] = color[2];
      rawData[pOffset + 3] = color[3];
    }
  }
}

function renderLumenfieldIcon(size, isMaskable = false) {
  // RGBA buffer: size x size x 4
  // Each scanline begins with a filter byte (0 = None)
  const rowBytes = 1 + size * 4;
  const rawData = Buffer.alloc(size * rowBytes);

  const cornerRadius = isMaskable ? 0 : size * 0.22;
  const cx = size / 2;
  const cy = size / 2;

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

      rawData[pOffset] = BG[0];
      rawData[pOffset + 1] = BG[1];
      rawData[pOffset + 2] = BG[2];
      rawData[pOffset + 3] = BG[3];
    }
  }

  paintEmblem(rawData, size, size, 0, 0, size);
  return encodePng(size, size, rawData);
}

/** 1200x630 OG image: brand teal field with the icon mark cropped/centered. */
function renderOgImage() {
  const width = 1200;
  const height = 630;
  const rowBytes = 1 + width * 4;
  const rawData = Buffer.alloc(height * rowBytes);

  for (let y = 0; y < height; y++) {
    const rowOffset = y * rowBytes;
    rawData[rowOffset] = 0;
    for (let x = 0; x < width; x++) {
      const pOffset = rowOffset + 1 + x * 4;
      rawData[pOffset] = BG[0];
      rawData[pOffset + 1] = BG[1];
      rawData[pOffset + 2] = BG[2];
      rawData[pOffset + 3] = BG[3];
    }
  }

  // Crop the square icon into the landscape frame: large centered mark
  const markSize = Math.floor(height * 0.72);
  const markX = Math.floor((width - markSize) / 2);
  const markY = Math.floor((height - markSize) / 2);
  paintEmblem(rawData, width, height, markX, markY, markSize);

  return encodePng(width, height, rawData);
}

// Write files
const icon192 = renderLumenfieldIcon(192);
const icon512 = renderLumenfieldIcon(512);
const iconMaskable = renderLumenfieldIcon(512, true);
const appleTouch = renderLumenfieldIcon(180);
const ogImage = renderOgImage();

fs.writeFileSync('public/icon-192.png', icon192);
fs.writeFileSync('public/icon-512.png', icon512);
fs.writeFileSync('public/icon-maskable.png', iconMaskable);
fs.writeFileSync('public/apple-touch-icon.png', appleTouch);
fs.writeFileSync('public/og-image.png', ogImage);

console.log('PWA icon assets created successfully: 192x192, 512x512, maskable, apple-touch-icon, og-image 1200x630.');
