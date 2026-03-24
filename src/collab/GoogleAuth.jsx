import React, { useState, useEffect, useRef } from 'react';

export function GoogleAuth({ onLogin, isDark, isHost, accentColor }) {
    const [profile, setProfile] = useState(null);
    const [dropdownOpen, setDropdownOpen] = useState(false);
    const [showGuestInput, setShowGuestInput] = useState(false);
    const [guestName, setGuestName] = useState('');
    const dropdownRef = useRef(null);
    const ac = accentColor || '#39ff14';

    const handleGuestSignIn = () => {
        const name = guestName.trim() || 'Guest';
        const userProfile = { name, email: `${name.toLowerCase().replace(/\s+/g, '')}@local` };
        setProfile(userProfile);
        setShowGuestInput(false);
        setGuestName('');
        if (onLogin) onLogin(userProfile);
    };

    // Close dropdown on click outside
    useEffect(() => {
        if (!dropdownOpen) return;
        const handleClickOutside = (e) => {
            if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
                setDropdownOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [dropdownOpen]);

    const handleLogout = () => {
        setProfile(null);
        setDropdownOpen(false);
        if (onLogin) onLogin({ name: 'Anonymous', email: '' });
    };

    const handleSwitchName = () => {
        setProfile(null);
        setDropdownOpen(false);
        setShowGuestInput(true);
        if (onLogin) onLogin({ name: 'Anonymous', email: '' });
    };

    // Not signed in
    if (!profile) {
        return (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '4px' }}>
                {!showGuestInput ? (
                    <button
                        onClick={() => setShowGuestInput(true)}
                        style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '7px',
                            padding: '5px 14px 5px 10px',
                            background: isDark ? 'rgba(255,255,255,0.05)' : '#f8f9fa',
                            borderRadius: '20px',
                            border: `1px solid ${isDark ? 'rgba(255,255,255,0.1)' : '#e0e0e0'}`,
                            cursor: 'pointer',
                            transition: 'all 0.2s',
                        }}
                    >
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={ac} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
                            <circle cx="12" cy="7" r="4"/>
                        </svg>
                        <span style={{
                            fontSize: '11px',
                            fontWeight: 600,
                            color: ac,
                            letterSpacing: '0.3px',
                            whiteSpace: 'nowrap',
                        }}>
                            Set Display Name
                        </span>
                    </button>
                ) : (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <input
                            autoFocus
                            value={guestName}
                            onChange={e => setGuestName(e.target.value)}
                            onKeyDown={e => { if (e.key === 'Enter') handleGuestSignIn(); if (e.key === 'Escape') setShowGuestInput(false); }}
                            placeholder="Display name"
                            style={{
                                fontSize: '11px',
                                padding: '3px 8px',
                                borderRadius: '10px',
                                border: `1px solid ${isDark ? 'rgba(255,255,255,0.15)' : '#ccc'}`,
                                background: isDark ? 'rgba(255,255,255,0.06)' : '#fff',
                                color: isDark ? '#ddd' : '#333',
                                outline: 'none',
                                width: '110px',
                            }}
                        />
                        <button
                            onClick={handleGuestSignIn}
                            style={{
                                fontSize: '10px', padding: '3px 8px',
                                borderRadius: '10px', border: 'none',
                                background: ac, color: '#000',
                                cursor: 'pointer', fontWeight: 600,
                            }}
                        >
                            Go
                        </button>
                    </div>
                )}
            </div>
        );
    }

    // Signed in — profile avatar button
    return (
        <div ref={dropdownRef} style={{ position: 'relative' }}>
            <button
                onClick={() => { if (isHost) setDropdownOpen(!dropdownOpen); }}
                title={profile.name}
                style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    padding: '4px 10px',
                    background: dropdownOpen
                        ? (isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.08)')
                        : (isDark ? 'rgba(255,255,255,0.05)' : '#f8f9fa'),
                    borderRadius: '20px',
                    border: `1px solid ${isDark ? 'rgba(255,255,255,0.1)' : '#eee'}`,
                    cursor: isHost ? 'pointer' : 'default',
                    transition: 'all 0.2s'
                }}
            >
                <div style={{
                    width: '24px', height: '24px', borderRadius: '50%',
                    background: isDark ? '#333' : '#ddd',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: '11px', fontWeight: 'bold', color: isDark ? '#aaa' : '#666'
                }}>
                    {(profile.name || '?')[0].toUpperCase()}
                </div>
                <span style={{
                    fontSize: '10px',
                    fontWeight: 'bold',
                    color: isDark ? '#fff' : '#333',
                    maxWidth: '120px',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap'
                }}>
                    {profile.name}
                </span>
                {isHost && (
                    <span style={{
                        fontSize: '8px',
                        color: isDark ? '#666' : '#999',
                        transition: 'transform 0.2s',
                        transform: dropdownOpen ? 'rotate(180deg)' : 'rotate(0deg)'
                    }}>▼</span>
                )}
            </button>

            {/* Dropdown menu */}
            {dropdownOpen && (
                <div style={{
                    position: 'absolute',
                    top: 'calc(100% + 6px)',
                    right: 0,
                    minWidth: '180px',
                    background: isDark ? 'rgba(25, 25, 30, 0.98)' : '#fff',
                    border: `1px solid ${isDark ? 'rgba(255,255,255,0.1)' : '#e0e0e0'}`,
                    borderRadius: '10px',
                    boxShadow: '0 8px 30px rgba(0,0,0,0.4)',
                    backdropFilter: 'blur(20px)',
                    zIndex: 2000,
                    overflow: 'hidden'
                }}>
                    {/* Profile info */}
                    <div style={{
                        padding: '12px 14px',
                        borderBottom: `1px solid ${isDark ? 'rgba(255,255,255,0.06)' : '#eee'}`,
                        display: 'flex',
                        alignItems: 'center',
                        gap: '10px'
                    }}>
                        <div style={{
                            width: '32px', height: '32px', borderRadius: '50%',
                            background: isDark ? '#333' : '#ddd',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            fontSize: '14px', fontWeight: 'bold', color: isDark ? '#aaa' : '#666'
                        }}>
                            {(profile.name || '?')[0].toUpperCase()}
                        </div>
                        <span style={{
                            fontSize: '12px', fontWeight: 'bold',
                            color: isDark ? '#fff' : '#333',
                            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap'
                        }}>{profile.name}</span>
                    </div>

                    {/* Change name */}
                    <button
                        onClick={handleSwitchName}
                        style={{
                            width: '100%',
                            padding: '10px 14px',
                            background: 'none',
                            border: 'none',
                            borderBottom: `1px solid ${isDark ? 'rgba(255,255,255,0.06)' : '#eee'}`,
                            color: isDark ? '#ccc' : '#444',
                            fontSize: '11px',
                            cursor: 'pointer',
                            textAlign: 'left',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '8px',
                            transition: 'background 0.15s'
                        }}
                        onMouseEnter={(e) => e.currentTarget.style.background = isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.03)'}
                        onMouseLeave={(e) => e.currentTarget.style.background = 'none'}
                    >
                        Change name
                    </button>

                    {/* Sign out */}
                    <button
                        onClick={handleLogout}
                        style={{
                            width: '100%',
                            padding: '10px 14px',
                            background: 'none',
                            border: 'none',
                            color: '#ff4b4b',
                            fontSize: '11px',
                            cursor: 'pointer',
                            textAlign: 'left',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '8px',
                            transition: 'background 0.15s'
                        }}
                        onMouseEnter={(e) => e.currentTarget.style.background = isDark ? 'rgba(255,75,75,0.08)' : 'rgba(255,75,75,0.05)'}
                        onMouseLeave={(e) => e.currentTarget.style.background = 'none'}
                    >
                        Sign out
                    </button>
                </div>
            )}
        </div>
    );
}

export default GoogleAuth;
