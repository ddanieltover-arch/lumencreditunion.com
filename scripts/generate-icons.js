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

/**
 * Email header mark matching LumenLogo.tsx:
 * amber circle, teal arc, teal center dot — transparent background.
 */
function paintEmailLogoMark(rawData, width, height, markX, markY, markSize) {
  const rowBytes = 1 + width * 4;
  const cx = markX + markSize / 2;
  const cy = markY + markSize / 2;
  const rOuter = markSize / 2 - 1;
  const rDot = markSize * (3 / 32);
  const stroke = Math.max(2, markSize * (2.5 / 32));

  for (let y = markY; y < markY + markSize; y++) {
    for (let x = markX; x < markX + markSize; x++) {
      const dx = x - cx + 0.5;
      const dy = y - cy + 0.5;
      const dist = Math.hypot(dx, dy);
      const pOffset = y * rowBytes + 1 + x * 4;

      let color = null;

      // Amber filled circle
      if (dist <= rOuter) {
        color = AMBER;
      }

      // Teal center dot (cy offset slightly up like viewBox cy=13 of 32)
      const dotCy = cy - markSize * (3 / 32);
      const distDot = Math.hypot(dx, y - dotCy + 0.5);
      if (distDot <= rDot) {
        color = BG;
      }

      // Teal arc: approximate path M6,22 C11,12 21,12 26,22 in 32x32 space
      if (dist <= rOuter) {
        const nx = (x - markX) / markSize;
        const ny = (y - markY) / markSize;
        // Parametric-ish arc band around y ≈ 0.55–0.72, x 0.2–0.8
        const arcY = 0.375 + 0.35 * Math.pow(2 * (nx - 0.5), 2); // parabola opening down from top
        const arcCenterY = 0.55 + 0.2 * Math.pow(2 * (nx - 0.5), 2);
        const withinX = nx >= 0.18 && nx <= 0.82;
        const distArc = Math.abs(ny - arcCenterY);
        if (withinX && distArc <= stroke / markSize / 1.2 && ny > 0.42) {
          color = BG;
        }
        void arcY;
      }

      if (color) {
        rawData[pOffset] = color[0];
        rawData[pOffset + 1] = color[1];
        rawData[pOffset + 2] = color[2];
        rawData[pOffset + 3] = color[3];
      }
    }
  }
}

