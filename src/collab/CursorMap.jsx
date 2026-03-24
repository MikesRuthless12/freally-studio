import React from 'react';

export function CursorMap({ mousePositions, showLabels = true }) {
    const entries = Object.entries(mousePositions);
    return (
        <div style={{
            position: 'fixed',
            top: 0,
            left: 0,
            width: '100vw',
            height: '100vh',
            pointerEvents: 'none',
            zIndex: 9999,
            overflow: 'hidden'
        }}>
            {entries.map(([id, pos], index) => (
                <div
                    key={id}
                    style={{
                        position: 'absolute',
                        left: pos.x,
                        top: pos.y,
                        transition: 'all 0.1s ease-out',
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'flex-start',
                        zIndex: 9999 + index
                    }}
                >
                    {/* SVG Cursor Icon */}
                    <svg
                        width="24"
                        height="24"
                        viewBox="0 0 24 24"
                        fill="none"
                        xmlns="http://www.w3.org/2000/svg"
                        style={{ filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.5))' }}
                    >
                        <path
                            d="M5.65376 12.3673H5.46026L5.31717 12.4976L0.500002 16.8829L0.500002 1.19841L11.7841 12.3673H5.65376Z"
                            fill={pos.color || '#39ff14'}
                            stroke="white"
                        />
                    </svg>

                    {/* User Label — matches chat display name and color */}
                    {showLabels && (
                        <div style={{
                            background: pos.color || '#39ff14',
                            color: '#000',
                            fontSize: '10px',
                            fontWeight: 'bold',
                            padding: '2px 8px',
                            borderRadius: '4px',
                            marginTop: '2px',
                            marginLeft: '12px',
                            whiteSpace: 'nowrap',
                            boxShadow: '0 2px 6px rgba(0,0,0,0.4)',
                            textShadow: '0 0 2px rgba(255,255,255,0.3)',
                            letterSpacing: '0.3px'
                        }}>
                            {pos.name || 'Peer'}
                        </div>
                    )}
                </div>
            ))}
        </div>
    );
}

export default CursorMap;
