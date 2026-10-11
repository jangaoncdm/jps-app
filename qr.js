/* JPS qr.js — a byte-mode QR encoder, ECC level M, versions 1 to 10.
 *
 * Written out rather than pulled in because the client takes no dependencies
 * (CLAUDE.md invariant 9) and has no build step. ES5-flavoured for old Android
 * WebViews. Output is an SVG string, so it prints at the printer's resolution
 * instead of a canvas bitmap, and needs no canvas API at all.
 *
 * Only what the prescription needs: byte mode, one ECC level, enough capacity for
 * a verification URL (version 5 holds 86 data codewords, the URL needs about 75).
 *
 * qrSvg(text, opts) -> '<svg ...>'   opts: { size, margin, cls }
 */

/* ---------------------------------------------------------------- tables (ECC M) */
/* per version: total data codewords, EC codewords per block, block layout */
var QR_M = [
  null,
  { data: 16,  ec: 10, blocks: [[1, 16]] },
  { data: 28,  ec: 16, blocks: [[1, 28]] },
  { data: 44,  ec: 26, blocks: [[1, 44]] },
  { data: 64,  ec: 18, blocks: [[2, 32]] },
  { data: 86,  ec: 24, blocks: [[2, 43]] },
  { data: 108, ec: 16, blocks: [[4, 27]] },
  { data: 124, ec: 18, blocks: [[4, 31]] },
  { data: 154, ec: 22, blocks: [[2, 38], [2, 39]] },
  { data: 182, ec: 22, blocks: [[3, 36], [2, 37]] },
  { data: 216, ec: 26, blocks: [[4, 43], [1, 44]] }
];
var QR_ALIGN = [null, [], [6, 18], [6, 22], [6, 26], [6, 30], [6, 34],
                [6, 22, 38], [6, 24, 42], [6, 26, 46], [6, 28, 50]];

/* ---------------------------------------------------------------- GF(256) */
var QR_EXP = new Array(512), QR_LOG = new Array(256);
(function () {
  var x = 1;
  for (var i = 0; i < 255; i++) {
    QR_EXP[i] = x; QR_LOG[x] = i;
    x <<= 1;
    if (x & 0x100) x ^= 0x11d;           // the QR primitive polynomial
  }
  for (var j = 255; j < 512; j++) QR_EXP[j] = QR_EXP[j - 255];
})();
function qrMul(a, b) { return (a === 0 || b === 0) ? 0 : QR_EXP[QR_LOG[a] + QR_LOG[b]]; }

/** Reed-Solomon generator polynomial of the given degree. */
function qrGenPoly(deg) {
  var p = [1];
  for (var i = 0; i < deg; i++) {
    var np = new Array(p.length + 1);
    for (var k = 0; k < np.length; k++) np[k] = 0;
    for (var j = 0; j < p.length; j++) {
      np[j] ^= qrMul(p[j], QR_EXP[i]);
      np[j + 1] ^= p[j];
    }
    p = np;
  }
  return p.reverse();   // leading coefficient first, which is what qrEcc expects
}

/** EC codewords for one data block. */
function qrEcc(data, ecLen) {
  var gen = qrGenPoly(ecLen);
  var rem = new Array(ecLen);
  for (var i = 0; i < ecLen; i++) rem[i] = 0;
  for (var d = 0; d < data.length; d++) {
    var factor = data[d] ^ rem[0];
    rem.shift();
    rem.push(0);
    for (var g = 0; g < gen.length - 1; g++) rem[g] ^= qrMul(gen[g + 1], factor);
  }
  return rem;
}

/* ---------------------------------------------------------------- encoding */
function qrBytes(text) {
  // UTF-8, so a Telugu or a plain ASCII payload both encode correctly
  var out = [], i, c;
  for (i = 0; i < text.length; i++) {
    c = text.charCodeAt(i);
    if (c < 0x80) out.push(c);
    else if (c < 0x800) { out.push(0xc0 | (c >> 6), 0x80 | (c & 63)); }
    else if (c < 0xd800 || c >= 0xe000) {
      out.push(0xe0 | (c >> 12), 0x80 | ((c >> 6) & 63), 0x80 | (c & 63));
    } else {
      i++;
      var cp = 0x10000 + (((c & 0x3ff) << 10) | (text.charCodeAt(i) & 0x3ff));
      out.push(0xf0 | (cp >> 18), 0x80 | ((cp >> 12) & 63),
               0x80 | ((cp >> 6) & 63), 0x80 | (cp & 63));
    }
  }
  return out;
}

