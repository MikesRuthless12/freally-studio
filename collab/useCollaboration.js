import { useEffect, useRef, useState } from "react";
import { PeerManager } from "./PeerManager";
import { MSG } from "./PeerProtocol";
import { getOrCreateRoom } from "./Room";

export function useCollaboration() {
  const [room] = useState(getOrCreateRoom());
  const [peers, setPeers] = useState({});
  const [tabOwners, setTabOwners] = useState({});
  const [remoteStreams, setRemoteStreams] = useState({});
  const [activeStream, setActiveStream] = useState(null);

  const myId = useRef(null);
  const peerRef = useRef(null);
  const myScreen = useRef(null);

  const onData = (from, d) => {
    switch (d.type) {
      case MSG.JOIN:
        setPeers(p => ({ ...p, [d.id]: true }));
        peerRef.current.connect(d.id);
        peerRef.current.connections[d.id]?.send({ type: MSG.JOIN_ACK, id: myId.current });
        break;
      case MSG.JOIN_ACK:
        peerRef.current.connect(d.id);
        break;
      case MSG.LEAVE:
        setPeers(p => { const c={...p}; delete c[d.id]; return c; });
        break;
      case MSG.TAB_ASSIGN:
        setTabOwners(d.payload);
        break;
      case MSG.SCREEN_REQUEST:
        if (myScreen.current) peerRef.current.callPeer(from, myScreen.current);
        break;
    }
  };

  const onStream = (id, s) => {
    setRemoteStreams(p => ({ ...p, [id]: s }));
    if (!activeStream) setActiveStream(id);
  };

  useEffect(() => {
    const id = room + "-" + Math.random().toString(36).slice(2,6);
    myId.current = id;
    peerRef.current = new PeerManager(id, onData, onStream);
    peerRef.current.peer.on("open", () => {
      peerRef.current.broadcast({ type: MSG.JOIN, id });
    });
    return () => peerRef.current.broadcast({ type: MSG.LEAVE, id });
  }, []);

  const shareScreen = async () => {
    const s = await navigator.mediaDevices.getDisplayMedia({ video:true, audio:true });
    myScreen.current = s;
    Object.keys(peerRef.current.connections).forEach(id => peerRef.current.callPeer(id, s));
  };

  return { room, peers, tabOwners, remoteStreams, activeStream, setActiveStream, shareScreen };
}