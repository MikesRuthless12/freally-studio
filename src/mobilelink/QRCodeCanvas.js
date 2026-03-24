/**
 * QR Code Canvas Renderer — wraps the `qrcode` npm package.
 *
 * PUBLIC API (unchanged from original):
 *   renderQRToCanvas(canvas, text, options?)
 *     → draws QR code onto the given <canvas> element
 */

import QRCode from 'qrcode';

/**
 * Render a QR code onto a canvas element.
 *
 * @param {HTMLCanvasElement} canvas  Target canvas
 * @param {string} text              Text to encode
 * @param {Object} [options]
 * @param {number} [options.size=256]     Canvas pixel size
 * @param {string} [options.dark='#000']  Dark module color
 * @param {string} [options.light='#fff'] Light module color
 * @param {number} [options.margin=2]     Quiet zone in modules
 */
export function renderQRToCanvas(canvas, text, options = {}) {
    const {
        size: canvasSize = 256,
        dark = '#000000',
        light = '#ffffff',
        margin = 2,
    } = options;

    QRCode.toCanvas(canvas, text, {
        width: canvasSize,
        margin,
        color: { dark, light },
        errorCorrectionLevel: 'L',
    }).catch((err) => {
        console.error('[QRCodeCanvas] Failed to render QR code:', err);
    });
}
