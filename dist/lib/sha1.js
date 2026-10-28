// SHA-1 of a string (UTF-8) as lowercase hex, in plain JS: emit-html.ts names an HTML figure after a hash of its content, and node:crypto is not
// there in a browser. Not for security: the digest only has to be the same on every runtime (test/sha1.test.ts pins it against node:crypto).
const rotl = (x, n) => (x << n) | (x >>> (32 - n));
export function sha1Hex(text) {
    const msg = new TextEncoder().encode(text);
    const words = new Uint32Array((((msg.length + 8) >> 6) + 1) * 16);
    for (let i = 0; i < msg.length; i++)
        words[i >> 2] = (words[i >> 2] ?? 0) | ((msg[i] ?? 0) << (24 - (i % 4) * 8));
    words[msg.length >> 2] = (words[msg.length >> 2] ?? 0) | (0x80 << (24 - (msg.length % 4) * 8));
    words[words.length - 1] = (msg.length * 8) >>> 0;
    words[words.length - 2] = Math.floor(msg.length / 0x20000000);
    let h0 = 0x67452301, h1 = 0xefcdab89, h2 = 0x98badcfe, h3 = 0x10325476, h4 = 0xc3d2e1f0;
    const w = new Int32Array(80);
    for (let off = 0; off < words.length; off += 16) {
        for (let i = 0; i < 16; i++)
            w[i] = words[off + i] ?? 0;
        for (let i = 16; i < 80; i++)
            w[i] = rotl((w[i - 3] ?? 0) ^ (w[i - 8] ?? 0) ^ (w[i - 14] ?? 0) ^ (w[i - 16] ?? 0), 1);
        let a = h0, b = h1, c = h2, d = h3, e = h4;
        for (let i = 0; i < 80; i++) {
            const [f, k] = i < 20 ? [(b & c) | (~b & d), 0x5a827999] : i < 40 ? [b ^ c ^ d, 0x6ed9eba1] : i < 60 ? [(b & c) | (b & d) | (c & d), 0x8f1bbcdc] : [b ^ c ^ d, 0xca62c1d6];
            const t = (rotl(a, 5) + f + e + k + (w[i] ?? 0)) | 0;
            e = d;
            d = c;
            c = rotl(b, 30);
            b = a;
            a = t;
        }
        h0 = (h0 + a) | 0;
        h1 = (h1 + b) | 0;
        h2 = (h2 + c) | 0;
        h3 = (h3 + d) | 0;
        h4 = (h4 + e) | 0;
    }
    return [h0, h1, h2, h3, h4].map(h => (h >>> 0).toString(16).padStart(8, '0')).join('');
}
