export const SDK_CDN_URL = "https://cdn.zama.ai/relayer-sdk-js/0.2.0/relayer-sdk-js.umd.cjs";

export function loadRelayerSDK(): Promise<void> {
  return new Promise((resolve, reject) => {
    if ((window as any).relayerSDK) return resolve();
    const s = document.createElement("script");
    s.src = SDK_CDN_URL;
    s.async = true;
    s.type = "text/javascript";
    s.onload = () => resolve();
    s.onerror = () => reject(new Error("Failed to load Relayer SDK"));
    document.head.appendChild(s);
  });
}


