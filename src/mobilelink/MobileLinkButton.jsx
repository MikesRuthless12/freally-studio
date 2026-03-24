import React from 'react';
import { useTranslation } from '../i18n/I18nContext';

/**
 * Mobile Link header button — 36px circular phone icon.
 * Shows a green badge with connected device count when active.
 *
 * @param {{ onClick: Function, connectedCount: number, isDark: boolean, ac: string, hexToRgba: Function }} props
 */
export default function MobileLinkButton({ onClick, connectedCount = 0, isDark, ac, hexToRgba }) {
    const { t } = useTranslation();
    return (
        <div
            onClick={onClick}
            title={t('mobileLink.title')}
            style={{
                width: '36px',
                height: '36px',
                color: isDark ? ac : '#333',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                borderRadius: '50%',
                transition: 'all 0.2s',
                background: 'transparent',
                position: 'relative',
            }}
            onMouseEnter={(e) => e.currentTarget.style.background = isDark ? hexToRgba(ac, 0.1) : 'rgba(0,0,0,0.05)'}
            onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
        >
            {/* Phone icon */}
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="5" y="2" width="14" height="20" rx="2" ry="2" />
                <line x1="12" y1="18" x2="12.01" y2="18" />
            </svg>

            {/* Connected count badge */}
            {connectedCount > 0 && (
                <div style={{
                    position: 'absolute',
                    top: '0px',
                    right: '0px',
                    width: '16px',
                    height: '16px',
                    borderRadius: '50%',
                    background: '#22c55e',
                    color: '#fff',
                    fontSize: '10px',
                    fontWeight: 700,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    lineHeight: 1,
                    pointerEvents: 'none',
                }}>
                    {connectedCount}
                </div>
            )}
        </div>
    );
}
