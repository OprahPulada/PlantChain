"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter, useParams } from "next/navigation";
import { ethers } from "ethers";
import { PlantChainABI } from "@/abi/PlantChainABI";
import { PlantChainAddresses } from "@/abi/PlantChainAddresses";
import { getIpfsUrl, uploadToPinata } from "@/utils/ipfs";
import { loadRelayerSDK } from "@/fhevm/internal/RelayerSDKLoader";

interface PlantDetail {
  id: string;
  owner: string;
  name: string;
  species: string;
  description: string;
  imageCID: string;
  createdAt: number;
}

interface GrowthLog {
  logId: string;
  description: string;
  imageCID: string;
  timestamp: number;
}

export default function PlantDetailPage() {
  const params = useParams();
  const router = useRouter();
  const plantId = params.id as string;

  const [plant, setPlant] = useState<PlantDetail | null>(null);
  const [logs, setLogs] = useState<GrowthLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [isOwner, setIsOwner] = useState(false);
  const [isMinted, setIsMinted] = useState(false);
  
  // 添加日志表单
  const [showLogForm, setShowLogForm] = useState(false);
  const [logDescription, setLogDescription] = useState("");
  const [logImage, setLogImage] = useState<File | null>(null);
  const [isSubmittingLog, setIsSubmittingLog] = useState(false);

  // 生态积分（FHE）
  const [ecoHandle, setEcoHandle] = useState<string | undefined>(undefined);
  const [ecoClear, setEcoClear] = useState<string | undefined>(undefined);
  const [ecoBusy, setEcoBusy] = useState(false);

  useEffect(() => {
    loadPlantDetail();
  }, [plantId]);

  const getProviderSigner = async () => {
    const provider = new ethers.BrowserProvider((window as any).ethereum);
    const signer = await provider.getSigner();
    return { provider, signer } as const;
  };

  const loadPlantDetail = async () => {
    if (typeof window === "undefined" || !(window as any).ethereum) return;

    try {
      const { provider, signer } = await getProviderSigner();
      const userAddress = await signer.getAddress();
      const chainId = (await provider.getNetwork()).chainId;
      const contractInfo = (PlantChainAddresses as any)[chainId.toString()];

      if (!contractInfo?.address) return;

      const contract = new ethers.Contract(
        contractInfo.address,
        PlantChainABI.abi,
        provider
      );

      const plantData = await contract.getPlant(plantId);
      const logsData = await contract.getGrowthLogs(plantId);
      const minted = await contract.plantMinted(plantId);

      setPlant({
        id: plantId,
        owner: plantData.owner,
        name: plantData.name,
        species: plantData.species,
        description: plantData.description,
        imageCID: plantData.imageCID,
        createdAt: Number(plantData.createdAt),
      });

      setLogs(
        logsData.map((log: any) => ({
          logId: log.logId.toString(),
          description: log.description,
          imageCID: log.imageCID,
          timestamp: Number(log.timestamp),
        }))
      );

      setIsOwner(plantData.owner.toLowerCase() === userAddress.toLowerCase());
      setIsMinted(minted);

      // load eco handle for current user
      const h = await contract.getEcoPoints(userAddress);
      setEcoHandle(h);
    } catch (error) {
      console.error("加载植物详情失败:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleAddLog = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!logDescription) {
      alert("请输入日志内容");
      return;
    }

    setIsSubmittingLog(true);

    try {
      let imageCID = "";
      if (logImage) {
        imageCID = await uploadToPinata(logImage);
      }

      const { provider, signer } = await getProviderSigner();
      const chainId = (await provider.getNetwork()).chainId;
      const contractInfo = (PlantChainAddresses as any)[chainId.toString()];

      const contract = new ethers.Contract(
        contractInfo.address,
        PlantChainABI.abi,
        signer
      );

      const tx = await contract.addGrowthLog(plantId, logDescription, imageCID);
      await tx.wait();

      // 重新加载数据（会看到积分+1）
      await loadPlantDetail();
      setShowLogForm(false);
      setLogDescription("");
      setLogImage(null);
    } catch (error: any) {
      console.error("添加日志失败:", error);
      alert("添加日志失败: " + error.message);
    } finally {
      setIsSubmittingLog(false);
    }
  };

  const handleMintNFT = async () => {
    if (!window.confirm("确定要将这株植物铸造成 NFT 吗？")) return;

    try {
      const { provider, signer } = await getProviderSigner();
      const chainId = (await provider.getNetwork()).chainId;
      const contractInfo = (PlantChainAddresses as any)[chainId.toString()];

      const contract = new ethers.Contract(
        contractInfo.address,
        PlantChainABI.abi,
        signer
      );

      const tx = await contract.mintPlantNFT(plantId);
      await tx.wait();

      alert("NFT 铸造成功！");
      setIsMinted(true);
    } catch (error: any) {
      console.error("铸造 NFT 失败:", error);
      alert("铸造失败: " + error.message);
    }
  };

  // === 生态积分：刷新/公共解密/加1分(FHE)/给TA加1分(FHE) ===
  const refreshPoints = useCallback(async () => {
    try {
      const { provider, signer } = await getProviderSigner();
      const chainId = (await provider.getNetwork()).chainId;
      const info = (PlantChainAddresses as any)[chainId.toString()];
      const contract = new ethers.Contract(info.address, PlantChainABI.abi, provider);
      const h = await contract.getEcoPoints(await signer.getAddress());
      setEcoHandle(h);
    } catch {}
  }, []);

  const decryptPublic = async () => {
    if (!ecoHandle) return;
    setEcoBusy(true);
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
      const value = await instance.decryptPublic(info.address, ecoHandle);
      setEcoClear(String(value));
    } catch (e) {
      alert("公共解密失败：如需解密私密数据，可前往\"我的积分\"页面进行用户解密");
    } finally {
      setEcoBusy(false);
    }
  };

  const addPointFHE = async () => {
    setEcoBusy(true);
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
      const contract = new ethers.Contract(info.address, PlantChainABI.abi, signer);

      const input = instance.createEncryptedInput(info.address, await signer.getAddress());
      input.add32(1n);
      const enc = await input.encrypt();
      const tx = await contract.addEcoPoints(enc.handles[0], enc.inputProof);
      await tx.wait();

      await refreshPoints();
    } catch (e: any) {
      alert("加分失败：" + e?.message);
    } finally {
      setEcoBusy(false);
    }
  };

  const tipPointToOwner = async () => {
    if (!plant) return;
    setEcoBusy(true);
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
      const contract = new ethers.Contract(info.address, PlantChainABI.abi, signer);

      const input = instance.createEncryptedInput(info.address, await signer.getAddress());
      input.add32(1n);
      const enc = await input.encrypt();
      const tx = await contract.tipEcoPointOne(plant.id, enc.handles[0], enc.inputProof);
      await tx.wait();

      alert("已为创作者加 1 分！");
    } catch (e: any) {
      alert("加分失败：" + (e?.message ?? e));
    } finally {
      setEcoBusy(false);
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

  if (!plant) {
    return (
      <div className="container">
        <div className="empty-state">
          <div className="empty-state-icon">❌</div>
          <h2 className="empty-state-title">植物不存在</h2>
        </div>
      </div>
    );
  }

  return (
    <div className="container detail-container">
      <button
        onClick={() => router.push("/")}
        className="btn btn-outline"
        style={{ marginBottom: "2rem" }}
      >
        ← 返回列表
      </button>

      <div className="detail-header">
        <img
          src={plant.imageCID ? getIpfsUrl(plant.imageCID) : ""}
          alt={plant.name}
          className="detail-image"
          onError={(e) => {
            (e.target as HTMLImageElement).src = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='800' height='400'%3E%3Crect fill='%23C8E6C9' width='800' height='400'/%3E%3Ctext fill='%2343A047' font-size='48' font-family='sans-serif' x='50%25' y='50%25' text-anchor='middle' dy='.3em'%3E🌿%3C/text%3E%3C/svg%3E";
          }}
        />

        <h1 className="detail-title">{plant.name}</h1>
        <p style={{ color: "var(--color-text-light)", fontSize: "1.1rem" }}>
          {plant.description}
        </p>

        <div className="detail-meta">
          <div className="detail-meta-item">
            <div className="detail-meta-label">种类</div>
            <div className="detail-meta-value">🌿 {plant.species}</div>
          </div>
          <div className="detail-meta-item">
            <div className="detail-meta-label">种植日期</div>
            <div className="detail-meta-value">
              {new Date(plant.createdAt * 1000).toLocaleDateString("zh-CN")}
            </div>
          </div>
          <div className="detail-meta-item">
            <div className="detail-meta-label">成长记录</div>
            <div className="detail-meta-value">{logs.length} 条日志</div>
          </div>
        </div>

        <div className="detail-actions">
          {isOwner ? (
            <>
              <button
                onClick={() => setShowLogForm(!showLogForm)}
                className="btn btn-secondary"
              >
                {showLogForm ? "取消" : "➕ 添加日志（自动+1积分）"}
              </button>
              {!isMinted && (
                <button onClick={handleMintNFT} className="btn btn-primary">
                  🎨 铸造 NFT
                </button>
              )}
              <button onClick={() => router.push(`/nft/${plant.id}`)} className="btn btn-outline">
                👀 预览 NFT 元数据
              </button>
            </>
          ) : (
            <>
              <button className="btn btn-secondary" onClick={tipPointToOwner} disabled={ecoBusy}>给 TA 加 1 分（FHE）</button>
            </>
          )}
        </div>
      </div>

      {/* 积分组件（仅自己可见完整操作） */}
      {isOwner && (
        <div className="form-container" style={{ marginTop: "1.5rem" }}>
          <h3 style={{ color: "var(--color-primary)", marginBottom: "1rem" }}>🌎 我的环保积分</h3>
          <p style={{ color: "var(--color-text-light)", marginBottom: "1rem" }}>
            规则：创建植物 +1，添加日志 +1。你也可以使用 FHE 加密方式模拟加 1 分。
          </p>
          <div className="form-group">
            <label className="form-label">密文句柄</label>
            <input className="form-input" value={ecoHandle ?? "-"} readOnly />
          </div>
          <div className="form-group">
            <label className="form-label">解密结果</label>
            <input className="form-input" value={ecoClear ?? "-"} readOnly />
          </div>
          <div style={{ display: "flex", gap: "0.75rem" }}>
            <button className="btn btn-outline" onClick={refreshPoints} disabled={ecoBusy}>刷新积分</button>
            <button className="btn btn-primary" onClick={decryptPublic} disabled={ecoBusy}>公共解密</button>
            <button className="btn btn-secondary" onClick={addPointFHE} disabled={ecoBusy}>加 1 分（FHE）</button>
            <button className="btn btn-outline" onClick={() => router.push("/points")}>前往“我的积分”</button>
          </div>
        </div>
      )}

      {showLogForm && (
        <div className="form-container" style={{ marginBottom: "2rem" }}>
          <h3 style={{ fontSize: "1.5rem", marginBottom: "1.5rem", color: "var(--color-primary)" }}>
            添加成长日志
          </h3>
          <form onSubmit={handleAddLog}>
            <div className="form-group">
              <label className="form-label">日志内容 *</label>
              <textarea
                className="form-textarea"
                placeholder="记录植物的成长变化..."
                value={logDescription}
                onChange={(e) => setLogDescription(e.target.value)}
                disabled={isSubmittingLog}
              />
            </div>
            <div className="form-group">
              <label className="form-label">照片（可选）</label>
              <input
                type="file"
                accept="image/*"
                onChange={(e) => setLogImage(e.target.files?.[0] || null)}
                disabled={isSubmittingLog}
                className="form-input"
              />
            </div>
            <button
              type="submit"
              className="btn btn-primary"
              disabled={isSubmittingLog}
              style={{ width: "100%" }}
            >
              {isSubmittingLog ? "提交中..." : "提交日志"}
            </button>
          </form>
        </div>
      )}

      {logs.length > 0 && (
        <div style={{ marginTop: "3rem" }}>
          <h2 style={{ fontSize: "2rem", fontWeight: "bold", marginBottom: "2rem", color: "var(--color-primary)" }}>
            📝 成长时间线
          </h2>
          <div className="timeline">
            {logs.map((log) => (
              <div key={log.logId} className="timeline-item">
                <div className="timeline-content">
                  <div className="timeline-date">
                    {new Date(log.timestamp * 1000).toLocaleString("zh-CN")}
                  </div>
                  <div className="timeline-description">{log.description}</div>
                  {log.imageCID && (
                    <img
                      src={getIpfsUrl(log.imageCID)}
                      alt="成长照片"
                      className="timeline-image"
                    />
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {logs.length === 0 && (
        <div className="empty-state" style={{ marginTop: "3rem" }}>
          <div className="empty-state-icon">📝</div>
          <h3 className="empty-state-title">还没有成长日志</h3>
          <p className="empty-state-text">开始记录植物的成长历程吧！</p>
        </div>
      )}
    </div>
  );
}

