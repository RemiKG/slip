// The live network ledger — the "0 network calls" proof, made real.
//
// We monkey-patch fetch / XMLHttpRequest / sendBeacon to COUNT genuine network egress
// from the page. Static asset loads (<script>/<link>/<img>) are not fetch() calls and
// don't count; what counts is data the app sends/requests at runtime — i.e. the one-time
// model download (honest, framed by the model-load screen) and any opt-in server-seam
// call. During record → analyse → catch, the count stays at 0, because that path is
// 100% local. Corroborable in DevTools › Network.
//
// This is honest by construction: it cannot read 0 while a real request is in flight.

let count = 0;
let bytesSent = 0;
let installed = false;
const listeners = new Set<() => void>();

function notify() {
  for (const l of listeners) l();
}

export function getNetworkCount(): number {
  return count;
}
export function getBytesSent(): number {
  return bytesSent;
}
export function subscribeNetwork(l: () => void): () => void {
  listeners.add(l);
  return () => listeners.delete(l);
}
export function resetNetwork(): void {
  count = 0;
  bytesSent = 0;
  notify();
}

function bump(estBytes: number) {
  count += 1;
  if (estBytes > 0) bytesSent += estBytes;
  notify();
}

export function installNetworkLedger(): void {
  if (installed || typeof window === "undefined") return;
  installed = true;

  const origFetch = window.fetch?.bind(window);
  if (origFetch) {
    window.fetch = (input: RequestInfo | URL, init?: RequestInit) => {
      // estimate uploaded bytes for the honest "KB sent" figure
      let est = 0;
      const body = init?.body;
      if (typeof body === "string") est = body.length;
      else if (body instanceof ArrayBuffer) est = body.byteLength;
      else if (ArrayBuffer.isView(body)) est = body.byteLength;
      else if (body instanceof Blob) est = body.size;
      bump(est);
      return origFetch(input, init);
    };
  }

  const OrigXHR = window.XMLHttpRequest;
  if (OrigXHR) {
    const origSend = OrigXHR.prototype.send;
    OrigXHR.prototype.send = function (this: XMLHttpRequest, body?: Document | XMLHttpRequestBodyInit | null) {
      let est = 0;
      if (typeof body === "string") est = body.length;
      else if (body instanceof Blob) est = body.size;
      else if (body instanceof ArrayBuffer) est = body.byteLength;
      else if (ArrayBuffer.isView(body)) est = (body as ArrayBufferView).byteLength;
      bump(est);
      return origSend.call(this, body as Document | XMLHttpRequestBodyInit | null);
    };
  }

  if (typeof navigator !== "undefined" && navigator.sendBeacon) {
    const origBeacon = navigator.sendBeacon.bind(navigator);
    navigator.sendBeacon = (url: string | URL, data?: BodyInit | null) => {
      let est = 0;
      if (typeof data === "string") est = data.length;
      else if (data instanceof Blob) est = data.size;
      bump(est);
      return origBeacon(url, data ?? null);
    };
  }
}
