import React, { useState, useEffect, useRef, useCallback } from 'react';
import { hexToRgba } from './accentThemes';
import { useTranslation } from './i18n/I18nContext.jsx';

const TOUR_STEPS = [
    {
        target: 'tour-welcome',
        titleKey: 'tour.welcome',
        descKey: 'tour.welcomeDesc',
        actionKey: 'tour.welcomeAction',
        preview: 'welcome',
    },
    {
        target: 'tour-genre',
        titleKey: 'tour.chooseGenre',
        descKey: 'tour.chooseGenreDesc',
        actionKey: 'tour.chooseGenreAction',
        preview: 'genre',
    },
    {
        target: 'tour-mood',
        titleKey: 'tour.setMood',
        descKey: 'tour.setMoodDesc',
        actionKey: 'tour.setMoodAction',
        preview: 'mood',
    },
    {
        target: 'tour-key-scale',
        titleKey: 'tour.setKeyScale',
        descKey: 'tour.setKeyScaleDesc',
        actionKey: 'tour.setKeyScaleAction',
        preview: 'keyscale',
    },
    {
        target: 'tour-bpm',
        titleKey: 'tour.adjustTempo',
        descKey: 'tour.adjustTempoDesc',
        actionKey: 'tour.adjustTempoAction',
        preview: 'bpm',
    },
    {
        target: 'tour-bars-res',
        titleKey: 'tour.barsGrid',
        descKey: 'tour.barsGridDesc',
        actionKey: 'tour.barsGridAction',
        preview: 'barsres',
        requiredTab: 'drums',
    },
    {
        target: 'tour-global-gen',
        titleKey: 'tour.generateEverything',
        descKey: 'tour.generateEverythingDesc',
        actionKey: 'tour.generateEverythingAction',
        preview: 'generate',
        requiredTab: 'drums',
    },
    {
        target: 'tour-groove-gen',
        titleKey: 'tour.perTrackGenerate',
        descKey: 'tour.perTrackGenerateDesc',
        actionKey: 'tour.perTrackGenerateAction',
        preview: 'groovegen',
        requiredTab: 'drums',
    },
    {
        target: 'tour-tabs',
        titleKey: 'tour.navigateTracks',
        descKey: 'tour.navigateTracksDesc',
        actionKey: 'tour.navigateTracksAction',
        preview: 'tabs',
    },
    {
        target: 'tour-export',
        titleKey: 'tour.exportTrack',
        descKey: 'tour.exportTrackDesc',
        actionKey: 'tour.exportTrackAction',
        preview: 'export',
        requiredTab: 'drums',
    },
    {
        target: 'tour-browser',
        titleKey: 'tour.fileExplorer',
        descKey: 'tour.fileExplorerDesc',
        actionKey: 'tour.fileExplorerAction',
        preview: 'browser',
    },
    {
        target: 'tour-playback',
        titleKey: 'tour.playbackControls',
        descKey: 'tour.playbackControlsDesc',
        actionKey: 'tour.playbackControlsAction',
        preview: 'playback',
    },
    {
        target: 'tour-theme',
        titleKey: 'tour.lightDarkTheme',
        descKey: 'tour.lightDarkThemeDesc',
        actionKey: 'tour.lightDarkThemeAction',
        preview: 'theme',
    },
    {
        target: 'tour-collab',
        titleKey: 'tour.collaboration',
        descKey: 'tour.collaborationDesc',
        actionKey: 'tour.collaborationAction',
        preview: 'collab',
    },
    {
        target: 'tour-shortcuts',
        titleKey: 'tour.keyboardShortcuts',
        descKey: 'tour.keyboardShortcutsDesc',
        actionKey: 'tour.keyboardShortcutsAction',
        preview: 'shortcuts',
    },
];