function qrPickVersion(byteLen) {
  for (var v = 1; v <= 10; v++) {
    var countBits = v < 10 ? 8 : 16;
    var need = 4 + countBits + byteLen * 8;
    if (QR_M[v].data * 8 >= need) return v;
  }
  return 0;
}

function qrDataCodewords(bytes, version) {
  var spec = QR_M[version];
  var countBits = version < 10 ? 8 : 16;
  var bits = [];
  var push = function (val, len) {
    for (var i = len - 1; i >= 0; i--) bits.push((val >> i) & 1);
  };
  push(4, 4);                       // byte mode
  push(bytes.length, countBits);
  for (var i = 0; i < bytes.length; i++) push(bytes[i], 8);
  var cap = spec.data * 8;
  for (var t = 0; t < 4 && bits.length < cap; t++) bits.push(0);   // terminator
  while (bits.length % 8) bits.push(0);
  var cw = [];
  for (var b = 0; b < bits.length; b += 8) {
    var v = 0;
    for (var k = 0; k < 8; k++) v = (v << 1) | bits[b + k];
    cw.push(v);
  }
  var pad = [0xec, 0x11], pi = 0;
  while (cw.length < spec.data) { cw.push(pad[pi % 2]); pi++; }
  return cw;
}

/** Split into blocks, append EC, then interleave as the standard requires. */
function qrInterleave(cw, version) {
  var spec = QR_M[version];
  var blocks = [], ecs = [], at = 0, i, j;
  for (i = 0; i < spec.blocks.length; i++) {
    for (j = 0; j < spec.blocks[i][0]; j++) {
      var len = spec.blocks[i][1];
      var blk = cw.slice(at, at + len);
      at += len;
      blocks.push(blk);
      ecs.push(qrEcc(blk, spec.ec));
    }
  }
  var out = [], maxData = 0;
  for (i = 0; i < blocks.length; i++) maxData = Math.max(maxData, blocks[i].length);
  for (i = 0; i < maxData; i++) {
    for (j = 0; j < blocks.length; j++) if (i < blocks[j].length) out.push(blocks[j][i]);
  }
  for (i = 0; i < spec.ec; i++) {
    for (j = 0; j < ecs.length; j++) out.push(ecs[j][i]);
  }
  return out;
}

/* ---------------------------------------------------------------- matrix */
function qrMatrix(version) {
  var n = version * 4 + 17, m = [], res = [], i, j;
  for (i = 0; i < n; i++) {
    m.push([]); res.push([]);
    for (j = 0; j < n; j++) { m[i].push(0); res[i].push(0); }
  }
  var set = function (r, c, v) { m[r][c] = v; res[r][c] = 1; };

  var finder = function (r0, c0) {
    for (var r = -1; r <= 7; r++) for (var c = -1; c <= 7; c++) {
      var rr = r0 + r, cc = c0 + c;
      if (rr < 0 || cc < 0 || rr >= n || cc >= n) continue;
      var on = (r >= 0 && r <= 6 && (c === 0 || c === 6)) ||
               (c >= 0 && c <= 6 && (r === 0 || r === 6)) ||
               (r >= 2 && r <= 4 && c >= 2 && c <= 4);
      set(rr, cc, on ? 1 : 0);
    }
  };
  finder(0, 0); finder(0, n - 7); finder(n - 7, 0);

  for (i = 8; i < n - 8; i++) {                 // timing
    var t = i % 2 === 0 ? 1 : 0;
    set(6, i, t); set(i, 6, t);
  }

  var ac = QR_ALIGN[version];
  for (i = 0; i < ac.length; i++) for (j = 0; j < ac.length; j++) {
    var ar = ac[i], acl = ac[j];
    if ((ar <= 7 && acl <= 7) || (ar <= 7 && acl >= n - 8) || (ar >= n - 8 && acl <= 7)) continue;
    for (var dr = -2; dr <= 2; dr++) for (var dc = -2; dc <= 2; dc++) {
      var on2 = Math.max(Math.abs(dr), Math.abs(dc)) !== 1;
      set(ar + dr, acl + dc, on2 ? 1 : 0);
    }
  }

  set(n - 8, 8, 1);                              // the always-dark module
  for (i = 0; i <= 8; i++) {                     // reserve format areas
    if (!res[8][i]) set(8, i, 0);
    if (!res[i][8]) set(i, 8, 0);
  }
  for (i = 0; i < 8; i++) {
    if (!res[8][n - 1 - i]) set(8, n - 1 - i, 0);
    if (!res[n - 1 - i][8]) set(n - 1 - i, 8, 0);
  }
  if (version >= 7) {                            // reserve version areas
    for (i = 0; i < 6; i++) for (j = 0; j < 3; j++) {
      set(n - 11 + j, i, 0); set(i, n - 11 + j, 0);
    }
  }
  return { m: m, res: res, n: n };
}

