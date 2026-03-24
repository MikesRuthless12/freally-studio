import React, { useState } from 'react';
import { hexToRgba } from '../accentThemes';

export function LockedOverlay({ ownerId, onRequestAccess, accentColors, message}) {
    const ac = accentColors?.accent || '#ff6b6b';
    const acSec = accentColors?.secondary || '#ff9f43';
    const acGrad = accentColors?.gradient || 'linear-gradient(135deg, #ff6b6b, #ff9f43)';

    const [requested, setRequested] = useState(false);

    return (
        <div style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'rgba(0,0,0,0.85)',
            backdropFilter: 'blur(8px)',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#fff',
            zIndex: 1000,
            textAlign: 'center',
            padding: '20px'
        }}>
            <div style={{ fontSize: '48px', marginBottom: '20px' }}>🔒</div>
            <h2 style={{ fontSize: '24px', margin: '0 0 10px 0', color: '#ff4b4b' }}>TAB LOCKED</h2>
            <p style={{ fontSize: '14px', margin: '0', opacity: 0.8 }}>{message || 'Another collaborator is working in this area.'}</p>
            {ownerId && (
                <p style={{
                    fontSize: '11px',
                    marginTop: '20px',
                    background: 'rgba(255,255,255,0.1)',
                    padding: '4px 12px',
                    borderRadius: '20px'
                }}>
                    User: {ownerId}
                </p>
            )}
            {onRequestAccess && (
                <button
                    onClick={() => {
                        if (!requested) {
                            onRequestAccess();
                            setRequested(true);
                        }
                    }}
                    disabled={requested}
                    style={{
                        marginTop: '20px',
                        padding: '12px 24px',
                        background: requested ? 'rgba(255,255,255,0.05)' : hexToRgba(ac, 0.2),
                        border: `1px solid ${requested ? 'rgba(255,255,255,0.1)' : ac}`,
                        borderRadius: '8px',
                        color: requested ? '#666' : ac,
                        fontSize: '12px',
                        fontWeight: 'bold',
                        cursor: requested ? 'default' : 'pointer',
                        transition: 'all 0.2s'
                    }}
                >
                    {requested ? 'ACCESS REQUESTED' : 'REQUEST ACCESS'}
                </button>
            )}
        </div>
    );
}

export default LockedOverlay;
