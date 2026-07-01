/**
 * Freally Mobile — Client App
 *
 * Single-file IIFE that handles:
 *   - PeerJS connection to desktop Freally session
 *   - WebRTC audio playback with iOS Safari handling
 *   - Waveform visualizer on canvas
 *   - VU meter updates from data channel
 *   - Solo/mute controls with bidirectional sync
 *   - Master volume control
 *   - Reconnection with exponential backoff
 *   - Wake Lock to prevent screen sleep
 */
(function () {
    'use strict';

    // ─── Message Types (must match MobileLinkProtocol.js) ───
    const MSG = {
        JOIN: 'MOBILE_JOIN',
        HELLO: 'MOBILE_HELLO',
        REJECTED: 'MOBILE_REJECTED',
        LEVELS: 'MOBILE_LEVELS',
        STATE: 'MOBILE_STATE',
        SOLO_TOGGLE: 'MOBILE_SOLO_TOGGLE',
        MUTE_TOGGLE: 'MOBILE_MUTE_TOGGLE',
        VOLUME: 'MOBILE_VOLUME',
        DISCONNECT: 'MOBILE_DISCONNECT',
        TRANSPORT: 'MOBILE_TRANSPORT',
        DESKTOP_MUTE: 'MOBILE_DESKTOP_MUTE',
    };

    const TRACK_IDS = ['drums', 'chords', 'melody', 'bass'];
    const MAX_RECONNECT_ATTEMPTS = 10;

    // ─── State ───
    let sessionId = null;
    let peer = null;
    let dataConn = null;
    let audioCtx = null;
    let analyser = null;
    let masterGain = null;
    let muteNode = null;       // silent sink so analyser graph stays connected
    let audioElement = null;   // <audio> element for reliable mobile playback
    let remoteStream = null;
    let isConnected = false;
    let reconnectAttempts = 0;
    let reconnectTimer = null;
    let wakeLock = null;
    let animFrameId = null;

    // Track state
    const solos = new Set();
    const mutes = new Set();
    let currentVolume = 0.7;
    let isPlaying = false;
    let tempo = 120;
    let desktopMuted = false;

    // Peak hold state for meters
    const peakHold = {};

    // ─── DOM References ───
    const $ = (sel) => document.querySelector(sel);
    const $$ = (sel) => document.querySelectorAll(sel);

    const elSplash = $('#splash');
    const elMain = $('#main');
    const elConnectBtn = $('#connect-btn');
    const elStatusText = $('#status-text');
    const elStatusDot = $('#status-dot');
    const elErrorBanner = $('#error-banner');
    const elWaveform = $('#waveform');
    const elVolumeSlider = $('#master-volume');
    const elVolumeDisplay = $('#volume-display');
    const elTempoDisplay = $('#tempo-display');
    const elPlayIndicator = $('#play-indicator');

    // ─── URL Params ───
    const params = new URLSearchParams(window.location.search);
    sessionId = params.get('s');

    // ─── Helpers ───

    function showError(msg) {
        elErrorBanner.textContent = msg;
        elErrorBanner.classList.add('visible');
        setTimeout(() => elErrorBanner.classList.remove('visible'), 5000);
    }

    function setStatus(text, connected) {
        elStatusText.textContent = text;
        if (connected) {
            elStatusDot.classList.add('connected');
        } else {
            elStatusDot.classList.remove('connected');
        }
    }

    function getDeviceInfo() {
        return {
            name: /iPhone|iPad|iPod/.test(navigator.userAgent) ? 'iPhone' :
                  /Android/.test(navigator.userAgent) ? 'Android' : 'Mobile',
            ua: navigator.userAgent.slice(0, 100),
        };
    }

    function dBFromRMS(rms) {
        if (rms <= 0) return -60;
        return Math.max(-60, 20 * Math.log10(rms));
    }

    // ─── Audio Setup ───

    function initAudioContext() {
        if (audioCtx) return;
        const Ctx = window.AudioContext || window.webkitAudioContext;
        audioCtx = new Ctx({ latencyHint: 'playback' });

        masterGain = audioCtx.createGain();
        masterGain.gain.value = currentVolume;

        analyser = audioCtx.createAnalyser();
        analyser.fftSize = 2048;
        analyser.smoothingTimeConstant = 0.8;

        // Route: masterGain → analyser → muteNode(0) → destination
        // The muteNode keeps the graph connected (so analyser works on all browsers)
        // but produces no sound — the <audio> element handles actual playback.
        muteNode = audioCtx.createGain();
        muteNode.gain.value = 0;

        masterGain.connect(analyser);
        analyser.connect(muteNode);
        muteNode.connect(audioCtx.destination);
    }

    function resumeAudioContext() {
        if (audioCtx && audioCtx.state === 'suspended') {
            audioCtx.resume().catch(() => {});
        }
    }

    function connectAudioStream(stream) {
        if (!stream) return;
        remoteStream = stream;

        // Primary: <audio> element for reliable mobile playback
        // (MediaStreamSource → Web Audio → destination is unreliable on mobile)
        if (!audioElement) {
            audioElement = document.createElement('audio');
            audioElement.setAttribute('playsinline', '');
            audioElement.setAttribute('autoplay', '');
            document.body.appendChild(audioElement);
        }
        audioElement.srcObject = stream;
        audioElement.volume = currentVolume;
        audioElement.play().catch((e) => console.warn('[Mobile] Audio play failed:', e));

        // Secondary: Web Audio graph for waveform/meter visualization only
        if (audioCtx) {
            const source = audioCtx.createMediaStreamSource(stream);
            source.connect(masterGain);
        }
    }

    // ─── Waveform Visualizer ───

    function startWaveformLoop() {
        if (animFrameId) return;
        const canvas = elWaveform;
        const ctx = canvas.getContext('2d');
        const bufferLength = analyser ? analyser.frequencyBinCount : 1024;
        const dataArray = new Float32Array(bufferLength);

        function resizeCanvas() {
            const rect = canvas.getBoundingClientRect();
            const dpr = window.devicePixelRatio || 1;
            canvas.width = rect.width * dpr;
            canvas.height = rect.height * dpr;
            ctx.scale(dpr, dpr);
        }
        resizeCanvas();
        window.addEventListener('resize', resizeCanvas);

        function draw() {
            animFrameId = requestAnimationFrame(draw);
            if (!analyser) return;

            analyser.getFloatTimeDomainData(dataArray);

            const w = canvas.getBoundingClientRect().width;
            const h = canvas.getBoundingClientRect().height;
            ctx.clearRect(0, 0, w, h);

            // Draw waveform line
            ctx.strokeStyle = '#8b5cf6';
            ctx.lineWidth = 2;
            ctx.shadowColor = '#8b5cf6';
            ctx.shadowBlur = 6;
            ctx.beginPath();

            const sliceWidth = w / bufferLength;
            let x = 0;

            for (let i = 0; i < bufferLength; i++) {
                const v = dataArray[i];
                const y = (1 - v) * h / 2;
                if (i === 0) ctx.moveTo(x, y);
                else ctx.lineTo(x, y);
                x += sliceWidth;
            }

            ctx.stroke();
            ctx.shadowBlur = 0;

            // Center line
            ctx.strokeStyle = 'rgba(255,255,255,0.05)';
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.moveTo(0, h / 2);
            ctx.lineTo(w, h / 2);
            ctx.stroke();
        }

        draw();
    }

    function stopWaveformLoop() {
        if (animFrameId) {
            cancelAnimationFrame(animFrameId);
            animFrameId = null;
        }
    }

    // ─── VU Meters ───

    function updateMeters(levels) {
        const trackKeys = [...TRACK_IDS, 'master'];
        for (const trackId of trackKeys) {
            const rms = levels[trackId] || 0;
            const meter = $(`.meter[data-track="${trackId}"]`);
            if (!meter) continue;

            const fill = meter.querySelector('.meter-bar-fill');
            const peak = meter.querySelector('.meter-bar-peak');

            // Convert RMS to percentage (0-100), with some scaling for visual appeal
            const pct = Math.min(100, rms * 300); // Scale up — RMS values are typically 0-0.3

            fill.style.height = pct + '%';

            // Determine color based on level
            if (pct > 85) {
                fill.style.opacity = '1';
            } else if (pct > 60) {
                fill.style.opacity = '0.9';
            } else {
                fill.style.opacity = '0.8';
            }

            // Peak hold
            if (!peakHold[trackId] || pct > peakHold[trackId].value) {
                peakHold[trackId] = { value: pct, time: Date.now() };
            } else if (Date.now() - peakHold[trackId].time > 1000) {
                peakHold[trackId].value = Math.max(pct, peakHold[trackId].value - 2);
                peakHold[trackId].time = Date.now();
            }

            if (peak) {
                peak.style.bottom = peakHold[trackId].value + '%';
            }
        }
    }

    // ─── Channel Strip ───

    function updateChannelUI() {
        $$('.channel').forEach((el) => {
            const trackId = el.dataset.track;
            const soloBtn = el.querySelector('.ch-btn.solo');
            const muteBtn = el.querySelector('.ch-btn.mute');

            if (soloBtn) {
                soloBtn.classList.toggle('active', solos.has(trackId));
            }
            if (muteBtn) {
                muteBtn.classList.toggle('active', mutes.has(trackId));
            }
        });

        // Also sync meter mute buttons
        $$('.meter-mute').forEach((btn) => {
            btn.classList.toggle('active', mutes.has(btn.dataset.track));
        });
    }

    function initChannelControls() {
        $$('.ch-btn').forEach((btn) => {
            btn.addEventListener('click', () => {
                const channel = btn.closest('.channel');
                const trackId = channel.dataset.track;
                const action = btn.dataset.action;

                if (action === 'solo') {
                    if (solos.has(trackId)) solos.delete(trackId);
                    else solos.add(trackId);

                    sendMessage({
                        type: MSG.SOLO_TOGGLE,
                        trackId: trackId,
                    });
                } else if (action === 'mute') {
                    if (mutes.has(trackId)) mutes.delete(trackId);
                    else mutes.add(trackId);

                    sendMessage({
                        type: MSG.MUTE_TOGGLE,
                        trackId: trackId,
                    });
                }

                updateChannelUI();
            });
        });
    }

    // ─── Meter Mute Buttons ───

    function initMeterMuteButtons() {
        $$('.meter-mute').forEach((btn) => {
            btn.addEventListener('click', () => {
                const trackId = btn.dataset.track;
                if (mutes.has(trackId)) mutes.delete(trackId);
                else mutes.add(trackId);

                sendMessage({
                    type: MSG.MUTE_TOGGLE,
                    trackId: trackId,
                });

                updateChannelUI();
            });
        });
    }

    // ─── Volume Control ───

    function initVolumeControl() {
        elVolumeSlider.value = currentVolume * 100;
        elVolumeDisplay.textContent = Math.round(currentVolume * 100) + '%';

        elVolumeSlider.addEventListener('input', () => {
            const val = parseInt(elVolumeSlider.value, 10) / 100;
            currentVolume = val;
            elVolumeDisplay.textContent = Math.round(val * 100) + '%';

            if (masterGain) masterGain.gain.value = val;
            if (audioElement) audioElement.volume = val;

            sendMessage({
                type: MSG.VOLUME,
                value: val,
            });
        });
    }

    // ─── Transport ───

    function updateTransport(data) {
        if (typeof data.isPlaying === 'boolean') {
            isPlaying = data.isPlaying;
            elPlayIndicator.classList.toggle('playing', isPlaying);
        }
        if (typeof data.tempo === 'number') {
            tempo = data.tempo;
            elTempoDisplay.textContent = Math.round(tempo) + ' BPM';
        }
    }

    // ─── Mute Desktop ───

    function updateMuteDesktopUI() {
        const btn = $('#mute-desktop-btn');
        if (!btn) return;
        btn.classList.toggle('active', desktopMuted);
        btn.textContent = desktopMuted ? 'Unmute Desktop' : 'Mute Desktop';
    }

    function initMuteDesktopControl() {
        const btn = $('#mute-desktop-btn');
        if (!btn) return;
        btn.addEventListener('click', () => {
            desktopMuted = !desktopMuted;
            updateMuteDesktopUI();
            sendMessage({
                type: MSG.DESKTOP_MUTE,
                value: desktopMuted,
            });
        });
    }

    // ─── PeerJS Connection ───

    function sendMessage(msg) {
        if (!dataConn || !dataConn.open) return;
        try {
            dataConn.send(JSON.stringify(msg));
        } catch (e) {
            console.warn('[Mobile] Send failed:', e);
        }
    }

    function handleMessage(raw) {
        let msg;
        try {
            msg = typeof raw === 'string' ? JSON.parse(raw) : raw;
        } catch (e) {
            return;
        }

        switch (msg.type) {
            case MSG.HELLO:
                console.log('[Mobile] Received HELLO from desktop');
                setStatus('Connected', true);
                break;

            case MSG.REJECTED:
                showError('Connection rejected: ' + (msg.reason || 'unknown'));
                disconnect();
                break;

            case MSG.LEVELS:
                updateMeters(msg.levels || {});
                break;

            case MSG.STATE:
                // Sync solo/mute state from desktop
                solos.clear();
                (msg.solos || []).forEach((id) => solos.add(id));
                mutes.clear();
                (msg.mutes || []).forEach((id) => mutes.add(id));
                if (typeof msg.volume === 'number') {
                    currentVolume = msg.volume;
                    elVolumeSlider.value = Math.round(msg.volume * 100);
                    elVolumeDisplay.textContent = Math.round(msg.volume * 100) + '%';
                    if (masterGain) masterGain.gain.value = msg.volume;
                    if (audioElement) audioElement.volume = msg.volume;
                }
                // Sync desktop muted state
                if (typeof msg.desktopMuted === 'boolean') {
                    desktopMuted = msg.desktopMuted;
                    updateMuteDesktopUI();
                }
                updateChannelUI();
                updateTransport(msg);
                break;

            case MSG.TRANSPORT:
                updateTransport(msg);
                break;

            case MSG.DISCONNECT:
                console.log('[Mobile] Desktop disconnected');
                disconnect();
                break;

            default:
                break;
        }
    }

    function connect() {
        if (!sessionId) {
            showError('No session ID in URL. Scan the QR code from Freally.');
            return;
        }

        initAudioContext();
        resumeAudioContext();

        elConnectBtn.disabled = true;
        elConnectBtn.textContent = 'Connecting...';
        setStatus('Connecting...', false);

        try {
            peer = new Peer();
        } catch (e) {
            showError('Failed to create peer: ' + e.message);
            elConnectBtn.disabled = false;
            elConnectBtn.textContent = 'Tap to Connect';
            return;
        }

        peer.on('open', () => {
            console.log('[Mobile] Peer open, connecting to', sessionId);

            // Open data channel
            dataConn = peer.connect(sessionId, { reliable: true });

            dataConn.on('open', () => {
                console.log('[Mobile] Data channel open');
                isConnected = true;
                reconnectAttempts = 0;

                // Send JOIN with device info
                sendMessage({
                    type: MSG.JOIN,
                    deviceInfo: getDeviceInfo(),
                });

                // Show main UI
                elSplash.style.display = 'none';
                elMain.classList.add('visible');

                startWaveformLoop();
                requestWakeLock();
            });

            dataConn.on('data', handleMessage);

            dataConn.on('close', () => {
                console.log('[Mobile] Data channel closed');
                handleDisconnect();
            });

            dataConn.on('error', (err) => {
                console.error('[Mobile] Data channel error:', err);
                handleDisconnect();
            });
        });

        // Handle incoming media call from desktop
        peer.on('call', (call) => {
            console.log('[Mobile] Incoming audio call');
            call.answer(); // Answer without sending audio back

            call.on('stream', (stream) => {
                console.log('[Mobile] Audio stream received');
                connectAudioStream(stream);
            });

            call.on('close', () => {
                console.log('[Mobile] Audio call closed');
            });
        });

        peer.on('disconnected', () => {
            console.warn('[Mobile] Peer disconnected');
            handleDisconnect();
        });

        peer.on('error', (err) => {
            console.error('[Mobile] Peer error:', err);
            if (err.type === 'peer-unavailable') {
                showError('Desktop session not found. Make sure Freally is running.');
                elConnectBtn.disabled = false;
                elConnectBtn.textContent = 'Tap to Connect';
            } else {
                handleDisconnect();
            }
        });
    }

    function disconnect() {
        isConnected = false;
        stopWaveformLoop();
        releaseWakeLock();

        if (dataConn) {
            try { dataConn.close(); } catch (_) {}
            dataConn = null;
        }
        if (peer) {
            try { peer.destroy(); } catch (_) {}
            peer = null;
        }

        setStatus('Disconnected', false);
        elSplash.style.display = '';
        elMain.classList.remove('visible');
        elConnectBtn.disabled = false;
        elConnectBtn.textContent = 'Tap to Connect';
    }

    function handleDisconnect() {
        if (!isConnected) return;
        isConnected = false;
        stopWaveformLoop();
        setStatus('Reconnecting...', false);

        attemptReconnect();
    }

    function attemptReconnect() {
        if (reconnectTimer) return;
        if (reconnectAttempts >= MAX_RECONNECT_ATTEMPTS) {
            showError('Could not reconnect. Tap to try again.');
            disconnect();
            return;
        }

        const delay = Math.min(1000 * Math.pow(2, reconnectAttempts), 10000);
        reconnectAttempts++;

        console.log(`[Mobile] Reconnecting in ${delay}ms (attempt ${reconnectAttempts})`);
        reconnectTimer = setTimeout(() => {
            reconnectTimer = null;

            // Clean up old peer
            if (peer) {
                try { peer.destroy(); } catch (_) {}
                peer = null;
            }
            dataConn = null;

            // Re-connect
            connect();
        }, delay);
    }

    // ─── Wake Lock ───

    async function requestWakeLock() {
        if (!('wakeLock' in navigator)) return;
        try {
            wakeLock = await navigator.wakeLock.request('screen');
            wakeLock.addEventListener('release', () => {
                wakeLock = null;
            });
        } catch (e) {
            console.warn('[Mobile] Wake lock failed:', e);
        }
    }

    function releaseWakeLock() {
        if (wakeLock) {
            try { wakeLock.release(); } catch (_) {}
            wakeLock = null;
        }
    }

    // Re-request wake lock on visibility change (iOS Safari releases it)
    document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible' && isConnected) {
            resumeAudioContext();
            requestWakeLock();
        }
    });

    // ─── Init ───

    initChannelControls();
    initMeterMuteButtons();
    initVolumeControl();
    initMuteDesktopControl();

    elConnectBtn.addEventListener('click', () => {
        connect();
    });

    // Disconnect button
    const elDisconnectBtn = $('#disconnect-btn');
    if (elDisconnectBtn) {
        elDisconnectBtn.addEventListener('click', () => {
            sendMessage({ type: MSG.DISCONNECT });
            disconnect();
        });
    }

    // Register service worker for PWA
    if ('serviceWorker' in navigator) {
        navigator.serviceWorker.register('sw.js').catch(() => {});
    }

})();
