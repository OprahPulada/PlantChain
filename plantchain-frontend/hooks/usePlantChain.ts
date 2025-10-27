"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ethers } from "ethers";
import { createFhevmInstance } from "../fhevm/internal/fhevm";
import { PlantChainABI } from "../abi/PlantChainABI";
import { PlantChainAddresses } from "../abi/PlantChainAddresses";

export function usePlantChain() {
  const [provider, setProvider] = useState<any | undefined>(undefined);
  const [signer, setSigner] = useState<ethers.JsonRpcSigner | undefined>(undefined);
  const [instance, setInstance] = useState<any | undefined>(undefined);
  const [address, setAddress] = useState<string | undefined>(undefined);
  const [chainId, setChainId] = useState<number | undefined>(undefined);

  const [ecoHandle, setEcoHandle] = useState<string | undefined>(undefined);
  const [ecoClear, setEcoClear] = useState<string | undefined>(undefined);

  const contract = useMemo(() => {
    if (!address || !signer) return undefined;
    return new ethers.Contract(address, PlantChainABI.abi, signer);
  }, [address, signer]);

  useEffect(() => {
    const init = async () => {
      if (typeof window === "undefined" || !(window as any).ethereum) return;
      const eip1193 = (window as any).ethereum;
      // ensure accounts are available
      try { await eip1193.request({ method: "eth_requestAccounts" }); } catch {}

      const bp = new ethers.BrowserProvider(eip1193);
      const s = await bp.getSigner();
      const chainIdHex = await eip1193.request({ method: "eth_chainId" });
      const cid = parseInt(chainIdHex, 16);

      setProvider(eip1193);
      setSigner(s);
      setChainId(cid);

      const inst = await createFhevmInstance(eip1193);
      setInstance(inst);

      const entry = (PlantChainAddresses as any)[cid.toString()];
      if (entry?.address) setAddress(entry.address);
    };
    init();
  }, []);

  const refreshEco = useCallback(async () => {
    if (!address || !signer) return;
    const ro = new ethers.Contract(address, PlantChainABI.abi, signer.provider);
    const handle = await ro.getEcoPoints(await signer.getAddress());
    setEcoHandle(handle);
  }, [address, signer]);

  const addPoint = useCallback(async () => {
    if (!address || !signer || !instance) return;
    const input = instance.createEncryptedInput(address, await signer.getAddress());
    input.add32(1n);
    const enc = await input.encrypt();
    const tx = await contract!.addEcoPoints(enc.handles[0], enc.inputProof);
    await tx.wait();
    await refreshEco();
  }, [address, signer, instance, contract, refreshEco]);

  const decryptEco = useCallback(async () => {
    if (!instance || !ecoHandle || !address || !signer) return;
    // public decrypt for public data (may fail if ACL enforced)
    try {
      const clear = await instance.decryptPublic(address, ecoHandle);
      setEcoClear(String(clear));
      return;
    } catch {}

    // User decrypt via EIP-712 signature
    try {
      const { publicKey, privateKey } = instance.generateKeypair();
      const startTimestamp = Math.floor(Date.now() / 1000);
      const durationDays = 365;
      const eip712 = instance.createEIP712(publicKey, [address], startTimestamp, durationDays);
      const signature = await signer.signTypedData(
        eip712.domain,
        { UserDecryptRequestVerification: eip712.types.UserDecryptRequestVerification },
        eip712.message
      );
      const userAddress = await signer.getAddress();
      const res = await instance.userDecrypt(
        [{ handle: ecoHandle, contractAddress: address }],
        privateKey,
        publicKey,
        signature,
        [address],
        userAddress,
        startTimestamp,
        durationDays
      );
      const clear = res[ecoHandle];
      setEcoClear(String(clear));
    } catch (e) {
      console.warn("userDecrypt failed", e);
    }
  }, [instance, ecoHandle, address, signer]);

  return {
    chainId,
    address,
    addPoint,
    refreshEco,
    decryptEco,
    ecoHandle,
    ecoClear,
  } as const;
}
