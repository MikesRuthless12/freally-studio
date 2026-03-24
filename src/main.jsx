import React from 'react'
import ReactDOM from 'react-dom/client'
import WavLoomApp from './WavLoomAppComplete.jsx'
import { I18nProvider } from './i18n/I18nContext.jsx'
import './index.css'
import { installElectronFsPolyfill } from './electronFsPolyfill.js'

// Patch File System Access API with Electron native dialogs (no-op in browser)
installElectronFsPolyfill();

// Eagerly create AudioContext so it's ready before any playback request.
// Browsers require a user gesture to resume a suspended context, so we
// listen once for the first click/keydown/touchstart and resume it then.
import './AudioEngine.js'

// Resume AudioContext on first user gesture only. { once: true } ensures
// this fires exactly once — repeated resumes keep the Realtek driver's
// audio device open indefinitely, causing static/crackling after ~30-60s.
// Subsequent resume/suspend is managed by SamplerEngine.setAudioActive().
const resumeAudioCtx = () => {
    if (window.sharedAnalysisCtx && window.sharedAnalysisCtx.state === 'suspended') {
        window.sharedAnalysisCtx.resume();
    }
    if (window.audioEngine) window.audioEngine.resume();
};
window.addEventListener('click', resumeAudioCtx, { once: true });
window.addEventListener('keydown', resumeAudioCtx, { once: true });
window.addEventListener('touchstart', resumeAudioCtx, { once: true });

// === IDLE DIAGNOSTICS ===
// Logs what's still running every 2 minutes. Check console before hard refresh.
let _idleDiagCount = 0;
setInterval(() => {
    _idleDiagCount++;
    const mins = _idleDiagCount * 2;
    const diag = [];
    const ctx = window.sharedAnalysisCtx;
    diag.push(`AudioContext state: ${ctx ? ctx.state : 'none'}`);
    diag.push(`AudioContext sampleRate: ${ctx ? ctx.sampleRate : 'N/A'}`);
    diag.push(`AudioContext currentTime: ${ctx ? ctx.currentTime.toFixed(1) : 'N/A'}`);

    const sampler = window.__samplerRef;
    if (sampler) {
        diag.push(`SamplerEngine._cleanupInterval: ${sampler._cleanupInterval ? 'RUNNING' : 'stopped'}`);
        diag.push(`SamplerEngine._resetInterval: ${sampler._resetInterval ? 'RUNNING' : 'stopped'}`);
        diag.push(`SamplerEngine._idleSuspendTimer: ${sampler._idleSuspendTimer ? 'PENDING' : 'none'}`);
        diag.push(`SamplerEngine._audioActive: ${sampler._audioActive}`);
        diag.push(`SamplerEngine._resetEnabled: ${sampler._resetEnabled}`);
        diag.push(`SamplerEngine.activeSources.size: ${sampler.activeSources?.size ?? 'N/A'}`);
    } else {
        diag.push('SamplerEngine: not exposed on window.__samplerRef');
    }

    const ae = window.audioEngine;
    if (ae) {
        diag.push(`AudioEngine._idleSuspendTimer: ${ae._idleSuspendTimer ? 'PENDING' : 'none'}`);
        diag.push(`AudioEngine.currentSource: ${ae.currentSource ? 'ACTIVE' : 'none'}`);
    }

    console.log(`%c[IDLE DIAG @ ${mins}min]`, 'color: #ff0; font-weight: bold;', '\n' + diag.join('\n'));
}, 120000);

ReactDOM.createRoot(document.getElementById('root')).render(
    <React.StrictMode>
        <I18nProvider>
            <WavLoomApp />
        </I18nProvider>
    </React.StrictMode>,
)
