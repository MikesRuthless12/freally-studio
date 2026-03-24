export function getOrCreateRoom() {
  const p = new URLSearchParams(window.location.search);
  let r = p.get("room");
  if (!r) {
    r = Math.random().toString(36).slice(2, 10);
    window.history.replaceState({}, "", `?room=${r}`);
  }
  return r;
}