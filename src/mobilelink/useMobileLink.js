import { useState, useEffect, useRef, useCallback } from 'react';
import { MobileLinkEngine } from './MobileLinkEngine';
import { MOBILE_MSG } from './MobileLinkProtocol';

/**
 * React hook wrapping MobileLinkEngine.
 *
 * @param {import('../SamplerEngine').SamplerEngine} samplerEngine
 * @returns {{
 *   isActive: boolean,
 *   sessionUrl: string,
 *   connectedCount: number,
 *   clients: Array<{ peerId: string, deviceInfo: any }>,
 *   activate: () => Promise<void>,
 *   deactivate: () => void,
 *   broadcastState: (state: Object) => void,
 *   broadcastTransport: (transport: Object) => void,
 *   disconnectClient: (peerId: string) => void,
 *   setCommandHandler: (handler: Function) => void,
 * }}
 */
export function useMobileLink(samplerEngine) {
    const engineRef = useRef(null);
    const [isActive, setIsActive] = useState(false);
    const [sessionUrl, setSessionUrl] = useState('');
    const [connectedCount, setConnectedCount] = useState(0);
    const [clients, setClients] = useState([]);
    const [desktopMuted, setDesktopMutedState] = useState(false);
    const commandHandlerRef = useRef(null);

    // Create engine once
    useEffect(() => {
        if (!samplerEngine) return;

        const engine = new MobileLinkEngine(samplerEngine);
        engineRef.current = engine;

        // Subscribe to state changes
        const unsub = engine.onStateChange((state) => {
            setIsActive(state.isActive);
            setSessionUrl(state.sessionUrl);
            setConnectedCount(state.connectedCount);
            setClients(state.clients);

            // When all clients disconnect, the engine auto-unmutes desktop —
            // sync the React state to match.
            if (state.connectedCount === 0) {
                setDesktopMutedState(false);
            }
        });

        // Register command handler proxy
        engine.onCommand((cmd) => {
            if (commandHandlerRef.current) {
                commandHandlerRef.current(cmd);
            }
        });

        return () => {
            unsub();
            engine.dispose();
            engineRef.current = null;
        };
    }, [samplerEngine]);

    const activate = useCallback(async () => {
        if (!engineRef.current) return;
        try {
            await engineRef.current.activate();
        } catch (err) {
            console.error('[useMobileLink] Activation failed:', err);
        }
    }, []);

    const deactivate = useCallback(() => {
        if (!engineRef.current) return;
        engineRef.current.deactivate();
        setDesktopMutedState(false);
    }, []);

    const setDesktopMuted = useCallback((muted) => {
        if (!samplerEngine) return;
        samplerEngine.muteDesktopOutput(muted);
        setDesktopMutedState(muted);
    }, [samplerEngine]);

    const broadcastState = useCallback((state) => {
        if (!engineRef.current || !engineRef.current.isActive) return;
        engineRef.current.broadcastState(state);
    }, []);

    const broadcastTransport = useCallback((transport) => {
        if (!engineRef.current || !engineRef.current.isActive) return;
        engineRef.current.broadcastTransport(transport);
    }, []);

    const disconnectClient = useCallback((peerId) => {
        if (!engineRef.current) return;
        engineRef.current._removeClient(peerId);
    }, []);

    const setCommandHandler = useCallback((handler) => {
        commandHandlerRef.current = handler;
    }, []);

    return {
        isActive,
        sessionUrl,
        connectedCount,
        clients,
        desktopMuted,
        activate,
        deactivate,
        broadcastState,
        broadcastTransport,
        disconnectClient,
        setCommandHandler,
        setDesktopMuted,
    };
}

export default useMobileLink;
