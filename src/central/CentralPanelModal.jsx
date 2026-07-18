// "More Freally apps" — the view-only Freally Central catalog panel, vendored
// from the freally-central submodule. Studio is already React, so the panel is
// bundled directly (no island); it is localized through a small Fluent bridge
// (panelI18n) keyed to Studio's active language, and opens external links via
// Studio's http/https-guarded Electron opener. No download/install controls.
import { useMemo } from 'react'
import { CentralPanel } from '@freally/central-panel'
import { useTranslation } from '../i18n/I18nContext'
import { openExternal } from '../electronBridge.js'
import { makePanelT } from './panelI18n'

const HOST = { openExternal }

const backdropStyle = {
    position: 'fixed',
    inset: 0,
    background: 'rgba(0, 0, 0, 0.55)',
    display: 'grid',
    placeItems: 'center',
    zIndex: 4000,
}
const modalStyle = {
    display: 'flex',
    flexDirection: 'column',
    width: 'min(1040px, 94vw)',
    height: 'min(760px, 88vh)',
    background: '#12121a',
    border: '1px solid rgba(255, 255, 255, 0.12)',
    borderRadius: '12px',
    boxShadow: '0 16px 56px rgba(0, 0, 0, 0.5)',
    overflow: 'hidden',
}
const headStyle = {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '12px 16px',
    borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
}
const closeStyle = {
    background: 'transparent',
    border: 0,
    color: '#c8c8d0',
    fontSize: '22px',
    lineHeight: 1,
    cursor: 'pointer',
}
const bodyStyle = { flex: '1 1 auto', minHeight: 0, overflow: 'auto' }

export function CentralPanelModal({ isOpen, onClose }) {
    const { language, t } = useTranslation()
    const panelT = useMemo(() => makePanelT(language), [language])
    if (!isOpen) return null
    return (
        <div style={backdropStyle} onClick={onClose} role="presentation">
            <div
                style={modalStyle}
                role="dialog"
                aria-modal="true"
                aria-label={t('moreApps.title')}
                onClick={(e) => e.stopPropagation()}
            >
                <header style={headStyle}>
                    <h2 style={{ margin: 0, fontSize: '16px', color: '#e8e8ee' }}>
                        {t('moreApps.title')}
                    </h2>
                    <button type="button" style={closeStyle} aria-label="Close" onClick={onClose}>
                        ×
                    </button>
                </header>
                <div style={bodyStyle}>
                    <CentralPanel t={panelT} locale={language} host={HOST} allowDownloads={false} />
                </div>
            </div>
        </div>
    )
}

export default CentralPanelModal
