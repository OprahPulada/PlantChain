"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ethers } from "ethers";
import { PlantChainABI } from "@/abi/PlantChainABI";
import { PlantChainAddresses } from "@/abi/PlantChainAddresses";
import { getIpfsUrl } from "@/utils/ipfs";

interface Plant {
  id: string;
  name: string;
  species: string;
  imageCID: string;
  logsCount: number;
}

export default function HomePage() {
  const [plants, setPlants] = useState<Plant[]>([]);
  const [loading, setLoading] = useState(true);
  const [userAddress, setUserAddress] = useState<string | undefined>(undefined);
  const router = useRouter();

  useEffect(() => {
    loadPlants();
  }, []);

  const loadPlants = async () => {
    if (typeof window === "undefined" || !(window as any).ethereum) {
      setLoading(false);
      return;
    }

    try {
      const provider = new ethers.BrowserProvider((window as any).ethereum);
      const signer = await provider.getSigner();
      const address = await signer.getAddress();
      setUserAddress(address);

      const chainId = (await provider.getNetwork()).chainId;
      const contractInfo = (PlantChainAddresses as any)[chainId.toString()];
      
      if (!contractInfo?.address) {
        console.log("合约未部署在当前网络");
        setLoading(false);
        return;
      }

      const contract = new ethers.Contract(
        contractInfo.address,
        PlantChainABI.abi,
        provider
      );

      const plantIds = await contract.getMyPlants(address);
      const plantsData: Plant[] = [];

      for (const id of plantIds) {
        const plant = await contract.getPlant(id);
        const logs = await contract.getGrowthLogs(id);
        
        plantsData.push({
          id: id.toString(),
          name: plant.name,
          species: plant.species,
          imageCID: plant.imageCID,
          logsCount: logs.length,
        });
      }

      setPlants(plantsData);
    } catch (error) {
      console.error("加载植物列表失败:", error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="container">
        <div className="loading">
          <div className="spinner"></div>
          <p style={{ marginTop: "1rem" }}>加载中...</p>
        </div>
      </div>
    );
  }

  if (!userAddress) {
    return (
      <div className="container">
        <div className="empty-state">
          <div className="empty-state-icon">🔒</div>
          <h2 className="empty-state-title">请先连接钱包</h2>
          <p className="empty-state-text">
            点击右上角"连接钱包"按钮开始使用 PlantChain
          </p>
        </div>
      </div>
    );
  }

  if (plants.length === 0) {
    return (
      <div className="container">
        <div className="empty-state">
          <div className="empty-state-icon">🌱</div>
          <h2 className="empty-state-title">还没有植物记录</h2>
          <p className="empty-state-text">
            开始创建你的第一株植物吧！
          </p>
          <button
            onClick={() => router.push("/create")}
            className="btn btn-primary"
          >
            创建植物
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="container">
      <h1 style={{ fontSize: "2.5rem", fontWeight: "bold", marginBottom: "2rem", color: "var(--color-primary)" }}>
        我的植物
      </h1>

      <div className="card-grid">
        {plants.map((plant) => (
          <div
            key={plant.id}
            className="plant-card"
            onClick={() => router.push(`/p?id=${plant.id}`)}
          >
            <img
              src={plant.imageCID ? getIpfsUrl(plant.imageCID) : "/placeholder-plant.jpg"}
              alt={plant.name}
              className="plant-card-image"
              onError={(e) => {
                (e.target as HTMLImageElement).src = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='400' height='300'%3E%3Crect fill='%23C8E6C9' width='400' height='300'/%3E%3Ctext fill='%2343A047' font-size='24' font-family='sans-serif' x='50%25' y='50%25' text-anchor='middle' dy='.3em'%3E🌿%3C/text%3E%3C/svg%3E";
              }}
            />
            <div className="plant-card-content">
              <h3 className="plant-card-title">{plant.name}</h3>
              <p className="plant-card-species">🌿 {plant.species}</p>
              
              <div className="plant-card-progress">
                <div
                  className="plant-card-progress-bar"
                  style={{ width: `${Math.min(plant.logsCount * 10 + 20, 100)}%` }}
                ></div>
              </div>
              
              <div className="plant-card-meta">
                <span>📝 {plant.logsCount} 条日志</span>
                <span>👀 查看详情</span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
