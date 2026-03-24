import React, { useRef, useEffect } from 'react';
import { renderQRToCanvas } from './QRCodeCanvas';
import { useTranslation } from '../i18n/I18nContext';

/**
 * Mobile Link Modal — QR code display, session URL, connected devices list.
 *
 * @param {{
 *   isOpen: boolean,
 *   onClose: Function,
 *   sessionUrl: string,
 *   clients: Array<{ peerId: string, deviceInfo: { name: string } }>,
 *   isActive: boolean,
 *   onActivate: Function,
 *   onDeactivate: Function,
 *   onDisconnectClient: Function,
 *   isDark: boolean,
 *   ac: string,
 *   hexToRgba: Function,
 * }} props
 */
export default function MobileLinkModal({
    isOpen,
    onClose,
    sessionUrl,
    clients = [],
    isActive,
    onActivate,
    onDeactivate,
    onDisconnectClient,
    desktopMuted,
    onToggleDesktopMute,
    isDark,
    ac,
    hexToRgba,
}) {
    const { t } = useTranslation();
    const qrCanvasRef = useRef(null);

    // Render QR code when URL changes
    useEffect(() => {
        if (!qrCanvasRef.current || !sessionUrl) return;
        renderQRToCanvas(qrCanvasRef.current, sessionUrl, {
            size: 220,
            dark: isDark ? '#ffffff' : '#000000',
            light: isDark ? '#1a1a1f' : '#ffffff',
            margin: 2,
        });
    }, [sessionUrl, isDark]);

    if (!isOpen) return null;

    const bg = isDark ? '#1a1a1f' : '#fff';
    const border = isDark ? '#333' : '#ddd';
    const textColor = isDark ? '#e0e0e0' : '#333';
    const mutedText = isDark ? '#888' : '#999';

    return (
        <div
            style={{
                position: 'fixed',
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                background: 'rgba(0,0,0,0.7)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                zIndex: 10100,
                backdropFilter: 'blur(5px)',
            }}
            onClick={onClose}
        >
            <div
                style={{
                    background: bg,
                    padding: '30px',
                    borderRadius: '12px',
                    border: `1px solid ${border}`,
                    width: '400px',
                    maxWidth: '95vw',
                    maxHeight: '90vh',
                    overflowY: 'auto',
                    boxShadow: '0 10px 40px rgba(0,0,0,0.5)',
                    position: 'relative',
                    color: textColor,
                }}
                onClick={(e) => e.stopPropagation()}
            >
                {/* Header */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px' }}>
                    <h3 style={{ margin: 0, fontSize: '18px', fontWeight: 600 }}>
                        {t('mobileLink.title')}
                    </h3>
                    <div
                        onClick={onClose}
                        style={{ cursor: 'pointer', fontSize: '20px', color: mutedText, lineHeight: 1 }}
                    >
                        x
                    </div>
                </div>

                {/* Activate / Deactivate */}
                {!isActive ? (
                    <button
                        onClick={onActivate}
                        style={{
                            width: '100%',
                            padding: '12px',
                            border: 'none',
                            borderRadius: '8px',
                            background: ac,
                            color: '#fff',
                            fontSize: '15px',
                            fontWeight: 600,
                            cursor: 'pointer',
                            marginBottom: '16px',
                        }}
                    >
                        {t('mobileLink.start')}
                    </button>
                ) : (
                    <>
                        {/* Localhost warning */}
                        {sessionUrl && /\/\/(localhost|127\.0\.0\.1)(:|\/)/i.test(sessionUrl) && (
                            <div style={{
                                padding: '10px 12px',
                                marginBottom: '12px',
                                background: isDark ? 'rgba(234,179,8,0.1)' : 'rgba(234,179,8,0.08)',
                                border: '1px solid rgba(234,179,8,0.4)',
                                borderRadius: '8px',
                                fontSize: '12px',
                                color: '#eab308',
                                lineHeight: 1.5,
                            }}>
                                {t('mobileLink.localhostWarning')}
                            </div>
                        )}

                        {/* QR Code */}
                        <div style={{ textAlign: 'center', marginBottom: '16px' }}>
                            <canvas
                                ref={qrCanvasRef}
                                style={{
                                    borderRadius: '8px',
                                    border: `1px solid ${border}`,
                                }}
                            />
                            <div style={{ fontSize: '12px', color: mutedText, marginTop: '8px' }}>
                                {t('mobileLink.scanQR')}
                            </div>
                        </div>

                        {/* Session URL */}
                        <div style={{ marginBottom: '16px' }}>
                            <div style={{ fontSize: '11px', color: mutedText, marginBottom: '4px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                                {t('mobileLink.sessionUrl')}
                            </div>
                            <div
                                onClick={() => {
                                    navigator.clipboard.writeText(sessionUrl).catch(() => {});
                                }}
                                title={t('ui.clickToCopy')}
                                style={{
                                    padding: '8px 12px',
                                    background: isDark ? '#0d0d12' : '#f5f5f5',
                                    borderRadius: '6px',
                                    fontSize: '12px',
                                    fontFamily: 'monospace',
                                    wordBreak: 'break-all',
                                    cursor: 'pointer',
                                    border: `1px solid ${border}`,
                                }}
                            >
                                {sessionUrl}
                            </div>
                        </div>

                        {/* Connected Devices */}
                        <div style={{ marginBottom: '16px' }}>
                            <div style={{ fontSize: '11px', color: mutedText, marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                                {t('mobileLink.connectedDevices', { count: clients.length })}
                            </div>
                            {clients.length === 0 ? (
                                <div style={{ fontSize: '13px', color: mutedText, fontStyle: 'italic', padding: '8px 0' }}>
                                    {t('mobileLink.waitingConnections')}
                                </div>
                            ) : (
                                clients.map((client) => (
                                    <div
                                        key={client.peerId}
                                        style={{
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'space-between',
                                            padding: '8px 12px',
                                            background: isDark ? '#0d0d12' : '#f5f5f5',
                                            borderRadius: '6px',
                                            marginBottom: '4px',
                                            border: `1px solid ${border}`,
                                        }}
                                    >
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                            <div style={{
                                                width: '8px',
                                                height: '8px',
                                                borderRadius: '50%',
                                                background: '#22c55e',
                                            }} />
                                            <span style={{ fontSize: '13px' }}>
                                                {client.deviceInfo?.name || t('mobileLink.mobileDevice')}
                                            </span>
                                        </div>
                                        <div
                                            onClick={() => onDisconnectClient(client.peerId)}
                                            style={{
                                                fontSize: '11px',
                                                color: '#ef4444',
                                                cursor: 'pointer',
                                                padding: '2px 8px',
                                                borderRadius: '4px',
                                                border: '1px solid rgba(239,68,68,0.3)',
                                            }}
                                        >
                                            {t('mobileLink.disconnect')}
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>

                        {/* Mute Desktop Speakers toggle */}
                        <div
                            onClick={onToggleDesktopMute}
                            style={{
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'space-between',
                                padding: '10px 12px',
                                marginBottom: '12px',
                                background: desktopMuted
                                    ? (isDark ? 'rgba(239,68,68,0.12)' : 'rgba(239,68,68,0.08)')
                                    : (isDark ? '#0d0d12' : '#f5f5f5'),
                                borderRadius: '8px',
                                border: `1px solid ${desktopMuted ? 'rgba(239,68,68,0.4)' : border}`,
                                cursor: 'pointer',
                                transition: 'all 0.2s',
                            }}
                        >
                            <div>
                                <div style={{ fontSize: '13px', fontWeight: 600 }}>
                                    {t('mobileLink.muteDesktop')}
                                </div>
                                <div style={{ fontSize: '11px', color: mutedText, marginTop: '2px' }}>
                                    {t('mobileLink.muteDesktopDesc')}
                                </div>
                            </div>
                            <div style={{
                                width: '40px',
                                height: '22px',
                                borderRadius: '11px',
                                background: desktopMuted ? '#ef4444' : (isDark ? '#333' : '#ccc'),
                                position: 'relative',
                                transition: 'background 0.2s',
                                flexShrink: 0,
                                marginLeft: '12px',
                            }}>
                                <div style={{
                                    width: '18px',
                                    height: '18px',
                                    borderRadius: '50%',
                                    background: '#fff',
                                    position: 'absolute',
                                    top: '2px',
                                    left: desktopMuted ? '20px' : '2px',
                                    transition: 'left 0.2s',
                                    boxShadow: '0 1px 3px rgba(0,0,0,0.3)',
                                }} />
                            </div>
                        </div>

                        {/* Stop button */}
                        <button
                            onClick={onDeactivate}
                            style={{
                                width: '100%',
                                padding: '10px',
                                border: '1px solid #ef4444',
                                borderRadius: '8px',
                                background: 'transparent',
                                color: '#ef4444',
                                fontSize: '13px',
                                fontWeight: 600,
                                cursor: 'pointer',
                            }}
                        >
                            {t('mobileLink.stop')}
                        </button>
                    </>
                )}
            </div>
        </div>
    );
}
