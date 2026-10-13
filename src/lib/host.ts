const LOCAL_HOSTNAMES = new Set(["127.0.0.1", "localhost", "[::1]"]);

// True only when the Host header names this machine. Binding to 127.0.0.1 is not
// enough on its own: a web page can point its own domain at 127.0.0.1 (DNS
// rebinding), and its requests then arrive here with that domain as the Host.
export function isLocalHost(host: string | null): boolean {
  if (!host) return false;
  const hostname = host.startsWith("[") ? host.slice(0, host.indexOf("]") + 1) : host.split(":")[0];
  return LOCAL_HOSTNAMES.has(hostname.toLowerCase());
}