function qrPlace(grid, cw) {
  var m = grid.m, res = grid.res, n = grid.n;
  var bitAt = function (k) { return (cw[k >> 3] >> (7 - (k & 7))) & 1; };
  var total = cw.length * 8, k = 0, up = true;
  for (var col = n - 1; col > 0; col -= 2) {
    if (col === 6) col--;                        // skip the vertical timing column
    for (var step = 0; step < n; step++) {
      var row = up ? n - 1 - step : step;
      for (var c = 0; c < 2; c++) {
        var cc = col - c;
        if (res[row][cc]) continue;
        m[row][cc] = k < total ? bitAt(k) : 0;
        k++;
      }
    }
    up = !up;
  }
}

function qrMaskFn(id) {
  return [
    function (i, j) { return (i + j) % 2 === 0; },
    function (i) { return i % 2 === 0; },
    function (i, j) { return j % 3 === 0; },
    function (i, j) { return (i + j) % 3 === 0; },
    function (i, j) { return (Math.floor(i / 2) + Math.floor(j / 3)) % 2 === 0; },
    function (i, j) { return ((i * j) % 2) + ((i * j) % 3) === 0; },
    function (i, j) { return (((i * j) % 2) + ((i * j) % 3)) % 2 === 0; },
    function (i, j) { return (((i + j) % 2) + ((i * j) % 3)) % 2 === 0; }
  ][id];
}

function qrFormatBits(mask) {
  // ECC level M is 00; BCH(15,5) with generator 0x537, then the standard XOR mask
  var data = (0 << 3) | mask;
  var v = data << 10;
  for (var i = 4; i >= 0; i--) if (v & (1 << (i + 10))) v ^= 0x537 << i;
  return ((data << 10) | v) ^ 0x5412;
}

function qrVersionBits(version) {
  var v = version << 12;
  for (var i = 5; i >= 0; i--) if (v & (1 << (i + 12))) v ^= 0x1f25 << i;
  return (version << 12) | v;
}

function qrApply(grid, mask) {
  var n = grid.n, out = [], i, j;
  var fn = qrMaskFn(mask);
  for (i = 0; i < n; i++) {
    out.push([]);
    for (j = 0; j < n; j++) {
      out[i].push(grid.res[i][j] ? grid.m[i][j]
                                 : (grid.m[i][j] ^ (fn(i, j) ? 1 : 0)));
    }
  }
  // format information, written into both copies
  var f = qrFormatBits(mask);
  for (i = 0; i <= 5; i++) out[8][i] = (f >> (14 - i)) & 1;
  out[8][7] = (f >> 8) & 1;
  out[8][8] = (f >> 7) & 1;
  out[7][8] = (f >> 6) & 1;
  for (i = 9; i <= 14; i++) out[14 - i][8] = (f >> (14 - i)) & 1;
  for (i = 0; i <= 7; i++) out[n - 1 - i][8] = (f >> i) & 1;
  for (i = 7; i <= 14; i++) out[8][n - 15 + i] = (f >> i) & 1;
  out[n - 8][8] = 1;
  if (grid.version >= 7) {
    var vb = qrVersionBits(grid.version);
    for (i = 0; i < 18; i++) {
      var b = (vb >> i) & 1, r = Math.floor(i / 3), c = i % 3;
      out[n - 11 + c][r] = b;
      out[r][n - 11 + c] = b;
    }
  }
  return out;
}