// Single theme preview panel
function PreviewPanel({ type, dark, ac = '#ff6b6b', acSec = '#ff9f43', acGrad = 'linear-gradient(135deg, #ff6b6b, #ff9f43)', t }) {
    const bg = dark ? 'rgba(0,0,0,0.4)' : 'rgba(240,240,245,0.95)';
    const border = dark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)';
    const mutedText = dark ? '#555' : '#999';
    const subText = dark ? '#888' : '#666';
    const cardBg = dark ? '#2a2a3e' : '#e8e8f0';
    const cardBorder = dark ? '#444' : '#ccc';
    const textColor = dark ? '#fff' : '#222';
    const faintBg = dark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.04)';
    const faintBorder = dark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)';

    const previewStyle = {
        flex: 1,
        minWidth: 0,
        height: '65px',
        borderRadius: '6px',
        background: bg,
        border: `1px solid ${border}`,
        overflow: 'hidden',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        position: 'relative',
        transform: 'scale(1)',
    };
    const innerScale = { transform: 'scale(0.85)', transformOrigin: 'center center' };
    const labelStyle = { position: 'absolute', bottom: '3px', right: '6px', fontSize: '7px', color: mutedText, letterSpacing: '0.5px' };

    const previews = {
        welcome: (
            <div style={previewStyle}>
                <div style={{ ...innerScale, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px' }}>
                    <div style={{ fontSize: '18px' }}>🎵</div>
                    <div style={{ fontSize: '8px', fontWeight: '900', color: ac, letterSpacing: '1px' }}>FREALLY STUDIO</div>
                    <div style={{ display: 'flex', gap: '2px' }}>
                        {['🥁', '🎹', '🎸', '🎵'].map((e, i) => (
                            <span key={i} style={{ fontSize: '8px' }}>{e}</span>
                        ))}
                    </div>
                </div>
                <div style={labelStyle}>{t('tour.previewWelcome')}</div>
            </div>
        ),
        genre: (
            <div style={previewStyle}>
                <div style={{ ...innerScale, display: 'flex', gap: '4px', alignItems: 'center' }}>
                    <div style={{ background: cardBg, borderRadius: '3px', padding: '4px 8px', border: `1px solid ${cardBorder}`, display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <span style={{ fontSize: '9px', color: textColor, fontWeight: 'bold' }}>Lo-Fi Hip-Hop</span>
                        <span style={{ fontSize: '8px', color: subText }}>▼</span>
                    </div>
                    <div style={{ fontSize: '12px', opacity: 0.4, color: dark ? '#fff' : '#000' }}>→</div>
                    <div style={{ display: 'flex', gap: '2px' }}>
                        {['🥁', '🎹', '🎵'].map((e, i) => (
                            <div key={i} style={{ background: dark ? hexToRgba(ac, 0.15) : hexToRgba(ac, 0.1), borderRadius: '3px', padding: '2px 4px', fontSize: '10px' }}>{e}</div>
                        ))}
                    </div>
                </div>
                <div style={labelStyle}>{t('tour.previewGenre')}</div>
            </div>
        ),
        mood: (
            <div style={previewStyle}>
                <div style={{ ...innerScale, display: 'flex', gap: '3px', alignItems: 'center' }}>
                    <div style={{ background: cardBg, borderRadius: '3px', padding: '4px 8px', border: `1px solid ${cardBorder}`, display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <span style={{ fontSize: '9px', color: textColor, fontWeight: 'bold' }}>Dark</span>
                        <span style={{ fontSize: '8px', color: subText }}>▼</span>
                    </div>
                    <div style={{ fontSize: '10px', opacity: 0.4, color: dark ? '#fff' : '#000' }}>→</div>
                    <div style={{ display: 'flex', gap: '2px', flexWrap: 'wrap', maxWidth: '80px' }}>
                        {['🌙', '⚡', '😢'].map((e, i) => (
                            <div key={i} style={{ background: dark ? 'rgba(147,112,219,0.15)' : 'rgba(147,112,219,0.1)', borderRadius: '3px', padding: '2px 4px', fontSize: '9px' }}>{e}</div>
                        ))}
                    </div>
                </div>
                <div style={labelStyle}>{t('tour.previewMood')}</div>
            </div>
        ),
        keyscale: (
            <div style={previewStyle}>
                <div style={{ ...innerScale, display: 'flex', gap: '6px', alignItems: 'center' }}>
                    <div style={{ display: 'flex', gap: '1px' }}>
                        {['C', 'D', 'E', 'F', 'G', 'A', 'B'].map((n, i) => (
                            <div key={i} style={{
                                width: '14px', height: '32px', background: i === 0 ? ac : (dark ? '#e0e0e0' : '#fff'),
                                borderRadius: '0 0 2px 2px', display: 'flex', alignItems: 'flex-end',
                                justifyContent: 'center', paddingBottom: '2px', fontSize: '6px',
                                color: i === 0 ? '#fff' : subText, fontWeight: 'bold',
                                border: `1px solid ${dark ? 'rgba(0,0,0,0.1)' : 'rgba(0,0,0,0.15)'}`
                            }}>{n}</div>
                        ))}
                    </div>
                    <div style={{ fontSize: '8px', color: ac, fontWeight: 'bold', background: hexToRgba(ac, 0.1), padding: '3px 6px', borderRadius: '3px', border: `1px solid ${hexToRgba(ac, 0.3)}`, whiteSpace: 'nowrap' }}>
                        C Min
                    </div>
                </div>
                <div style={labelStyle}>{t('tour.previewKeyScale')}</div>
            </div>
        ),
        bpm: (
            <div style={previewStyle}>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: '3px' }}>
                    <span style={{ fontSize: '24px', fontWeight: '900', color: ac, fontFamily: 'monospace' }}>140</span>
                    <span style={{ fontSize: '8px', color: subText, fontWeight: 'bold', letterSpacing: '0.5px' }}>BPM</span>
                </div>
                <div style={{ position: 'absolute', bottom: '6px', left: '50%', transform: 'translateX(-50%)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <span style={{ fontSize: '7px', color: mutedText }}>◀ {t('tour.previewDrag')}</span>
                    <div style={{ width: '40px', height: '2px', background: acGrad, borderRadius: '1px' }} />
                    <span style={{ fontSize: '7px', color: mutedText }}>{t('tour.previewDrag')} ▶</span>
                </div>
                <div style={labelStyle}>{t('tour.previewTempo')}</div>
            </div>
        ),
        barsres: (
            <div style={previewStyle}>
                <div style={{ ...innerScale, display: 'flex', gap: '4px', alignItems: 'center' }}>
                    <div style={{ display: 'flex', gap: '2px' }}>
                        {[4, 8].map((b, i) => (
                            <div key={i} style={{
                                padding: '3px 6px', borderRadius: '3px', fontSize: '8px', fontWeight: '900',
                                background: i === 0 ? (dark ? hexToRgba(ac, 0.15) : hexToRgba(ac, 0.1)) : faintBg,
                                color: i === 0 ? ac : mutedText,
                                border: i === 0 ? `1px solid ${hexToRgba(ac, 0.3)}` : `1px solid ${faintBorder}`
                            }}>{b}</div>
                        ))}
                        <span style={{ fontSize: '7px', color: mutedText, alignSelf: 'center' }}>{t('tour.previewBars')}</span>
                    </div>
                    <div style={{ width: '1px', height: '16px', background: faintBorder }} />
                    <div style={{ display: 'flex', gap: '2px' }}>
                        {['1/4', '1/8', '1/16', '1/32'].map((r, i) => (
                            <div key={i} style={{
                                padding: '3px 4px', borderRadius: '3px', fontSize: '6px', fontWeight: '800',
                                background: i === 2 ? (dark ? hexToRgba(ac, 0.15) : hexToRgba(ac, 0.1)) : faintBg,
                                color: i === 2 ? ac : mutedText,
                                border: i === 2 ? `1px solid ${hexToRgba(ac, 0.3)}` : `1px solid ${faintBorder}`
                            }}>{r}</div>
                        ))}
                    </div>
                </div>
                <div style={labelStyle}>{t('tour.previewBarsRes')}</div>
            </div>
        ),
        generate: (
            <div style={previewStyle}>
                <div style={{ ...innerScale, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px' }}>
                    <div style={{
                        background: dark ? hexToRgba(ac, 0.15) : hexToRgba(ac, 0.08), border: `1px solid ${ac}`,
                        borderRadius: '4px', padding: '4px 10px', color: ac,
                        fontSize: '9px', fontWeight: '900', letterSpacing: '0.3px',
                        boxShadow: `0 0 10px ${hexToRgba(ac, 0.2)}`
                    }}>
                        ✨ GLOBAL GEN
                    </div>
                    <div style={{ display: 'flex', gap: '2px' }}>
                        {[1, 2, 3, 4].map(i => (
                            <div key={i} style={{ display: 'flex', flexDirection: 'column', gap: '1px' }}>
                                {[1, 2, 3].map(j => (
                                    <div key={j} style={{
                                        width: '10px', height: '3px', borderRadius: '1px',
                                        background: ((i + j) % 2 === 0) ? hexToRgba(ac, 0.3 + (i * 0.1)) : faintBg
                                    }} />
                                ))}
                            </div>
                        ))}
                    </div>
                </div>
                <div style={labelStyle}>{t('tour.previewAiGen')}</div>
            </div>
        ),
        groovegen: (
            <div style={previewStyle}>
                <div style={{ ...innerScale, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px' }}>
                    <div style={{
                        background: dark ? hexToRgba(ac, 0.1) : hexToRgba(ac, 0.06), border: `1px solid ${ac}`,
                        borderRadius: '4px', padding: '3px 8px', color: ac,
                        fontSize: '8px', fontWeight: '900'
                    }}>
                        ✦ GENERATE GROOVE
                    </div>
                    <div style={{ display: 'flex', gap: '1px' }}>
                        {Array.from({ length: 16 }).map((_, i) => (
                            <div key={i} style={{
                                width: '4px', height: i % 4 === 0 ? '10px' : '6px', borderRadius: '1px',
                                background: i % 4 === 0 ? hexToRgba(ac, 0.5) : (i % 2 === 0 ? hexToRgba(ac, 0.2) : faintBg)
                            }} />
                        ))}
                    </div>
                    <span style={{ fontSize: '6px', color: mutedText }}>{t('tour.drumsOnly')}</span>
                </div>
                <div style={labelStyle}>{t('tour.previewPerTrack')}</div>
            </div>
        ),
        tabs: (
            <div style={previewStyle}>
                <div style={{ ...innerScale, display: 'flex', gap: '1px', flexWrap: 'wrap', justifyContent: 'center', padding: '0 2px' }}>
                    {['DRM', 'CHD', 'MEL', 'BAS', 'MIX', 'ARR', 'D.S', 'I.S'].map((tab, i) => (
                        <div key={i} style={{
                            padding: '3px 4px', borderRadius: '3px', fontSize: '6px', fontWeight: '800',
                            letterSpacing: '0.3px', cursor: 'default',
                            background: i === 0 ? (dark ? hexToRgba(ac, 0.15) : hexToRgba(ac, 0.1)) : 'transparent',
                            color: i === 0 ? ac : mutedText,
                            border: i === 0 ? `1px solid ${hexToRgba(ac, 0.3)}` : '1px solid transparent'
                        }}>{tab}</div>
                    ))}
                </div>
                <div style={labelStyle}>{t('tour.previewTabs')}</div>
            </div>
        ),
        export: (
            <div style={previewStyle}>
                <div style={{ ...innerScale, display: 'flex', gap: '4px', alignItems: 'center' }}>
                    <div style={{
                        background: dark ? hexToRgba(ac, 0.1) : hexToRgba(ac, 0.06), border: `1px solid ${hexToRgba(ac, 0.3)}`,
                        borderRadius: '4px', padding: '3px 8px', color: ac,
                        fontSize: '8px', fontWeight: '900', whiteSpace: 'nowrap'
                    }}>💾 EXPORT</div>
                    <div style={{ fontSize: '10px', opacity: 0.3, color: dark ? '#fff' : '#000' }}>→</div>
                    <div style={{ display: 'flex', gap: '2px' }}>
                        {['WAV', 'MP3', 'MID'].map((fmt, i) => (
                            <div key={i} style={{
                                padding: '2px 5px', borderRadius: '3px', fontSize: '6px', fontWeight: 'bold',
                                background: i === 0 ? acSec : faintBg,
                                color: i === 0 ? '#000' : subText,
                                border: `1px solid ${i === 0 ? acSec : faintBorder}`
                            }}>{fmt}</div>
                        ))}
                    </div>
                </div>
                <div style={labelStyle}>{t('tour.previewExport')}</div>
            </div>
        ),
        browser: (
            <div style={previewStyle}>
                <div style={{ ...innerScale, display: 'flex', gap: '4px', alignItems: 'stretch', height: '50px' }}>
                    <div style={{ width: '60px', background: dark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.03)', borderRadius: '3px', border: `1px solid ${dark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)'}`, padding: '4px', overflow: 'hidden' }}>
                        <div style={{ fontSize: '6px', color: subText, fontWeight: 'bold', marginBottom: '2px' }}>{t('tour.samples')}</div>
                        {['Kick.wav', 'Snare.wav', 'HiHat.wav'].map((f, i) => (
                            <div key={i} style={{ fontSize: '5px', color: subText, padding: '1px 0', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>📄 {f}</div>
                        ))}
                    </div>
                    <div style={{ fontSize: '10px', display: 'flex', alignItems: 'center', opacity: 0.3, color: dark ? '#fff' : '#000' }}>→</div>
                    <div style={{ width: '40px', background: dark ? hexToRgba(ac, 0.05) : hexToRgba(ac, 0.04), borderRadius: '3px', border: `1px dashed ${hexToRgba(ac, 0.3)}`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <span style={{ fontSize: '6px', color: ac, textAlign: 'center' }}>{t('tour.dropHere')}</span>
                    </div>
                </div>
                <div style={labelStyle}>{t('tour.previewBrowser')}</div>
            </div>
        ),
        playback: (
            <div style={previewStyle}>
                <div style={{ ...innerScale, display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <div style={{ display: 'flex', gap: '3px' }}>
                        <div style={{ width: '20px', height: '20px', borderRadius: '50%', background: 'rgba(255,159,67,0.15)', border: `1px solid ${acSec}`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            <span style={{ fontSize: '8px', color: acSec, marginLeft: '1px' }}>▶</span>
                        </div>
                        <div style={{ width: '20px', height: '20px', borderRadius: '50%', background: faintBg, border: `1px solid ${faintBorder}`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            <span style={{ fontSize: '8px', color: subText }}>⏹</span>
                        </div>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                        <div style={{ width: '60px', height: '3px', background: faintBorder, borderRadius: '2px', overflow: 'hidden' }}>
                            <div style={{ width: '35%', height: '100%', background: acSec, borderRadius: '2px' }} />
                        </div>
                        <span style={{ fontSize: '7px', color: subText, fontFamily: 'monospace' }}>BAR 2.3</span>
                    </div>
                    <span style={{ fontSize: '7px', color: acSec, fontWeight: 'bold' }}>{t('tour.space')}</span>
                </div>
                <div style={labelStyle}>{t('tour.previewTransport')}</div>
            </div>
        ),
        theme: (
            <div style={previewStyle}>
                <div style={{ ...innerScale, display: 'flex', gap: '6px', alignItems: 'center' }}>
                    <div style={{
                        width: '28px', height: '28px', borderRadius: '50%',
                        background: dark ? '#2a2a3e' : '#f0f0f0', border: `1px solid ${dark ? '#555' : '#ccc'}`,
                        display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '14px'
                    }}>
                        {dark ? '☀️' : '🌙'}
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                        <span style={{ fontSize: '7px', fontWeight: 'bold', color: dark ? acSec : ac }}>
                            {dark ? t('tour.switchToLight') : t('tour.switchToDark')}
                        </span>
                        <span style={{ fontSize: '6px', color: mutedText }}>{t('tour.savedAuto')}</span>
                    </div>
                </div>
                <div style={labelStyle}>{t('tour.previewTheme')}</div>
            </div>
        ),
        collab: (
            <div style={previewStyle}>
                <div style={{ ...innerScale, display: 'flex', gap: '4px', alignItems: 'center' }}>
                    <div style={{
                        width: '24px', height: '24px', borderRadius: '50%',
                        background: ac, display: 'flex', alignItems: 'center',
                        justifyContent: 'center', fontSize: '12px'
                    }}>👥</div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                        <span style={{ fontSize: '7px', fontWeight: 'bold', color: textColor }}>{t('tour.p2pRoom')}</span>
                        <div style={{ display: 'flex', gap: '2px' }}>
                            <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#39ff14' }} />
                            <span style={{ fontSize: '6px', color: '#39ff14' }}>{t('tour.live')}</span>
                        </div>
                    </div>
                </div>
                <div style={labelStyle}>{t('tour.previewCollab')}</div>
            </div>
        ),
        shortcuts: (
            <div style={previewStyle}>
                <div style={{ ...innerScale, display: 'flex', gap: '4px', alignItems: 'center' }}>
                    <div style={{
                        width: '22px', height: '22px', borderRadius: '50%',
                        border: `1px solid ${dark ? '#555' : '#ccc'}`, display: 'flex',
                        alignItems: 'center', justifyContent: 'center',
                        fontSize: '11px', fontWeight: 'bold', color: ac
                    }}>?</div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                        <div style={{ display: 'flex', gap: '2px' }}>
                            {['G', 'Space', '1-8'].map((k, i) => (
                                <div key={i} style={{
                                    padding: '2px 4px', borderRadius: '2px', fontSize: '6px',
                                    fontWeight: 'bold', background: dark ? '#2a2a3e' : '#e8e8f0',
                                    color: textColor, border: `1px solid ${cardBorder}`,
                                    fontFamily: 'monospace'
                                }}>{k}</div>
                            ))}
                        </div>
                        <span style={{ fontSize: '6px', color: mutedText }}>{t('tour.shortcuts40')}</span>
                    </div>
                </div>
                <div style={labelStyle}>{t('tour.previewKeys')}</div>
            </div>
        ),
    };

    return previews[type] || null;
}

// Wrapper that shows both dark and light previews side by side
function StepPreview({ type, isDark, ac, acSec, acGrad, t }) {
    return (
        <div style={{ marginBottom: '12px', width: '100%', overflow: 'hidden' }}>
            <div style={{ display: 'flex', gap: '6px', width: '100%' }}>
                <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: '3px' }}>
                    <span style={{ fontSize: '8px', fontWeight: 'bold', color: isDark ? '#555' : '#999', letterSpacing: '1px', textAlign: 'center' }}>{t('tour.previewDark')}</span>
                    <PreviewPanel type={type} dark={true} ac={ac} acSec={acSec} acGrad={acGrad} t={t} />
                </div>
                <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: '3px' }}>
                    <span style={{ fontSize: '8px', fontWeight: 'bold', color: isDark ? '#555' : '#999', letterSpacing: '1px', textAlign: 'center' }}>{t('tour.previewLight')}</span>
                    <PreviewPanel type={type} dark={false} ac={ac} acSec={acSec} acGrad={acGrad} t={t} />
                </div>
            </div>
        </div>
    );
}

const STORAGE_KEY = 'freally_tour_completed';
const STORAGE_DONT_SHOW_KEY = 'freally_tour_dont_show';

export function OnboardingTour({ isOpen, onClose, theme, onBrowserVisibility, onTabChange, accentColors }) {
    const { t } = useTranslation();
    const isDark = theme === 'dark';
    const ac = accentColors?.accent || '#ff6b6b';
    const acSec = accentColors?.secondary || '#ff9f43';
    const acGrad = accentColors?.gradient || 'linear-gradient(135deg, #ff6b6b, #ff9f43)';
    const [currentStep, setCurrentStep] = useState(0);
    const [targetRect, setTargetRect] = useState(null);
    const [tooltipPos, setTooltipPos] = useState({ top: 0, left: 0 });
    const [isVisible, setIsVisible] = useState(false);
    const [dontShowAgain, setDontShowAgain] = useState(false);
    const [isExiting, setIsExiting] = useState(false);
    const tooltipRef = useRef(null);
    const resizeTimer = useRef(null);
    const prevBrowserVisible = useRef(null);

    const step = TOUR_STEPS[currentStep];

    // Theme-derived colors
    const tooltipBg = isDark ? '#1a1a2e' : '#ffffff';
    const tooltipBorder = isDark ? hexToRgba(ac, 0.25) : hexToRgba(ac, 0.3);
    const tooltipShadow = isDark
        ? `0 20px 60px rgba(0,0,0,0.6), 0 0 30px ${hexToRgba(ac, 0.1)}`
        : `0 20px 60px rgba(0,0,0,0.15), 0 0 30px ${hexToRgba(ac, 0.08)}`;
    const titleColor = isDark ? '#fff' : '#1a1a2e';
    const descColor = isDark ? '#aaa' : '#555';
    const mutedColor = isDark ? '#555' : '#999';
    const btnSecBg = isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.04)';
    const btnSecBorder = isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)';
    const btnSecColor = isDark ? '#888' : '#666';
    const btnSecHoverBg = isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.08)';
    const btnSecHoverColor = isDark ? '#fff' : '#222';
    const checkboxLabel = isDark ? '#555' : '#888';
    const dividerColor = isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.06)';
    const actionBg = isDark ? hexToRgba(ac, 0.08) : hexToRgba(ac, 0.06);
    const actionBorder = isDark ? hexToRgba(ac, 0.15) : hexToRgba(ac, 0.15);
    const overlayDim = isDark ? 'rgba(0, 0, 0, 0.75)' : 'rgba(0, 0, 0, 0.55)';
    const dotInactive = isDark ? 'rgba(255, 255, 255, 0.15)' : 'rgba(0, 0, 0, 0.12)';
    const dotVisited = hexToRgba(ac, 0.4);
    const closeColor = isDark ? '#555' : '#aaa';
    const closeHoverColor = isDark ? '#fff' : '#333';

    // Switch tabs when a step requires it
    useEffect(() => {
        if (!isOpen || !step?.requiredTab || !onTabChange) return;
        // Small delay to let DOM settle after tab switch
        const tabTimer = setTimeout(() => onTabChange(step.requiredTab), 50);
        return () => clearTimeout(tabTimer);
    }, [isOpen, currentStep, step, onTabChange]);

    // Find and highlight the target element
    const updateTarget = useCallback(() => {
        if (!step || !isOpen) return;

        // Steps with no target get centered
        if (!step.target) {
            setTargetRect({
                top: window.innerHeight / 2 - 30,
                left: window.innerWidth / 2 - 60,
                width: 120,
                height: 60,
            });
            return;
        }

        const el = document.querySelector(`[data-tour-id="${step.target}"]`);
        if (el) {
            // Scroll element into view first to handle elements in scrollable containers
            el.scrollIntoView({ block: 'nearest', inline: 'nearest', behavior: 'instant' });

            // Measure after layout settles using rAF
            requestAnimationFrame(() => {
                const rect = el.getBoundingClientRect();
                const padding = 8;
                setTargetRect({
                    top: rect.top - padding,
                    left: rect.left - padding,
                    width: rect.width + padding * 2,
                    height: rect.height + padding * 2,
                });
            });
        } else {
            setTargetRect({
                top: window.innerHeight / 2 - 30,
                left: window.innerWidth / 2 - 60,
                width: 120,
                height: 60,
            });
        }
    }, [step, isOpen]);

    // Position tooltip relative to target — uses actual measured height when available
    useEffect(() => {
        if (!targetRect || !isOpen) return;

        const tooltipWidth = 380;
        const measuredHeight = tooltipRef.current ? tooltipRef.current.getBoundingClientRect().height : 380;
        const tooltipHeight = Math.max(measuredHeight, 200);
        const gap = 16;

        let top, left;
        const spaceBelow = window.innerHeight - (targetRect.top + targetRect.height);
        const spaceAbove = targetRect.top;
        const spaceRight = window.innerWidth - (targetRect.left + targetRect.width);
        const spaceLeft = targetRect.left;

        if (spaceBelow > tooltipHeight + gap) {
            top = targetRect.top + targetRect.height + gap;
            left = targetRect.left + targetRect.width / 2 - tooltipWidth / 2;
        } else if (spaceAbove > tooltipHeight + gap) {
            top = targetRect.top - tooltipHeight - gap;
            left = targetRect.left + targetRect.width / 2 - tooltipWidth / 2;
        } else if (spaceRight > tooltipWidth + gap) {
            top = targetRect.top + targetRect.height / 2 - tooltipHeight / 2;
            left = targetRect.left + targetRect.width + gap;
        } else if (spaceLeft > tooltipWidth + gap) {
            top = targetRect.top + targetRect.height / 2 - tooltipHeight / 2;
            left = targetRect.left - tooltipWidth - gap;
        } else {
            top = window.innerHeight / 2 - tooltipHeight / 2;
            left = window.innerWidth / 2 - tooltipWidth / 2;
        }

        top = Math.max(12, Math.min(window.innerHeight - tooltipHeight - 12, top));
        left = Math.max(12, Math.min(window.innerWidth - tooltipWidth - 12, left));

        setTooltipPos({ top, left });
    }, [targetRect, isOpen, currentStep]);

    // Update on step change or resize — with extra delay for panel/tab transitions
    useEffect(() => {
        // All steps need at least 400ms to let the sidebar hide transition (300ms) complete.
        // Browser step needs even longer since the sidebar expands.
        // Tab-switching steps also get extra time for content rendering.
        const isBrowserStep = step?.target === 'tour-browser';
        const initialDelay = isBrowserStep ? 500 : (step?.requiredTab ? 450 : 400);
        const initialTimer = setTimeout(() => {
            updateTarget();
            // Re-measure after a short delay to catch any remaining layout shifts
            setTimeout(updateTarget, 250);
        }, initialDelay);

        const onResize = () => {
            clearTimeout(resizeTimer.current);
            resizeTimer.current = setTimeout(updateTarget, 100);
        };
        window.addEventListener('resize', onResize);
        window.addEventListener('scroll', updateTarget, true);
        return () => {
            clearTimeout(initialTimer);
            window.removeEventListener('resize', onResize);
            window.removeEventListener('scroll', updateTarget, true);
            clearTimeout(resizeTimer.current);
        };
    }, [updateTarget, step]);

    // Enter fullscreen when tour opens, close tour if user exits fullscreen
    const tourClosingRef = useRef(false);
    useEffect(() => {
        if (!isOpen) {
            tourClosingRef.current = false;
            return;
        }
        const el = document.documentElement;
        if (!document.fullscreenElement && el.requestFullscreen) {
            el.requestFullscreen().catch(() => {});
        }
        const onFullscreenChange = () => {
            // User exited fullscreen (e.g. via Escape) while tour is open — close tour
            if (!document.fullscreenElement && !tourClosingRef.current) {
                handleClose();
            }
        };
        document.addEventListener('fullscreenchange', onFullscreenChange);
        return () => document.removeEventListener('fullscreenchange', onFullscreenChange);
    }, [isOpen]);

    // Fade in on open
    useEffect(() => {
        if (isOpen) {
            setIsExiting(false);
            const fadeTimer = setTimeout(() => setIsVisible(true), 50);
            return () => clearTimeout(fadeTimer);
        } else {
            setIsVisible(false);
        }
    }, [isOpen]);

    // Control browser sidebar visibility — hide during tour, show only on browser step
    useEffect(() => {
        if (!onBrowserVisibility) return;
        if (isOpen) {
            if (prevBrowserVisible.current === null) {
                prevBrowserVisible.current = true;
            }
            const isBrowserStep = step?.target === 'tour-browser';
            onBrowserVisibility(isBrowserStep);
        }
    }, [isOpen, currentStep, onBrowserVisibility, step]);

    // Restore browser visibility when tour closes
    useEffect(() => {
        if (!isOpen && !isExiting && prevBrowserVisible.current !== null && onBrowserVisibility) {
            onBrowserVisibility(prevBrowserVisible.current);
            prevBrowserVisible.current = null;
        }
    }, [isOpen, isExiting, onBrowserVisibility]);

    // Keyboard navigation
    useEffect(() => {
        if (!isOpen) return;
        const handleKey = (e) => {
            if (e.key === 'Escape') handleClose();
            if (e.key === 'ArrowRight' || e.key === 'Enter') handleNext();
            if (e.key === 'ArrowLeft') handlePrev();
        };
        window.addEventListener('keydown', handleKey);
        return () => window.removeEventListener('keydown', handleKey);
    }, [isOpen, currentStep]);

    const handleNext = () => {
        if (currentStep < TOUR_STEPS.length - 1) {
            setCurrentStep(prev => prev + 1);
        } else {
            handleFinish();
        }
    };

    const handlePrev = () => {
        if (currentStep > 0) {
            setCurrentStep(prev => prev - 1);
        }
    };

    const handleGoToStep = (index) => {
        setCurrentStep(index);
    };

    const handleFinish = () => {
        localStorage.setItem(STORAGE_KEY, 'true');
        if (dontShowAgain) {
            localStorage.setItem(STORAGE_DONT_SHOW_KEY, 'true');
        }
        triggerClose();
    };

    const handleClose = () => {
        if (dontShowAgain) {
            localStorage.setItem(STORAGE_DONT_SHOW_KEY, 'true');
        }
        triggerClose();
    };

    const triggerClose = () => {
        tourClosingRef.current = true;
        setIsExiting(true);
        setIsVisible(false);
        // Exit fullscreen if we're still in it
        if (document.fullscreenElement) {
            document.exitFullscreen().catch(() => {});
        }
        setTimeout(() => {
            setCurrentStep(0);
            setIsExiting(false);
            onClose();
        }, 300);
    };

    if (!isOpen && !isExiting) return null;

    const isLastStep = currentStep === TOUR_STEPS.length - 1;
    const hasTarget = step.target !== null;

    return (
        <div style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            zIndex: 10000,
            pointerEvents: 'auto',
            transition: 'opacity 0.3s ease',
            opacity: isVisible ? 1 : 0,
        }}>
            {/* Overlay with cutout */}
            {targetRect && (
                <div
                    style={{
                        position: 'absolute',
                        top: targetRect.top,
                        left: targetRect.left,
                        width: targetRect.width,
                        height: targetRect.height,
                        borderRadius: '8px',
                        boxShadow: `0 0 0 9999px ${overlayDim}`,
                        transition: 'all 0.4s cubic-bezier(0.4, 0, 0.2, 1)',
                        zIndex: 10001,
                        pointerEvents: 'none',
                    }}
                />
            )}

            {/* Clickable backdrop */}
            <div
                onClick={handleClose}
                style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    right: 0,
                    bottom: 0,
                    zIndex: 10000,
                }}
            />

            {/* Pulsing ring around target (only when there's a real target element) */}
            {targetRect && hasTarget && (
                <div style={{
                    position: 'absolute',
                    top: targetRect.top - 4,
                    left: targetRect.left - 4,
                    width: targetRect.width + 8,
                    height: targetRect.height + 8,
                    borderRadius: '12px',
                    border: `2px solid ${hexToRgba(ac, 0.6)}`,
                    animation: 'tourPulse 2s infinite',
                    transition: 'all 0.4s cubic-bezier(0.4, 0, 0.2, 1)',
                    zIndex: 10002,
                    pointerEvents: 'none',
                }} />
            )}

            {/* Tooltip card */}
            <div
                ref={tooltipRef}
                style={{
                    position: 'absolute',
                    top: tooltipPos.top,
                    left: tooltipPos.left,
                    width: '380px',
                    maxWidth: 'calc(100vw - 24px)',
                    maxHeight: 'calc(100vh - 24px)',
                    background: tooltipBg,
                    border: `1px solid ${tooltipBorder}`,
                    borderRadius: '16px',
                    padding: '20px',
                    boxShadow: tooltipShadow,
                    zIndex: 10003,
                    transition: 'all 0.4s cubic-bezier(0.4, 0, 0.2, 1)',
                    overflow: 'hidden',
                    boxSizing: 'border-box',
                    display: 'flex',
                    flexDirection: 'column',
                }}
                onClick={(e) => e.stopPropagation()}
            >
                {/* Step counter + close */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <div style={{
                            background: hexToRgba(ac, 0.15),
                            border: `1px solid ${hexToRgba(ac, 0.3)}`,
                            borderRadius: '20px',
                            padding: '3px 10px',
                            fontSize: '10px',
                            fontWeight: 'bold',
                            color: ac,
                            letterSpacing: '0.5px',
                        }}>
                            {currentStep + 1} / {TOUR_STEPS.length}
                        </div>
                        <div style={{
                            fontSize: '9px',
                            color: mutedColor,
                            letterSpacing: '1px',
                            fontWeight: 'bold',
                        }}>
                            {t('tour.gettingStarted')}
                        </div>
                    </div>
                    <button
                        onClick={handleClose}
                        style={{
                            background: 'none',
                            border: 'none',
                            color: closeColor,
                            fontSize: '16px',
                            cursor: 'pointer',
                            padding: '2px 6px',
                            borderRadius: '4px',
                            transition: 'color 0.2s',
                        }}
                        onMouseEnter={(e) => e.currentTarget.style.color = closeHoverColor}
                        onMouseLeave={(e) => e.currentTarget.style.color = closeColor}
                    >
                        ✕
                    </button>
                </div>

                {/* Preview snapshot */}
                {step.preview && <StepPreview type={step.preview} isDark={isDark} ac={ac} acSec={acSec} acGrad={acGrad} t={t} />}

                {/* Title */}
                <h3 style={{
                    margin: '0 0 8px 0',
                    fontSize: '18px',
                    fontWeight: '900',
                    color: titleColor,
                    letterSpacing: '-0.3px',
                }}>
                    {t(step.titleKey)}
                </h3>

                {/* Description */}
                <p style={{
                    margin: '0 0 10px 0',
                    fontSize: '13px',
                    lineHeight: '1.5',
                    color: descColor,
                }}>
                    {t(step.descKey)}
                </p>

                {/* Action hint */}
                <div style={{
                    background: actionBg,
                    border: `1px solid ${actionBorder}`,
                    borderRadius: '8px',
                    padding: '10px 12px',
                    marginBottom: '16px',
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: '8px',
                }}>
                    <span style={{ fontSize: '14px', flexShrink: 0, marginTop: '1px' }}>👆</span>
                    <span style={{ fontSize: '11px', color: ac, lineHeight: '1.4', fontWeight: '500' }}>
                        {t(step.actionKey)}
                    </span>
                </div>

                {/* Navigation dots */}
                <div style={{
                    display: 'flex',
                    justifyContent: 'center',
                    gap: '5px',
                    marginBottom: '16px',
                    flexWrap: 'wrap',
                }}>
                    {TOUR_STEPS.map((_, index) => (
                        <button
                            key={index}
                            onClick={() => handleGoToStep(index)}
                            title={t(TOUR_STEPS[index].titleKey)}
                            style={{
                                width: index === currentStep ? '20px' : '8px',
                                height: '8px',
                                borderRadius: '4px',
                                background: index === currentStep
                                    ? ac
                                    : index < currentStep
                                        ? dotVisited
                                        : dotInactive,
                                border: 'none',
                                cursor: 'pointer',
                                padding: 0,
                                transition: 'all 0.3s ease',
                            }}
                        />
                    ))}
                </div>

                {/* Buttons */}
                <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                    {currentStep > 0 && (
                        <button
                            onClick={handlePrev}
                            style={{
                                padding: '10px 18px',
                                background: btnSecBg,
                                border: `1px solid ${btnSecBorder}`,
                                borderRadius: '8px',
                                color: btnSecColor,
                                fontSize: '12px',
                                fontWeight: 'bold',
                                cursor: 'pointer',
                                transition: 'all 0.2s',
                            }}
                            onMouseEnter={(e) => { e.currentTarget.style.background = btnSecHoverBg; e.currentTarget.style.color = btnSecHoverColor; }}
                            onMouseLeave={(e) => { e.currentTarget.style.background = btnSecBg; e.currentTarget.style.color = btnSecColor; }}
                        >
                            ← {t('tour.back')}
                        </button>
                    )}
                    <div style={{ flex: 1 }} />
                    <button
                        onClick={handleClose}
                        style={{
                            padding: '10px 18px',
                            background: 'transparent',
                            border: 'none',
                            color: mutedColor,
                            fontSize: '11px',
                            fontWeight: 'bold',
                            cursor: 'pointer',
                            transition: 'color 0.2s',
                        }}
                        onMouseEnter={(e) => e.currentTarget.style.color = descColor}
                        onMouseLeave={(e) => e.currentTarget.style.color = mutedColor}
                    >
                        {t('tour.skip')}
                    </button>
                    <button
                        onClick={handleNext}
                        style={{
                            padding: '10px 24px',
                            background: isLastStep
                                ? `linear-gradient(135deg, ${acSec}, ${ac})`
                                : `linear-gradient(135deg, ${ac}, #ee5a24)`,
                            border: 'none',
                            borderRadius: '8px',
                            color: '#fff',
                            fontSize: '12px',
                            fontWeight: '900',
                            cursor: 'pointer',
                            letterSpacing: '0.5px',
                            boxShadow: isLastStep
                                ? '0 4px 15px rgba(255, 159, 67, 0.3)'
                                : `0 4px 15px ${hexToRgba(ac, 0.3)}`,
                            transition: 'all 0.2s',
                        }}
                        onMouseEnter={(e) => e.currentTarget.style.transform = 'translateY(-1px)'}
                        onMouseLeave={(e) => e.currentTarget.style.transform = 'translateY(0)'}
                    >
                        {isLastStep ? `🎵 ${t('tour.startCreating')}` : `${t('tour.next')} →`}
                    </button>
                </div>

                {/* Don't show again checkbox */}
                <label style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    marginTop: '14px',
                    paddingTop: '12px',
                    borderTop: `1px solid ${dividerColor}`,
                    cursor: 'pointer',
                    userSelect: 'none',
                }}>
                    <input
                        type="checkbox"
                        checked={dontShowAgain}
                        onChange={(e) => setDontShowAgain(e.target.checked)}
                        style={{
                            width: '14px',
                            height: '14px',
                            accentColor: ac,
                            cursor: 'pointer',
                        }}
                    />
                    <span style={{ fontSize: '11px', color: checkboxLabel }}>{t('tour.dontShowAgain')}</span>
                </label>
            </div>

            {/* CSS animation for pulse ring */}
            <style>{`
                @keyframes tourPulse {
                    0% { opacity: 1; transform: scale(1); }
                    50% { opacity: 0.5; transform: scale(1.02); }
                    100% { opacity: 1; transform: scale(1); }
                }
            `}</style>
        </div>
    );
}

// Helper to check if tour should auto-start
export function shouldShowTour() {
    const completed = localStorage.getItem(STORAGE_KEY);
    const dontShow = localStorage.getItem(STORAGE_DONT_SHOW_KEY);
    return !completed && !dontShow;
}

// Helper to reset tour (for "Take Tour" button)
export function resetTour() {
    localStorage.removeItem(STORAGE_KEY);
}

export default OnboardingTour;
