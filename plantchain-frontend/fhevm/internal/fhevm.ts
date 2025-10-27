import { loadRelayerSDK } from "./RelayerSDKLoader";

export type FhevmInstance = any;

async function isLocalHardhat(provider: any): Promise<boolean> {
  try {
    const version = await provider.request({ method: "web3_clientVersion" });
    return typeof version === "string" && version.toLowerCase().includes("hardhat");
  } catch {
    return false;
  }
}

async function tryFetchRelayerMetadata(provider: any): Promise<any | null> {
  try {
    return await provider.request({ method: "fhevm_relayer_metadata" });
  } catch {
    return null;
  }
}

export async function createFhevmInstance(provider: any): Promise<FhevmInstance> {
  const isLocal = await isLocalHardhat(provider);
  const metadata = await tryFetchRelayerMetadata(provider);

  if (isLocal && metadata) {
    const { fhevmMockCreateInstance } = await import("./mock/fhevmMock");
    const chainIdHex = await provider.request({ method: "eth_chainId" });
    const chainId = parseInt(chainIdHex, 16);
    return fhevmMockCreateInstance({
      rpcUrl: (provider as any)?.connection?.url || "http://localhost:8545",
      chainId,
      metadata,
    });
  }

  await loadRelayerSDK();
  const relayerSDK = (window as any).relayerSDK;
  if (!relayerSDK.__initialized__) {
    await relayerSDK.initSDK();
    relayerSDK.__initialized__ = true;
  }

  const config = {
    ...relayerSDK.SepoliaConfig,
    network: provider,
  };

  return relayerSDK.createInstance(config);
}


