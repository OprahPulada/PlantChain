"use client";

import { useCallback, useEffect, useState } from "react";
import { ethers } from "ethers";
import { PlantChainABI } from "@/abi/PlantChainABI";
import { PlantChainAddresses } from "@/abi/PlantChainAddresses";
import { loadRelayerSDK } from "@/fhevm/internal/RelayerSDKLoader";

export default function PointsPage() {
  const [handle, setHandle] = useState<string | undefined>(undefined);
  const [clear, setClear] = useState<string | undefined>(undefined);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);

  const refresh = useCallback(async () => {
    if (typeof window === "undefined" || !(window as any).ethereum) return;
    setLoading(true);
    try {
      const provider = new ethers.BrowserProvider((window as any).ethereum);
      const signer = await provider.getSigner();
      const user = await signer.getAddress();
      const chainId = (await provider.getNetwork()).chainId;
      const info = (PlantChainAddresses as any)[chainId.toString()];
      if (!info?.address) return;
      const contract = new ethers.Contract(info.address, PlantChainABI.abi, provider);
      const h = await contract.getEcoPoints(user);
      setHandle(h);
      setClear(undefined);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  const decryptPublic = async () => {
    if (!handle) return;
    setBusy(true);
    try {
      await loadRelayerSDK();
      const relayerSDK = (window as any).relayerSDK;
      if (!relayerSDK.__initialized__) {
        await relayerSDK.initSDK();
        relayerSDK.__initialized__ = true;
      }
    
      const provider = (window as any).ethereum;
      const chainIdHex = await provider.request({ method: "eth_chainId" });
      const chainId = parseInt(chainIdHex, 16);
      const info = (PlantChainAddresses as any)[chainId.toString()];
      const instance = await (window as any).relayerSDK.createInstance({ ...((window as any).relayerSDK.SepoliaConfig), network: provider });
      const value = await instance.decryptPublic(info.address, handle);
      setClear(String(value));
    } catch (e) {
      alert("公共解密失败：该值可能需要用户解密");
    } finally {
      setBusy(false);
    }
  };

  const decryptUser = async () => {
    if (!handle) return;
    setBusy(true);
    try {
      await loadRelayerSDK();
      const relayerSDK = (window as any).relayerSDK;
      if (!relayerSDK.__initialized__) {
        await relayerSDK.initSDK();
        relayerSDK.__initialized__ = true;
      }

      const provider = (window as any).ethereum;
      const chainIdHex = await provider.request({ method: "eth_chainId" });
      const chainId = parseInt(chainIdHex, 16);
      const info = (PlantChainAddresses as any)[chainId.toString()];

      const instance = await relayerSDK.createInstance({ ...relayerSDK.SepoliaConfig, network: provider });

      const ethersProvider = new ethers.BrowserProvider(provider);
      const signer = await ethersProvider.getSigner();
      const userAddress = await signer.getAddress();

      const { publicKey, privateKey } = instance.generateKeypair();
      const startTimestamp = Math.floor(Date.now() / 1000);
      const durationDays = 365;
      const eip712 = instance.createEIP712(publicKey, [info.address], startTimestamp, durationDays);
      const signature = await signer.signTypedData(
        eip712.domain,
        { UserDecryptRequestVerification: eip712.types.UserDecryptRequestVerification },
        eip712.message
      );

      const res = await instance.userDecrypt(
        [{ handle, contractAddress: info.address }],
        privateKey,
        publicKey,
        signature,
        [info.address],
        userAddress,
        startTimestamp,
        durationDays
      );
      const value = res[handle];
      setClear(String(value));
    } catch (e: any) {
      alert("用户解密失败：" + (e?.message ?? e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="container">
      <h1 style={{ fontSize: "2rem", color: "var(--color-primary)", marginBottom: "1rem" }}>我的环保积分</h1>

      <div className="form-container">
        <div className="form-group">
          <label className="form-label">密文句柄</label>
          <input className="form-input" value={handle ?? "-"} readOnly />
        </div>
        <div className="form-group">
          <label className="form-label">解密结果</label>
          <input className="form-input" value={clear ?? "-"} readOnly />
        </div>
        <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap" }}>
          <button onClick={refresh} className="btn btn-outline" disabled={loading || busy}>刷新</button>
          <button onClick={decryptPublic} className="btn btn-primary" disabled={busy || !handle}>公共解密</button>
          <button onClick={decryptUser} className="btn btn-secondary" disabled={busy || !handle}>用户解密（签名）</button>
        </div>
      </div>
    </div>
  );
}
