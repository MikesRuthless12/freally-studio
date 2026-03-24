import Peer from "peerjs";

export class PeerManager {
  constructor(myId, onData, onStream) {
    this.peer = new Peer(myId);
    this.connections = {};
    this.calls = {};
    this.onData = onData;
    this.onStream = onStream;

    this.peer.on("connection", c => {
      this.connections[c.peer] = c;
      c.on("data", d => this.onData(c.peer, d));
    });

    this.peer.on("call", call => {
      call.answer();
      call.on("stream", s => this.onStream(call.peer, s));
      this.calls[call.peer] = call;
    });
  }

  connect(id) {
    if (this.connections[id]) return;
    const c = this.peer.connect(id);
    this.connections[id] = c;
    c.on("data", d => this.onData(id, d));
    c.on("close", () => delete this.connections[id]);
  }

  broadcast(d) {
    Object.values(this.connections).forEach(c => c.open && c.send(d));
  }

  callPeer(id, stream) {
    const call = this.peer.call(id, stream);
    call.on("stream", s => this.onStream(id, s));
    this.calls[id] = call;
  }
}