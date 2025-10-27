"use client";

import { useEffect, useState } from "react";
import { ethers } from "ethers";
import { PlantChainABI } from "@/abi/PlantChainABI";
import { PlantChainAddresses } from "@/abi/PlantChainAddresses";

type MyPlant = { id: string; name: string };

type PointLog = { from: string; amount: number; reason: number; timestamp: number };

const reasonLabel = (r: number) => {
  if (r === 1) return "创建植物";
  if (r === 2) return "添加日志";
  if (r === 3) return "他人打赏";
  return "未知";
};

export default function PointsRecordsPage() {
  const [myPlants, setMyPlants] = useState<MyPlant[]>([]);
  const [plantId, setPlantId] = useState<string>("");
  const [logs, setLogs] = useState<PointLog[]>([]);
  const [loading, setLoading] = useState<boolean>(false);

  useEffect(() => {
    (async () => {
      if (!(window as any).ethereum) return;
      const provider = new ethers.BrowserProvider((window as any).ethereum);
      const signer = await provider.getSigner();
      const addr = await signer.getAddress();
      const chainId = (await provider.getNetwork()).chainId;
      const info = (PlantChainAddresses as any)[chainId.toString()];
      if (!info?.address) return;
      const contract = new ethers.Contract(info.address, PlantChainABI.abi, provider);
      const ids = await contract.getMyPlants(addr);

      const items: MyPlant[] = [];
      for (const rawId of ids) {
        const id = rawId.toString();
        const p = await contract.getPlant(id);
        items.push({ id, name: p.name as string });
      }
      setMyPlants(items);

      if (items.length > 0) {
        setPlantId(items[0].id); // 仅设置默认选择，不自动加载
      }
    })();
  }, []);

  const loadWith = async (provider: any, contractAddress: string, id: string) => {
    setLoading(true);
    try {
      const signer = await new ethers.BrowserProvider((window as any).ethereum).getSigner();
      const contractWrite = new ethers.Contract(contractAddress, PlantChainABI.abi, signer);
      // 支付一个极小的费用（例如 0.0001 ETH），触发 payToViewPointLogs
      const tx = await contractWrite.payToViewPointLogs(id, { value: ethers.parseEther("0.0001") });
      await tx.wait();

      const contractRead = new ethers.Contract(contractAddress, PlantChainABI.abi, provider);
      const list = await contractRead.getPlantPointLogs(id);
      setLogs(
        list.map((l: any) => ({
          from: l.from,
          amount: Number(l.amount),
          reason: Number(l.reason),
          timestamp: Number(l.timestamp),
        }))
      );
    } finally {
      setLoading(false);
    }
  };

  const load = async (id?: string) => {
    const target = id ?? plantId;
    if (!target) return;
    const provider = new ethers.BrowserProvider((window as any).ethereum);
    const chainId = (await provider.getNetwork()).chainId;
    const info = (PlantChainAddresses as any)[chainId.toString()];
    await loadWith(provider, info.address, target);
  };

  return (
    <div className="container">
      <h1 style={{ color: "var(--color-primary)", marginBottom: "1rem" }}>积分记录</h1>
      <div style={{ display: "flex", gap: "0.5rem", marginBottom: "1rem" }}>
        <select
          className="form-select"
          value={plantId}
          onChange={(e) => {
            const id = e.target.value;
            setPlantId(id); // 切换仅更新选择，等待点击“加载”
          }}
        >
          {myPlants.length === 0 && <option value="">暂无植物</option>}
          {myPlants.map((p) => (
            <option key={p.id} value={p.id}>{p.name || `ID #${p.id}`}</option>
          ))}
        </select>
        <button className="btn btn-primary" onClick={() => load()} disabled={loading || !plantId}>
          {loading ? "加载中..." : "加载（支付 0.0001 ETH）"}
        </button>
      </div>

      <div className="form-container">
        {loading && (
          <div className="loading"><div className="spinner"></div></div>
        )}
        {!loading && logs.length === 0 && <div className="empty-state-text">暂无加分记录</div>}
        {!loading && logs.map((l, i) => (
          <div key={i} style={{ display: "flex", justifyContent: "space-between", padding: "0.75rem 0", borderBottom: "1px solid var(--color-border)" }}>
            <div>
              <div style={{ fontWeight: 600 }}>+{l.amount} 分 · {reasonLabel(l.reason)}</div>
              <div style={{ color: "var(--color-text-light)", fontSize: "0.9rem" }}>{new Date(l.timestamp * 1000).toLocaleString("zh-CN")}</div>
            </div>
            <div style={{ fontFamily: "monospace" }}>{l.from}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
