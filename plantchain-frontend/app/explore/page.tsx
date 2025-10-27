"use client";

import { useState } from "react";
import { ethers } from "ethers";
import { PlantChainABI } from "@/abi/PlantChainABI";
import { PlantChainAddresses } from "@/abi/PlantChainAddresses";
import { getIpfsUrl } from "@/utils/ipfs";
import { useRouter } from "next/navigation";

export default function ExplorePage() {
  const [target, setTarget] = useState("");
  const [loading, setLoading] = useState(false);
  const [plants, setPlants] = useState<any[]>([]);
  const router = useRouter();

  const load = async () => {
    if (!ethers.isAddress(target)) {
      alert("请输入有效的钱包地址");
      return;
    }

    setLoading(true);
    setPlants([]);

    try {
      const provider = new ethers.BrowserProvider((window as any).ethereum);
      const chainId = (await provider.getNetwork()).chainId;
      const contractInfo = (PlantChainAddresses as any)[chainId.toString()];
      if (!contractInfo?.address) {
        alert("合约未部署在当前网络");
        return;
      }
      const contract = new ethers.Contract(contractInfo.address, PlantChainABI.abi, provider);
      const ids = await contract.getMyPlants(target);
      const arr: any[] = [];
      for (const id of ids) {
        const p = await contract.getPlant(id);
        arr.push({ id: id.toString(), name: p.name, species: p.species, imageCID: p.imageCID });
      }
      setPlants(arr);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="container">
      <h1 style={{ fontSize: "2rem", color: "var(--color-primary)", marginBottom: "1rem" }}>探索他人植物</h1>
      <div style={{ display: "flex", gap: "0.5rem", marginBottom: "1rem" }}>
        <input
          className="form-input"
          placeholder="输入钱包地址，例如 0x..."
          value={target}
          onChange={(e) => setTarget(e.target.value)}
          style={{ flex: 1 }}
        />
        <button onClick={load} className="btn btn-primary">查询</button>
      </div>

      {loading && (
        <div className="loading"><div className="spinner"></div></div>
      )}

      <div className="card-grid">
        {plants.map((plant) => (
          <div key={plant.id} className="plant-card" onClick={() => router.push(`/plant/${plant.id}`)}>
            <img src={plant.imageCID ? getIpfsUrl(plant.imageCID) : "/placeholder-plant.jpg"} className="plant-card-image" />
            <div className="plant-card-content">
              <div className="plant-card-title">{plant.name}</div>
              <div className="plant-card-species">{plant.species}</div>
            </div>
          </div>
        ))}
      </div>

      {!loading && plants.length === 0 && (
        <div className="empty-state" style={{ marginTop: "2rem" }}>
          <div className="empty-state-icon">🔍</div>
          <div className="empty-state-title">暂无结果</div>
          <div className="empty-state-text">请输入地址后点击查询</div>
        </div>
      )}
    </div>
  );
}



