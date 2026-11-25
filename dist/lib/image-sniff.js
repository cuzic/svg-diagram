// What a picture's bytes are (ADR 0031): the type and size from the header, and a ready data: URI. Pure: image() uses it for a data URI
// at once; lib/image-file.ts reads the files and hands the bytes here.
/** A hard limit: a bigger file is almost certainly a photo that should be resized first. */
export const IMAGE_MAX_BYTES = 8 * 1024 * 1024;
/** The size of a PNG / JPEG / GIF / WebP from its header, or null when the bytes are none of those. */
export function sniffImage(b) {
    const view = new DataView(b.buffer, b.byteOffset, b.byteLength);
    const ascii = (start, end) => String.fromCharCode(...b.subarray(start, end));
    if (b.length >= 24 && view.getUint32(0) === 0x89504e47 && view.getUint32(4) === 0x0d0a1a0a)
        return { mime: 'image/png', w: view.getUint32(16), h: view.getUint32(20) };
    if (b.length >= 10 && ascii(0, 3) === 'GIF')
        return { mime: 'image/gif', w: view.getUint16(6, true), h: view.getUint16(8, true) };
    if (b.length >= 4 && b[0] === 0xff && b[1] === 0xd8) {
        let i = 2;
        while (i + 9 < b.length) {
            if (b[i] !== 0xff) {
                i++;
                continue;
            }
            const m = b[i + 1];
            if (m === undefined)
                break;
            if (m === 0xff) {
                i++;
                continue;
            }
            if (m >= 0xc0 && m <= 0xcf && m !== 0xc4 && m !== 0xc8 && m !== 0xcc)
                return { mime: 'image/jpeg', h: view.getUint16(i + 5), w: view.getUint16(i + 7) };
            if (m === 0xd8 || m === 0x01 || (m >= 0xd0 && m <= 0xd7)) {
                i += 2;
                continue;
            }
            i += 2 + view.getUint16(i + 2);
        }
        return null;
    }
    if (b.length >= 30 && ascii(0, 4) === 'RIFF' && ascii(8, 12) === 'WEBP') {
        const kind = ascii(12, 16);
        if (kind === 'VP8X')
            return { mime: 'image/webp', w: 1 + (view.getUint32(24, true) & 0xffffff), h: 1 + (view.getUint16(27, true) + 65536 * view.getUint8(29)) };
        if (kind === 'VP8L') {
            const v = view.getUint32(21, true);
            return { mime: 'image/webp', w: 1 + (v & 0x3fff), h: 1 + ((v >> 14) & 0x3fff) };
        }
        if (kind === 'VP8 ')
            return { mime: 'image/webp', w: view.getUint16(26, true) & 0x3fff, h: view.getUint16(28, true) & 0x3fff };
    }
    return null;
}
/** The embedded form of a picture's bytes, or the reason it cannot be one (as an Error to throw). */
export function describeImage(buf) {
    return imageInfo(buf, () => buf.toString('base64'));
}
function assertImageSize(bytes) {
    if (bytes > IMAGE_MAX_BYTES)
        throw new Error(`image(): ${Math.round(bytes / 1024)} KB is over the ${IMAGE_MAX_BYTES / 1024 / 1024} MB limit — resize it first`);
}
function imageInfo(buf, base64) {
    assertImageSize(buf.length);
    const info = sniffImage(buf);
    if (!info)
        throw new Error('image(): only PNG, JPEG, GIF and WebP files are embedded (SVG is not: draw it with the other parts)');
    if (!(info.w > 0 && info.h > 0))
        throw new Error('image(): the file reports a size of 0');
    return { href: `data:${info.mime};base64,${base64()}`, w: info.w, h: info.h, bytes: buf.length, mime: info.mime };
}
/** The picture a `data:image/…;base64,` URI holds. */
export function readDataImage(src) {
    const m = /^data:image\/(?:png|jpeg|gif|webp);base64,([A-Za-z0-9+/=]+)$/.exec(src);
    if (!m)
        throw new Error('image(): a data URI must be data:image/png|jpeg|gif|webp;base64,…');
    // Match the Node decoder's handling of an omitted pad and trailing partial byte.
    const encoded = (m[1] ?? '').split('=', 1)[0] ?? '';
    assertImageSize(Math.floor(encoded.length * 3 / 4));
    const binary = atob(encoded.length % 4 === 1 ? encoded.slice(0, -1) : encoded);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++)
        bytes[i] = binary.charCodeAt(i);
    return imageInfo(bytes, () => btoa(binary));
}
