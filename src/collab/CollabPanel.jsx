import React, { useState, useRef, useEffect } from 'react';
import EmojiPicker from 'emoji-picker-react';
import twemoji from '@twemoji/api';
import { createInviteLink } from './Room';
import { hexToRgba } from '../accentThemes';
import { useTranslation } from '../i18n/I18nContext';
import { VoiceChatMeter } from './VoiceChatMeter';
import { PTTButton } from './PTTButton';

export function CollabPanel({ collab, theme, onClose, addToast, accentColors }) {
    const { t } = useTranslation();
    const ac = accentColors?.accent || '#ff6b6b';
    const acSec = accentColors?.secondary || '#ff9f43';
    const acGrad = accentColors?.gradient || 'linear-gradient(135deg, #ff6b6b, #ff9f43)';

    const isDark = theme === 'dark';
    const [chatInput, setChatInput] = useState('');
    const [showChat, setShowChat] = useState(true);
    const [showEmojiPicker, setShowEmojiPicker] = useState(false);
    const chatEndRef = useRef(null);
    const emojiPickerRef = useRef(null);
    const chatTimestampsRef = useRef([]);
    const [chatCooldown, setChatCooldown] = useState(0);
    const chatCooldownRef = useRef(null);

    const handleCopyLink = () => {
        const link = createInviteLink(collab.room, collab.roomSecret);
        navigator.clipboard.writeText(link).then(() => {
            if (addToast) addToast('Room link copied! Share with collaborators.', 'success');
        }).catch(() => {
            if (addToast) addToast('Failed to copy link', 'error');
        });
    };

    // Auto-scroll chat to bottom on new messages
    useEffect(() => {
        if (chatEndRef.current && showChat) {
            chatEndRef.current.scrollIntoView({ behavior: 'smooth' });
        }
    }, [collab.chatMessages, showChat]);

    // Track chat visibility for unread count
    useEffect(() => {
        collab.setChatVisible(showChat);
    }, [showChat]);

    // Close emoji picker on click outside
    useEffect(() => {
        const handleClickOutside = (e) => {
            if (emojiPickerRef.current && !emojiPickerRef.current.contains(e.target)) {
                setShowEmojiPicker(false);
            }
        };
        if (showEmojiPicker) {
            document.addEventListener('mousedown', handleClickOutside);
        }
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [showEmojiPicker]);

    // Render text with Twemoji images for cross-platform emoji support
    const TwemojiText = ({ text, style }) => {
        const spanRef = useRef(null);
        useEffect(() => {
            if (spanRef.current) {
                twemoji.parse(spanRef.current, { folder: 'svg', ext: '.svg' });
            }
        }, [text]);
        return <span ref={spanRef} style={style} className="twemoji-text">{text}</span>;
    };

    // Get color for a chat message sender
    const getChatColor = (msg) => {
        if (msg.from === collab.myId) return collab.myColor || ac;
        return collab.peers[msg.from]?.color || acSec;
    };

    const renderLatencyIndicator = (id) => {
        const state = collab.connectionStates[id];
        const latency = collab.peerLatencies[id];

        if (state === 'reconnecting') {
            return <span style={{ fontSize: '9px', color: acSec, marginLeft: '6px', fontWeight: 'bold' }}>RECONNECTING</span>;
        }
        if (state === 'disconnected') {
            return <span style={{ fontSize: '9px', color: '#ff4b4b', marginLeft: '6px', fontWeight: 'bold' }}>DISCONNECTED</span>;
        }
        if (latency !== undefined) {
            const color = latency < 100 ? '#39ff14' : latency < 300 ? acSec : '#ff4b4b';
            return (
                <span style={{ fontSize: '9px', color, marginLeft: '6px' }}>
                    <span style={{
                        display: 'inline-block',
                        width: '6px',
                        height: '6px',
                        borderRadius: '50%',
                        background: color,
                        marginRight: '3px',
                        verticalAlign: 'middle',
                        boxShadow: `0 0 4px ${color}`
                    }} />
                    {latency}ms
                </span>
            );
        }
        return null;
    };

    // Clean up cooldown timer on unmount
    useEffect(() => {
        return () => { if (chatCooldownRef.current) clearInterval(chatCooldownRef.current); };
    }, []);

    const handleSendChat = () => {
        if (!chatInput.trim()) return;

        // If on cooldown, block
        if (chatCooldown > 0) {
            if (addToast) addToast(`Slow down! Wait ${chatCooldown}s before sending again.`, 'warning');
            return;
        }

        // Track timestamps — keep only those within the last 3 seconds
        const now = Date.now();
        chatTimestampsRef.current = chatTimestampsRef.current.filter(t => now - t < 3000);
        chatTimestampsRef.current.push(now);

        // If 3+ messages in 3 seconds, start 10s cooldown
        if (chatTimestampsRef.current.length >= 3) {
            chatTimestampsRef.current = [];
            setChatCooldown(10);
            if (chatCooldownRef.current) clearInterval(chatCooldownRef.current);
            chatCooldownRef.current = setInterval(() => {
                setChatCooldown(prev => {
                    if (prev <= 1) {
                        clearInterval(chatCooldownRef.current);
                        chatCooldownRef.current = null;
                        return 0;
                    }
                    return prev - 1;
                });
            }, 1000);
            if (addToast) addToast('Chat rate limit — wait 10 seconds.', 'warning');
        }

        collab.sendChatMessage(chatInput);
        setChatInput('');
        setShowEmojiPicker(false);
    };

    return (
        <div style={{
            position: 'fixed',
            right: '20px',
            top: '80px',
            width: '400px',
            background: isDark ? 'rgba(20, 20, 25, 0.95)' : '#fff',
            border: `1px solid ${isDark ? 'rgba(255,255,255,0.1)' : '#eee'}`,
            borderRadius: '12px',
            padding: '20px',
            boxShadow: '0 10px 40px rgba(0,0,0,0.5)',
            zIndex: 1000,
            backdropFilter: 'blur(30px)',
            maxHeight: '85vh',
            overflowY: 'auto',
            display: 'flex',
            flexDirection: 'column',
            gap: '20px'
        }}>
            {/* Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#39ff14', boxShadow: '0 0 10px #39ff14' }} />
                    <h3 style={{ margin: 0, fontSize: '12px', fontWeight: '900', letterSpacing: '2px', color: isDark ? '#fff' : '#000' }}>
                        {collab.isHost ? 'HOST PANEL' : 'COLLABORATOR'}
                    </h3>
                </div>
                <button
                    onClick={onClose}
                    style={{ background: 'none', border: 'none', color: isDark ? '#888' : '#666', cursor: 'pointer', fontSize: '18px' }}
                >
                    ✕
                </button>
            </div>

            {/* Session Link — Accent Themed */}
            <div style={{ padding: '15px', background: isDark ? hexToRgba(ac, 0.03) : hexToRgba(ac, 0.04), borderRadius: '8px', border: `1px solid ${isDark ? hexToRgba(ac, 0.1) : hexToRgba(ac, 0.15)}` }}>
                <div style={{ fontSize: '9px', color: isDark ? '#666' : '#999', marginBottom: '8px', letterSpacing: '1px' }}>SESSION LINK</div>
                <button
                    onClick={handleCopyLink}
                    style={{
                        width: '100%',
                        padding: '12px',
                        background: isDark ? hexToRgba(ac, 0.1) : hexToRgba(ac, 0.08),
                        border: `1px solid ${isDark ? hexToRgba(ac, 0.4) : hexToRgba(ac, 0.3)}`,
                        borderRadius: '6px',
                        color: ac,
                        fontSize: '11px',
                        fontWeight: '900',
                        cursor: 'pointer',
                        transition: 'all 0.2s',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '8px'
                    }}
                    onMouseEnter={(e) => { e.currentTarget.style.background = isDark ? hexToRgba(ac, 0.2) : hexToRgba(ac, 0.15); }}
                    onMouseLeave={(e) => { e.currentTarget.style.background = isDark ? hexToRgba(ac, 0.1) : hexToRgba(ac, 0.08); }}
                >
                    🔗 COPY INVITE LINK
                </button>
            </div>

            {/* Peers List */}
            <div>
                <h4 style={{ fontSize: '11px', color: isDark ? '#666' : '#999', marginBottom: '12px', letterSpacing: '1px' }}>PEERS ({Object.keys(collab.peers).length}/4)</h4>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    {Object.entries(collab.peers).map(([id, peer]) => (
                        <div key={id} style={{
                            padding: '12px',
                            background: isDark ? 'rgba(255,255,255,0.02)' : 'rgba(0,0,0,0.02)',
                            borderRadius: '8px',
                            border: `1px solid ${isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)'}`
                        }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: collab.isHost ? '12px' : '0' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flex: 1, minWidth: 0 }}>
                                    <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: peer.color, flexShrink: 0 }} />
                                    <span style={{ fontSize: '11px', fontWeight: 'bold', color: peer.color, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                        {(collab.peerDisplayNames && collab.peerDisplayNames[id])
                                            || (peer.profile?.email ? peer.profile.email.split('@')[0] : (peer.profile?.name || id.slice(-4)))}
                                    </span>
                                    {renderLatencyIndicator(id)}
                                </div>
                                <div style={{ display: 'flex', gap: '4px', flexShrink: 0, alignItems: 'center' }}>
                                    {/* Host mute controls */}
                                    {collab.isHost && (
                                        <>
                                            <button
                                                onClick={() => {
                                                    const cur = collab.peerMuteState[id] || {};
                                                    collab.mutePeer(id, { audio: !cur.audio, chat: !!cur.chat });
                                                }}
                                                title={collab.peerMuteState[id]?.audio ? 'Unmute mic' : 'Mute mic'}
                                                style={{
                                                    background: collab.peerMuteState[id]?.audio ? 'rgba(255,75,75,0.15)' : (isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.04)'),
                                                    border: `1px solid ${collab.peerMuteState[id]?.audio ? '#ff4b4b' : (isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)')}`,
                                                    borderRadius: '4px',
                                                    fontSize: '10px',
                                                    padding: '3px 5px',
                                                    cursor: 'pointer',
                                                    color: collab.peerMuteState[id]?.audio ? '#ff4b4b' : (isDark ? '#aaa' : '#666'),
                                                    lineHeight: 1
                                                }}
                                            >
                                                {collab.peerMuteState[id]?.audio ? (
                                                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/><line x1="1" y1="1" x2="23" y2="23"/></svg>
                                                ) : (
                                                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/></svg>
                                                )}
                                            </button>
                                            <button
                                                onClick={() => {
                                                    const cur = collab.peerMuteState[id] || {};
                                                    collab.mutePeer(id, { audio: !!cur.audio, chat: !cur.chat });
                                                }}
                                                title={collab.peerMuteState[id]?.chat ? 'Unmute chat' : 'Mute chat'}
                                                style={{
                                                    background: collab.peerMuteState[id]?.chat ? 'rgba(255,75,75,0.15)' : (isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.04)'),
                                                    border: `1px solid ${collab.peerMuteState[id]?.chat ? '#ff4b4b' : (isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)')}`,
                                                    borderRadius: '4px',
                                                    fontSize: '10px',
                                                    padding: '3px 5px',
                                                    cursor: 'pointer',
                                                    color: collab.peerMuteState[id]?.chat ? '#ff4b4b' : (isDark ? '#aaa' : '#666'),
                                                    lineHeight: 1
                                                }}
                                            >
                                                {collab.peerMuteState[id]?.chat ? (
                                                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/><line x1="1" y1="1" x2="23" y2="23"/></svg>
                                                ) : (
                                                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
                                                )}
                                            </button>
                                        </>
                                    )}
                                    <button
                                        onClick={() => {
                                            if (collab.followingPeer === id) {
                                                collab.stopFollowing();
                                            } else {
                                                collab.followPeer(id);
                                            }
                                        }}
                                        style={{
                                            background: collab.followingPeer === id ? hexToRgba(acSec, 0.2) : (isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.04)'),
                                            border: `1px solid ${collab.followingPeer === id ? acSec : (isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)')}`,
                                            borderRadius: '4px',
                                            fontSize: '9px',
                                            padding: '4px 8px',
                                            cursor: 'pointer',
                                            color: collab.followingPeer === id ? acSec : (isDark ? '#fff' : '#333'),
                                            fontWeight: collab.followingPeer === id ? 'bold' : 'normal'
                                        }}
                                    >
                                        {collab.followingPeer === id ? 'FOLLOWING' : 'FOLLOW'}
                                    </button>
                                    <button
                                        onClick={() => collab.requestScreen(id)}
                                        style={{
                                            background: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.04)',
                                            border: `1px solid ${isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)'}`,
                                            borderRadius: '4px',
                                            fontSize: '9px',
                                            padding: '4px 8px',
                                            cursor: 'pointer',
                                            color: isDark ? '#fff' : '#333'
                                        }}
                                    >
                                        SCREEN
                                    </button>
                                </div>
                            </div>

                            {collab.isHost && (
                                <div style={{ borderTop: `1px solid ${isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)'}`, paddingTop: '10px' }}>
                                    <div style={{ fontSize: '9px', color: isDark ? '#555' : '#999', marginBottom: '6px' }}>DELEGATE AREA</div>
                                    <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
                                        {['drums', 'melody', 'bass', 'chords', 'browser'].map(tab => (
                                            <button
                                                key={tab}
                                                onClick={() => collab.assignTab(tab, id)}
                                                style={{
                                                    fontSize: '8px',
                                                    padding: '4px 8px',
                                                    background: collab.tabOwners[tab] === id ? '#39ff14' : (isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.04)'),
                                                    color: collab.tabOwners[tab] === id ? '#000' : (isDark ? '#888' : '#666'),
                                                    border: 'none',
                                                    borderRadius: '4px',
                                                    cursor: 'pointer',
                                                    textTransform: 'uppercase'
                                                }}
                                            >
                                                {tab}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>
                    ))}
                    {Object.keys(collab.peers).length === 0 && (
                        <div style={{ fontSize: '11px', color: isDark ? '#444' : '#999', textAlign: 'center', padding: '10px' }}>Waiting for collaborators...</div>
                    )}
                </div>
            </div>

            {/* Comm Mode Toggle (Host Only) */}
            {collab.isHost && (
                <div style={{
                    padding: '10px 12px',
                    background: isDark ? 'rgba(255,255,255,0.02)' : 'rgba(0,0,0,0.02)',
                    borderRadius: '8px',
                    border: `1px solid ${isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)'}`
                }}>
                    <div style={{ fontSize: '9px', color: isDark ? '#666' : '#999', marginBottom: '8px', letterSpacing: '1px' }}>COMM MODE</div>
                    <div style={{ display: 'flex', gap: '4px' }}>
                        {[
                            { mode: 'both', label: 'Both', icon: (
                                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h6"/></svg>
                            )},
                            { mode: 'chat', label: 'Chat', icon: (
                                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
                            )},
                            { mode: 'audio', label: 'Audio', icon: (
                                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/></svg>
                            )},
                            { mode: 'none', label: 'None', icon: (
                                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="1" y1="1" x2="23" y2="23"/><path d="M9 9v3a3 3 0 0 0 5.12 2.12M15 9.34V4a3 3 0 0 0-5.94-.6"/></svg>
                            )}
                        ].map(({ mode, label, icon }) => {
                            const active = collab.commMode === mode;
                            return (
                                <button
                                    key={mode}
                                    onClick={() => collab.setCommMode(mode)}
                                    style={{
                                        flex: 1,
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        gap: '4px',
                                        padding: '6px 4px',
                                        background: active ? `${ac}20` : (isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.03)'),
                                        border: `1px solid ${active ? ac : (isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)')}`,
                                        borderRadius: '6px',
                                        color: active ? ac : (isDark ? '#888' : '#666'),
                                        fontSize: '9px',
                                        fontWeight: active ? 'bold' : 'normal',
                                        cursor: 'pointer',
                                        transition: 'all 0.15s'
                                    }}
                                >
                                    {icon}
                                    {label}
                                </button>
                            );
                        })}
                    </div>
                </div>
            )}

            {/* Voice Section — visible when commMode includes audio */}
            {(collab.commMode === 'both' || collab.commMode === 'audio') && (() => {
                // Build list of all users for meters: self + peers + empty slots (always show 5 meters)
                const allUsers = [];
                const myDisplayName = collab.userProfile.email
                    ? collab.userProfile.email.split('@')[0]
                    : collab.userProfile.name;
                allUsers.push({
                    id: collab.myId,
                    label: myDisplayName,
                    color: collab.myColor || ac,
                    isTalking: collab.localTalking,
                    isMuted: collab.peerMuteState[collab.myId]?.audio || false,
                    level: collab.peerAudioLevels[collab.myId] || 0
                });
                Object.entries(collab.peers).forEach(([id, peer]) => {
                    allUsers.push({
                        id,
                        label: (collab.peerDisplayNames && collab.peerDisplayNames[id])
                            || (peer.profile?.email ? peer.profile.email.split('@')[0] : (peer.profile?.name || id.slice(-4))),
                        color: peer.color || acSec,
                        isTalking: collab.peerTalkingState[id] || false,
                        isMuted: collab.peerMuteState[id]?.audio || false,
                        level: collab.peerAudioLevels[id] || 0
                    });
                });
                // Pad to 5 slots so all meters are always visible
                const slotColors = ['#4facfe', '#f39c12', '#9b59b6', '#ff4b4b'];
                while (allUsers.length < 5) {
                    const idx = allUsers.length - 1;
                    allUsers.push({
                        id: `empty-${idx}`,
                        label: `Guest ${idx}`,
                        color: slotColors[idx % slotColors.length],
                        isTalking: false,
                        isMuted: false,
                        level: 0,
                        isEmpty: true
                    });
                }

                // Who's currently talking?
                const talkers = allUsers.filter(u => u.isTalking && !u.isMuted);
                const talkingNames = talkers.map(u => u.label).join(', ');

                // 2-person talk limit check
                const totalTalkers = (collab.localTalking ? 1 : 0) +
                    Object.values(collab.peerTalkingState).filter(Boolean).length;
                const pttDisabled = (!collab.localTalking && totalTalkers >= 2) ||
                    (collab.peerMuteState[collab.myId]?.audio);
                const pttDisabledReason = collab.peerMuteState[collab.myId]?.audio
                    ? 'Your mic is muted by host'
                    : totalTalkers >= 2 ? '2 people talking' : '';

                return (
                    <div style={{
                        padding: '12px',
                        background: isDark ? 'rgba(255,255,255,0.02)' : 'rgba(0,0,0,0.02)',
                        borderRadius: '8px',
                        border: `1px solid ${isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)'}`,
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        gap: '10px'
                    }}>
                        <div style={{ fontSize: '9px', color: isDark ? '#666' : '#999', letterSpacing: '1px', alignSelf: 'flex-start' }}>VOICE CHAT</div>

                        {/* Audio level meters row */}
                        <div style={{ display: 'flex', gap: '12px', justifyContent: 'center', flexWrap: 'wrap' }}>
                            {allUsers.map(u => (
                                <VoiceChatMeter
                                    key={u.id}
                                    level={u.level}
                                    label={u.label}
                                    color={u.color}
                                    isTalking={u.isTalking}
                                    isMuted={u.isMuted}
                                    isDark={isDark}
                                />
                            ))}
                        </div>

                        {/* Currently talking label — fixed height to prevent layout shift */}
                        <div style={{
                            fontSize: '10px',
                            fontWeight: 'bold',
                            color: ac,
                            textAlign: 'center',
                            letterSpacing: '0.3px',
                            height: '14px',
                            opacity: talkingNames ? 1 : 0,
                            transition: 'opacity 0.15s'
                        }}>
                            {talkingNames ? `${talkingNames} talking` : '\u00A0'}
                        </div>

                        {/* PTT button */}
                        <PTTButton
                            onPress={() => collab.startTalking()}
                            onRelease={() => collab.stopTalking()}
                            disabled={pttDisabled}
                            isTalking={collab.localTalking}
                            isDark={isDark}
                            accentColor={ac}
                            disabledReason={pttDisabledReason}
                        />

                        {/* Master volume slider */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', width: '100%', maxWidth: '200px' }}>
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke={isDark ? '#666' : '#999'} strokeWidth="2">
                                <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
                                <path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07" />
                            </svg>
                            <input
                                type="range"
                                min="0"
                                max="1"
                                step="0.01"
                                value={collab.voiceMasterVolume}
                                onChange={(e) => collab.setVoiceMasterVolume(parseFloat(e.target.value))}
                                style={{
                                    flex: 1,
                                    accentColor: ac,
                                    cursor: 'pointer',
                                    height: '4px'
                                }}
                            />
                            <span style={{ fontSize: '9px', color: isDark ? '#666' : '#999', minWidth: '24px', textAlign: 'right' }}>
                                {Math.round(collab.voiceMasterVolume * 100)}%
                            </span>
                        </div>

                        {/* Hear Yourself toggle */}
                        <label style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '6px',
                            cursor: 'pointer',
                            fontSize: '10px',
                            color: isDark ? '#999' : '#666',
                            userSelect: 'none'
                        }}>
                            <input
                                type="checkbox"
                                checked={collab.selfMonitorEnabled}
                                onChange={(e) => collab.setSelfMonitor(e.target.checked)}
                                style={{ accentColor: ac, cursor: 'pointer' }}
                            />
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <path d="M3 18v-6a9 9 0 0 1 18 0v6" />
                                <path d="M21 19a2 2 0 0 1-2 2h-1a2 2 0 0 1-2-2v-3a2 2 0 0 1 2-2h3zM3 19a2 2 0 0 0 2 2h1a2 2 0 0 0 2-2v-3a2 2 0 0 0-2-2H3z" />
                            </svg>
                            Hear Yourself
                        </label>

                        {/* Recording broadcast consent — opt-in. Default off (safe). */}
                        <label
                            title="When recording, broadcast your microphone to peers. Off by default for privacy."
                            style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: '6px',
                                cursor: 'pointer',
                                fontSize: '10px',
                                color: isDark ? '#999' : '#666',
                                userSelect: 'none'
                            }}
                        >
                            <input
                                type="checkbox"
                                checked={!!collab.recordingBroadcastEnabled}
                                onChange={(e) => collab.setRecordingBroadcastEnabled && collab.setRecordingBroadcastEnabled(e.target.checked)}
                                style={{ accentColor: ac, cursor: 'pointer' }}
                            />
                            Broadcast mic to peers during recording
                        </label>

                        {/* "You are muted" indicator for non-host */}
                        {collab.peerMuteState[collab.myId]?.audio && (
                            <div style={{
                                fontSize: '9px',
                                color: '#ff4b4b',
                                fontWeight: 'bold',
                                letterSpacing: '0.5px'
                            }}>
                                YOUR MIC IS MUTED BY HOST
                            </div>
                        )}
                    </div>
                );
            })()}

            {/* Chat Section — Enlarged */}
            {(collab.commMode === 'both' || collab.commMode === 'chat') && (
            <div style={{ borderTop: `1px solid ${isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.06)'}`, paddingTop: '15px' }}>
                <div
                    onClick={() => setShowChat(!showChat)}
                    style={{
                        display: 'flex', justifyContent: 'space-between',
                        alignItems: 'center', cursor: 'pointer', marginBottom: showChat ? '10px' : '0'
                    }}
                >
                    <h4 style={{ fontSize: '11px', color: isDark ? '#666' : '#999', margin: 0, letterSpacing: '1px' }}>
                        CHAT
                        {collab.unreadCount > 0 && !showChat && (
                            <span style={{
                                marginLeft: '8px',
                                background: '#ff4b4b',
                                color: '#fff',
                                fontSize: '9px',
                                fontWeight: 'bold',
                                padding: '1px 6px',
                                borderRadius: '10px'
                            }}>
                                {collab.unreadCount > 9 ? '9+' : collab.unreadCount}
                            </span>
                        )}
                    </h4>
                    <span style={{ fontSize: '11px', color: isDark ? '#666' : '#999' }}>{showChat ? '▼' : '▶'}</span>
                </div>
                {showChat && (
                    <>
                        {/* Chat Messages Area — 450px */}
                        <div style={{
                            height: '450px',
                            overflowY: 'auto',
                            background: isDark ? 'rgba(0,0,0,0.2)' : 'rgba(0,0,0,0.03)',
                            borderRadius: '6px',
                            padding: '10px',
                            marginBottom: '8px',
                            display: 'flex',
                            flexDirection: 'column',
                            gap: '8px'
                        }}>
                            {collab.chatMessages.length === 0 && (
                                <div style={{ fontSize: '10px', color: isDark ? '#444' : '#aaa', textAlign: 'center', padding: '40px 0' }}>No messages yet</div>
                            )}
                            {collab.chatMessages.map(msg => {
                                const isOwn = msg.from === collab.myId;
                                const nameColor = getChatColor(msg);
                                return (
                                    <div key={msg.id} style={{
                                        fontSize: '12px',
                                        color: isDark ? '#ccc' : '#333',
                                        wordBreak: 'break-word',
                                        padding: '6px 10px',
                                        background: isOwn
                                            ? (isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.03)')
                                            : 'transparent',
                                        borderRadius: '6px',
                                        borderLeft: `3px solid ${nameColor}`,
                                        textAlign: 'left'
                                    }}>
                                        <div style={{ display: 'flex', alignItems: 'baseline', gap: '6px', marginBottom: '2px' }}>
                                            <span style={{
                                                fontWeight: '900',
                                                color: nameColor,
                                                fontSize: '11px'
                                            }}>
                                                {(collab.peerDisplayNames && collab.peerDisplayNames[msg.from]) || msg.displayName}
                                            </span>
                                            <span style={{ color: isDark ? '#444' : '#bbb', fontSize: '9px' }}>
                                                {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                            </span>
                                        </div>
                                        <TwemojiText text={msg.text} style={{ color: isDark ? (isOwn ? '#bbb' : '#ccc') : (isOwn ? '#444' : '#333') }} />
                                    </div>
                                );
                            })}
                            <div ref={chatEndRef} />
                        </div>

                        {/* Emoji Picker Popup */}
                        <div style={{ position: 'relative' }} ref={emojiPickerRef}>
                            {showEmojiPicker && (
                                <div style={{
                                    position: 'absolute',
                                    bottom: '44px',
                                    left: 0,
                                    zIndex: 1001
                                }}>
                                    <EmojiPicker
                                        onEmojiClick={(emojiData) => {
                                            setChatInput(prev => prev + emojiData.emoji);
                                            setShowEmojiPicker(false);
                                        }}
                                        theme={isDark ? 'dark' : 'light'}
                                        width={280}
                                        height={350}
                                        searchDisabled={false}
                                        skinTonesDisabled
                                        previewConfig={{ showPreview: false }}
                                    />
                                </div>
                            )}
                        </div>

                        {/* Chat Input Row */}
                        <div style={{ display: 'flex', gap: '6px' }}>
                            <input
                                value={chatInput}
                                onChange={e => setChatInput(e.target.value)}
                                onKeyDown={e => {
                                    if (e.key === 'Enter' && chatInput.trim()) {
                                        e.stopPropagation();
                                        handleSendChat();
                                    }
                                }}
                                placeholder={chatCooldown > 0 ? `Wait ${chatCooldown}s...` : t('ui.typeMessage')}
                                disabled={chatCooldown > 0}
                                style={{
                                    flex: 1,
                                    padding: '8px 10px',
                                    background: chatCooldown > 0
                                        ? (isDark ? 'rgba(255,80,80,0.1)' : 'rgba(255,80,80,0.05)')
                                        : (isDark ? 'rgba(255,255,255,0.05)' : '#f5f5f5'),
                                    border: `1px solid ${chatCooldown > 0 ? 'rgba(255,80,80,0.3)' : (isDark ? 'rgba(255,255,255,0.1)' : '#ddd')}`,
                                    borderRadius: '6px',
                                    color: isDark ? '#fff' : '#333',
                                    fontSize: '11px',
                                    outline: 'none',
                                    opacity: chatCooldown > 0 ? 0.5 : 1
                                }}
                            />
                            <button
                                onClick={() => setShowEmojiPicker(prev => !prev)}
                                title={t('ui.emoji')}
                                style={{
                                    padding: '8px',
                                    background: showEmojiPicker
                                        ? (isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.08)')
                                        : (isDark ? 'rgba(255,255,255,0.05)' : '#f5f5f5'),
                                    border: `1px solid ${isDark ? 'rgba(255,255,255,0.1)' : '#ddd'}`,
                                    borderRadius: '6px',
                                    fontSize: '14px',
                                    cursor: 'pointer',
                                    lineHeight: 1
                                }}
                            >
                                😀
                            </button>
                            <button
                                onClick={handleSendChat}
                                style={{
                                    padding: '8px 12px',
                                    background: ac,
                                    border: 'none',
                                    borderRadius: '6px',
                                    color: '#fff',
                                    fontSize: '10px',
                                    fontWeight: 'bold',
                                    cursor: 'pointer'
                                }}
                            >
                                SEND
                            </button>
                        </div>
                    </>
                )}
            </div>
            )}

            {/* Shared Library */}
            <div style={{
                padding: '15px',
                background: collab.sharedLibraryEnabled
                    ? (isDark ? 'rgba(57,255,20,0.04)' : 'rgba(57,255,20,0.06)')
                    : (isDark ? 'rgba(255,255,255,0.02)' : 'rgba(0,0,0,0.02)'),
                borderRadius: '8px',
                border: `1px solid ${collab.sharedLibraryEnabled ? 'rgba(57,255,20,0.15)' : (isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)')}`
            }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                    <span style={{ fontSize: '11px', fontWeight: 'bold', color: isDark ? '#aaa' : '#666', letterSpacing: '0.5px' }}>SHARED LIBRARY</span>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        {collab.sharedLibraryStatus === 'syncing' && (
                            <span style={{ fontSize: '9px', color: acSec, fontWeight: 'bold' }}>SYNCING...</span>
                        )}
                        {collab.sharedLibraryStatus === 'synced' && (
                            <span style={{ fontSize: '9px', color: '#39ff14', fontWeight: 'bold' }}>SYNCED</span>
                        )}
                        <input
                            type="checkbox"
                            checked={collab.sharedLibraryEnabled}
                            onChange={(e) => collab.setSharedLibrary(e.target.checked)}
                            style={{ accentColor: ac, cursor: 'pointer' }}
                        />
                    </div>
                </div>
                <div style={{ fontSize: '9px', color: isDark ? '#555' : '#999', marginBottom: '6px' }}>
                    {collab.sharedLibraryEnabled
                        ? "Syncing peer samples — they'll be saved with your project"
                        : "Enable to receive collaborator samples for saving"}
                </div>
                {/* Show peer instrument counts */}
                {Object.keys(collab.peerLibraries).length > 0 && (
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', marginTop: '6px' }}>
                        {Object.entries(collab.peerLibraries).map(([pid, lib]) => {
                            const peer = collab.peers[pid];
                            const name = peer?.profile?.email?.split('@')[0] || peer?.profile?.name || pid.slice(-4);
                            const count = lib.instruments?.length || 0;
                            return count > 0 ? (
                                <span key={pid} style={{
                                    fontSize: '8px',
                                    padding: '2px 6px',
                                    borderRadius: '8px',
                                    background: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.05)',
                                    color: peer?.color || (isDark ? '#aaa' : '#666')
                                }}>
                                    {name}: {count} inst
                                </span>
                            ) : null;
                        })}
                    </div>
                )}
                {/* Manual sync button */}
                {collab.sharedLibraryEnabled && (
                    <button
                        onClick={() => collab.setSharedLibrary(true)}
                        style={{
                            marginTop: '8px',
                            width: '100%',
                            padding: '6px',
                            background: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.04)',
                            border: `1px solid ${isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.08)'}`,
                            borderRadius: '6px',
                            color: isDark ? '#aaa' : '#666',
                            fontSize: '9px',
                            fontWeight: 'bold',
                            cursor: 'pointer'
                        }}
                    >
                        RE-SYNC SAMPLES
                    </button>
                )}
            </div>

            {/* Free-for-All Mode (Host Only) */}
            {collab.isHost && (
                <div style={{
                    padding: '12px 15px',
                    background: collab.freeForAll
                        ? (isDark ? 'rgba(57,255,20,0.06)' : 'rgba(57,255,20,0.08)')
                        : (isDark ? 'rgba(255,255,255,0.02)' : 'rgba(0,0,0,0.02)'),
                    borderRadius: '8px',
                    border: `1px solid ${collab.freeForAll ? 'rgba(57,255,20,0.2)' : (isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)')}`
                }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div>
                            <div style={{ fontSize: '11px', fontWeight: 'bold', color: isDark ? '#ccc' : '#444', marginBottom: '2px' }}>
                                {collab.freeForAll ? '🔓 FREE-FOR-ALL' : '🔒 TAB LOCKING'}
                            </div>
                            <div style={{ fontSize: '9px', color: isDark ? '#666' : '#999' }}>
                                {collab.freeForAll ? 'Anyone can edit any tab' : 'Tabs are locked to owners'}
                            </div>
                        </div>
                        <button
                            onClick={collab.toggleFreeForAll}
                            style={{
                                padding: '5px 12px',
                                background: collab.freeForAll ? 'rgba(57,255,20,0.15)' : (isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)'),
                                border: `1px solid ${collab.freeForAll ? 'rgba(57,255,20,0.3)' : (isDark ? 'rgba(255,255,255,0.1)' : '#ddd')}`,
                                borderRadius: '12px',
                                color: collab.freeForAll ? '#39ff14' : (isDark ? '#aaa' : '#666'),
                                fontSize: '9px',
                                fontWeight: 'bold',
                                cursor: 'pointer',
                                transition: 'all 0.2s'
                            }}
                        >
                            {collab.freeForAll ? 'LOCK TABS' : 'UNLOCK ALL'}
                        </button>
                    </div>
                </div>
            )}

            {/* Permission Matrix (Host Only) */}
            {collab.isHost && Object.keys(collab.peers).length > 0 && (
                <div style={{
                    padding: '12px 15px',
                    background: isDark ? 'rgba(255,255,255,0.02)' : 'rgba(0,0,0,0.02)',
                    borderRadius: '8px',
                    border: `1px solid ${isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)'}`
                }}>
                    <div style={{ fontSize: '9px', color: isDark ? '#666' : '#999', letterSpacing: '1px', marginBottom: '10px', fontWeight: 'bold' }}>
                        {t('collab.permissionMatrix')}
                    </div>
                    {(() => {
                        const permKeys = [
                            { key: 'canEditDrums', label: t('collab.permEditDrums') },
                            { key: 'canEditChords', label: t('collab.permEditChords') },
                            { key: 'canEditMelody', label: t('collab.permEditMelody') },
                            { key: 'canEditBass', label: t('collab.permEditBass') },
                            { key: 'canEditLyrics', label: t('collab.permEditLyrics') },
                            { key: 'canEditLyricEngine', label: t('collab.permEditLyricEngine') },
                            { key: 'canEditBrowser', label: t('collab.permEditBrowser') },
                            { key: 'canEditMixer', label: t('collab.permEditMixer') },
                            { key: 'canEditArrange', label: t('collab.permEditArrange') },
                            { key: 'canEditDrumSynth', label: t('collab.permEditDrumSynth') },
                            { key: 'canEditInstSynth', label: t('collab.permEditInstSynth') },
                            { key: 'canChangeTempo', label: t('collab.permChangeTempo') },
                            { key: 'canExport', label: t('collab.permExport') },
                        ];
                        const defaultPerms = collab.DEFAULT_PERMISSIONS;
                        return Object.entries(collab.peers).map(([id, peer]) => {
                            const perms = { ...defaultPerms, ...collab.peerPermissions[id] };
                            const shortName = (collab.peerDisplayNames && collab.peerDisplayNames[id]) || peer.profile?.name || id.slice(-4);
                            return (
                                <div key={id} style={{ marginBottom: '10px' }}>
                                    <div style={{ fontSize: '10px', fontWeight: 'bold', color: peer.color || ac, marginBottom: '6px' }}>
                                        {shortName}
                                    </div>
                                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '4px' }}>
                                        {permKeys.map(({ key, label }) => {
                                            const enabled = perms[key];
                                            return (
                                                <button
                                                    key={key}
                                                    onClick={() => collab.updatePeerPermission(id, key, !enabled)}
                                                    style={{
                                                        padding: '4px 8px',
                                                        fontSize: '8px',
                                                        fontWeight: 'bold',
                                                        background: enabled
                                                            ? (isDark ? 'rgba(57,255,20,0.1)' : 'rgba(57,255,20,0.12)')
                                                            : (isDark ? 'rgba(255,75,75,0.1)' : 'rgba(255,75,75,0.08)'),
                                                        border: `1px solid ${enabled ? 'rgba(57,255,20,0.3)' : 'rgba(255,75,75,0.3)'}`,
                                                        borderRadius: '4px',
                                                        color: enabled ? '#39ff14' : '#ff4b4b',
                                                        cursor: 'pointer',
                                                        textAlign: 'left',
                                                        transition: 'all 0.15s'
                                                    }}
                                                >
                                                    {enabled ? '✓' : '✕'} {label}
                                                </button>
                                            );
                                        })}
                                    </div>
                                </div>
                            );
                        });
                    })()}
                </div>
            )}

            {/* Share Workspace */}
            <button
                onClick={collab.shareScreen}
                style={{
                    padding: '12px',
                    background: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.04)',
                    border: `1px solid ${isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)'}`,
                    borderRadius: '8px',
                    color: isDark ? '#fff' : '#333',
                    fontSize: '11px',
                    fontWeight: 'bold',
                    cursor: 'pointer'
                }}
            >
                🖥 SHARE MY WORKSPACE
            </button>

            {/* Live View */}
            {collab.activeStream && (
                <div style={{ borderTop: `1px solid ${isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)'}`, paddingTop: '20px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                        <h4 style={{ fontSize: '11px', margin: 0, color: '#39ff14' }}>LIVE VIEW: {collab.peers[collab.activeStream]?.profile?.name || collab.activeStream}</h4>
                        <button onClick={() => collab.setActiveStream(null)} style={{ background: 'none', border: 'none', color: '#f44', cursor: 'pointer', fontSize: '12px' }}>STOP VIEWING</button>
                    </div>
                    <div style={{ width: '100%', borderRadius: '8px', overflow: 'hidden', background: '#000', boxShadow: '0 5px 20px rgba(0,0,0,0.5)' }}>
                        <video
                            autoPlay
                            playsInline
                            ref={v => v && (v.srcObject = collab.remoteStreams[collab.activeStream])}
                            style={{ width: '100%', display: 'block' }}
                        />
                    </div>
                </div>
            )}

            {/* Test Mode */}
            <div style={{
                padding: '12px',
                background: collab.testModeActive
                    ? (isDark ? 'rgba(79, 172, 254, 0.1)' : 'rgba(79, 172, 254, 0.06)')
                    : (isDark ? 'rgba(255,255,255,0.02)' : 'rgba(0,0,0,0.02)'),
                border: `1px solid ${collab.testModeActive ? '#4facfe' : (isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)')}`,
                borderRadius: '8px'
            }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                        <div style={{ fontSize: '9px', color: isDark ? '#666' : '#999', letterSpacing: '1px', marginBottom: '4px' }}>TEST MODE</div>
                        <div style={{ fontSize: '10px', color: isDark ? '#888' : '#666' }}>
                            {collab.testModeActive ? 'Simulated peer active' : 'Add a simulated peer for testing'}
                        </div>
                    </div>
                    <button
                        onClick={() => collab.testModeActive ? collab.disableTestMode() : collab.enableTestMode()}
                        style={{
                            padding: '6px 12px',
                            background: collab.testModeActive
                                ? 'rgba(255, 75, 75, 0.15)'
                                : 'rgba(79, 172, 254, 0.15)',
                            border: `1px solid ${collab.testModeActive ? '#ff4b4b' : '#4facfe'}`,
                            borderRadius: '6px',
                            color: collab.testModeActive ? '#ff4b4b' : '#4facfe',
                            fontSize: '10px',
                            fontWeight: 'bold',
                            cursor: 'pointer'
                        }}
                    >
                        {collab.testModeActive ? 'STOP TEST' : 'START TEST'}
                    </button>
                </div>
            </div>
        </div>
    );
}

export default CollabPanel;