function qrPenalty(m) {
  var n = m.length, score = 0, i, j, run, dark = 0;
  for (i = 0; i < n; i++) {
    run = 1;
    for (j = 1; j < n; j++) {
      if (m[i][j] === m[i][j - 1]) { run++; } else { if (run >= 5) score += run - 2; run = 1; }
    }
    if (run >= 5) score += run - 2;
  }
  for (j = 0; j < n; j++) {
    run = 1;
    for (i = 1; i < n; i++) {
      if (m[i][j] === m[i - 1][j]) { run++; } else { if (run >= 5) score += run - 2; run = 1; }
    }
    if (run >= 5) score += run - 2;
  }
  for (i = 0; i < n - 1; i++) for (j = 0; j < n - 1; j++) {
    var a = m[i][j];
    if (a === m[i][j + 1] && a === m[i + 1][j] && a === m[i + 1][j + 1]) score += 3;
  }
  var pat1 = [1, 0, 1, 1, 1, 0, 1, 0, 0, 0, 0], pat2 = [0, 0, 0, 0, 1, 0, 1, 1, 1, 0, 1];
  var hit = function (get) {
    var s = 0;
    for (var a = 0; a < n; a++) for (var b = 0; b + 11 <= n; b++) {
      var ok1 = true, ok2 = true;
      for (var k = 0; k < 11; k++) {
        var v = get(a, b + k);
        if (v !== pat1[k]) ok1 = false;
        if (v !== pat2[k]) ok2 = false;
      }
      if (ok1 || ok2) s += 40;
    }
    return s;
  };
  score += hit(function (a, b) { return m[a][b]; });
  score += hit(function (a, b) { return m[b][a]; });
  for (i = 0; i < n; i++) for (j = 0; j < n; j++) if (m[i][j]) dark++;
  var pct = (dark * 100) / (n * n);
  score += Math.floor(Math.abs(pct - 50) / 5) * 10;
  return score;
}

/** text -> boolean matrix, best mask chosen by the standard penalty rules. */
function qrEncode(text) {
  var bytes = qrBytes(String(text));
  var version = qrPickVersion(bytes.length);
  if (!version) return null;                       // too long for version 10 at ECC M
  var cw = qrInterleave(qrDataCodewords(bytes, version), version);
  var grid = qrMatrix(version);
  grid.version = version;
  qrPlace(grid, cw);
  var best = null, bestScore = Infinity;
  for (var mask = 0; mask < 8; mask++) {
    var cand = qrApply(grid, mask);
    var sc = qrPenalty(cand);
    if (sc < bestScore) { bestScore = sc; best = cand; }
  }
  return best;
}

/** An SVG square, so it prints at printer resolution rather than screen pixels. */
function qrSvg(text, opts) {
  opts = opts || {};
  var m = qrEncode(text);
  if (!m) return '';
  // 4 modules is the quiet zone the standard requires; at 2 a phone camera and a
  // desktop decoder both fail to find the symbol
  var n = m.length, margin = opts.margin == null ? 4 : opts.margin;
  var span = n + margin * 2;
  var d = [];
  for (var i = 0; i < n; i++) {
    for (var j = 0; j < n; j++) {
      if (m[i][j]) d.push('M' + (j + margin) + ' ' + (i + margin) + 'h1v1h-1z');
    }
  }
  return '<svg class="' + (opts.cls || 'qr') + '" width="' + (opts.size || 96) +
    '" height="' + (opts.size || 96) + '" viewBox="0 0 ' + span + ' ' + span +
    '" shape-rendering="crispEdges" role="img" aria-label="QR code">' +
    '<rect width="' + span + '" height="' + span + '" fill="#fff"/>' +
    '<path fill="#000" d="' + d.join('') + '"/></svg>';
}