/** Horizontal email lockup: mark + wordmark-friendly teal bar (PNG for email clients). */
function renderEmailLogo() {
  const width = 480;
  const height = 96;
  const rowBytes = 1 + width * 4;
  const rawData = Buffer.alloc(height * rowBytes);

  for (let y = 0; y < height; y++) {
    const rowOffset = y * rowBytes;
    rawData[rowOffset] = 0;
    for (let x = 0; x < width; x++) {
      const pOffset = rowOffset + 1 + x * 4;
      // Transparent background
      rawData[pOffset] = 0;
      rawData[pOffset + 1] = 0;
      rawData[pOffset + 2] = 0;
      rawData[pOffset + 3] = 0;
    }
  }

  const markSize = 80;
  const markX = 8;
  const markY = Math.floor((height - markSize) / 2);
  paintEmailLogoMark(rawData, width, height, markX, markY, markSize);

  // Simple “LUMENFIELD” block letters to the right of the mark (pixel font)
  const textStartX = markX + markSize + 16;
  const textBaseline = Math.floor(height / 2) - 10;
  const letterW = 10;
  const letterH = 14;
  const gap = 4;
  const glyphs = {
    L: [[0, 0, 3, 14], [0, 11, 10, 3]],
    U: [[0, 0, 3, 11], [7, 0, 3, 11], [0, 11, 10, 3]],
    M: [[0, 0, 3, 14], [7, 0, 3, 14], [2, 0, 3, 5], [5, 0, 3, 5]],
    E: [[0, 0, 3, 14], [0, 0, 10, 3], [0, 5.5, 8, 3], [0, 11, 10, 3]],
    N: [[0, 0, 3, 14], [7, 0, 3, 14], [2, 2, 3, 5], [5, 7, 3, 5]],
    F: [[0, 0, 3, 14], [0, 0, 10, 3], [0, 5.5, 8, 3]],
    I: [[3.5, 0, 3, 14]],
    D: [[0, 0, 3, 14], [0, 0, 7, 3], [0, 11, 7, 3], [6, 2, 3, 10]],
  };
  const word = 'LUMENFIELD';
  word.split('').forEach((ch, i) => {
    const rects = glyphs[ch] || [];
    const ox = textStartX + i * (letterW + gap);
    for (const [rx, ry, rw, rh] of rects) {
      const x0 = Math.floor(ox + rx);
      const y0 = Math.floor(textBaseline + ry);
      const x1 = Math.ceil(ox + rx + rw);
      const y1 = Math.ceil(textBaseline + ry + rh);
      for (let y = y0; y < y1; y++) {
        for (let x = x0; x < x1; x++) {
          if (x < 0 || y < 0 || x >= width || y >= height) continue;
          const pOffset = y * rowBytes + 1 + x * 4;
          rawData[pOffset] = BG[0];
          rawData[pOffset + 1] = BG[1];
          rawData[pOffset + 2] = BG[2];
          rawData[pOffset + 3] = BG[3];
        }
      }
    }
  });

  // Sub-label
  const sub = 'CREDIT UNION';
  const subY = textBaseline + letterH + 8;
  const subLetterW = 6;
  const subGap = 2;
  const subGlyphs = {
    C: [[0, 0, 2, 8], [0, 0, 6, 2], [0, 6, 6, 2]],
    R: [[0, 0, 2, 8], [0, 0, 5, 2], [0, 3, 5, 2], [4, 2, 2, 2], [3, 5, 3, 3]],
    E: [[0, 0, 2, 8], [0, 0, 6, 2], [0, 3, 5, 2], [0, 6, 6, 2]],
    D: [[0, 0, 2, 8], [0, 0, 4, 2], [0, 6, 4, 2], [4, 1, 2, 6]],
    I: [[2, 0, 2, 8]],
    T: [[0, 0, 6, 2], [2, 0, 2, 8]],
    ' ': [],
    U: [[0, 0, 2, 6], [4, 0, 2, 6], [0, 6, 6, 2]],
    N: [[0, 0, 2, 8], [4, 0, 2, 8], [1, 2, 2, 3], [3, 3, 2, 3]],
    O: [[0, 0, 2, 8], [4, 0, 2, 8], [0, 0, 6, 2], [0, 6, 6, 2]],
  };
  sub.split('').forEach((ch, i) => {
    const rects = subGlyphs[ch] || [];
    const ox = textStartX + i * (subLetterW + subGap);
    for (const [rx, ry, rw, rh] of rects) {
      const x0 = Math.floor(ox + rx);
      const y0 = Math.floor(subY + ry);
      const x1 = Math.ceil(ox + rx + rw);
      const y1 = Math.ceil(subY + ry + rh);
      for (let y = y0; y < y1; y++) {
        for (let x = x0; x < x1; x++) {
          if (x < 0 || y < 0 || x >= width || y >= height) continue;
          const pOffset = y * rowBytes + 1 + x * 4;
          rawData[pOffset] = MID_TEAL[0];
          rawData[pOffset + 1] = MID_TEAL[1];
          rawData[pOffset + 2] = MID_TEAL[2];
          rawData[pOffset + 3] = MID_TEAL[3];
        }
      }
    }
  });

  return encodePng(width, height, rawData);
}

/** Square mark-only for compact email clients / favicon-style headers */
function renderEmailMark() {
  const size = 128;
  const rowBytes = 1 + size * 4;
  const rawData = Buffer.alloc(size * rowBytes);
  for (let y = 0; y < size; y++) {
    rawData[y * rowBytes] = 0;
    for (let x = 0; x < size; x++) {
      const pOffset = y * rowBytes + 1 + x * 4;
      rawData[pOffset] = 0;
      rawData[pOffset + 1] = 0;
      rawData[pOffset + 2] = 0;
      rawData[pOffset + 3] = 0;
    }
  }
  paintEmailLogoMark(rawData, size, size, 0, 0, size);
  return encodePng(size, size, rawData);
}

// Write files
const icon192 = renderLumenfieldIcon(192);
const icon512 = renderLumenfieldIcon(512);
const iconMaskable = renderLumenfieldIcon(512, true);
const appleTouch = renderLumenfieldIcon(180);
const ogImage = renderOgImage();
const emailLogo = renderEmailLogo();
const emailMark = renderEmailMark();

fs.writeFileSync('public/icon-192.png', icon192);
fs.writeFileSync('public/icon-512.png', icon512);
fs.writeFileSync('public/icon-maskable.png', iconMaskable);
fs.writeFileSync('public/apple-touch-icon.png', appleTouch);
fs.writeFileSync('public/og-image.png', ogImage);

fs.mkdirSync('public/email', { recursive: true });
fs.writeFileSync('public/email/lumenfield-logo.png', emailLogo);
fs.writeFileSync('public/email/lumenfield-mark.png', emailMark);

console.log(
  'PWA icon assets created successfully: 192x192, 512x512, maskable, apple-touch-icon, og-image 1200x630, email logo + mark.',
);