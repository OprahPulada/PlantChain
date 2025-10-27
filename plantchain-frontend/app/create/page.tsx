"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ethers } from "ethers";
import { PlantChainABI } from "@/abi/PlantChainABI";
import { PlantChainAddresses } from "@/abi/PlantChainAddresses";
import { uploadToPinata } from "@/utils/ipfs";

export default function CreatePlantPage() {
  const router = useRouter();
  const [formData, setFormData] = useState({
    name: "",
    species: "花卉",
    description: "",
  });
  const [image, setImage] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [statusMessage, setStatusMessage] = useState("");

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setImage(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setImagePreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.name) {
      alert("请输入植物名称");
      return;
    }

    if (!image) {
      alert("请上传植物照片");
      return;
    }

    setIsSubmitting(true);
    setStatusMessage("正在上传图片到 IPFS...");

    try {
      // 1. 上传图片到 IPFS
      const imageCID = await uploadToPinata(image);
      setStatusMessage("图片上传成功！正在创建植物记录...");

      // 2. 连接合约
      if (typeof window === "undefined" || !(window as any).ethereum) {
        alert("请安装 MetaMask");
        return;
      }

      const provider = new ethers.BrowserProvider((window as any).ethereum);
      const signer = await provider.getSigner();
      const chainId = (await provider.getNetwork()).chainId;
      const contractInfo = (PlantChainAddresses as any)[chainId.toString()];

      if (!contractInfo?.address) {
        alert("合约未部署在当前网络");
        return;
      }

      const contract = new ethers.Contract(
        contractInfo.address,
        PlantChainABI.abi,
        signer
      );

      // 3. 调用合约创建植物
      setStatusMessage("等待交易确认...");
      const tx = await contract.createPlant(
        formData.name,
        formData.species,
        formData.description,
        imageCID
      );

      setStatusMessage("交易已提交，等待确认...");
      await tx.wait();

      setStatusMessage("植物创建成功！");
      
      // 跳转回首页
      setTimeout(() => {
        router.push("/");
      }, 1500);
    } catch (error: any) {
      console.error("创建植物失败:", error);
      setStatusMessage(`创建失败: ${error.message}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="container">
      <div className="form-container">
        <h1 className="form-title">🌱 创建植物记录</h1>

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label className="form-label">植物名称 *</label>
            <input
              type="text"
              className="form-input"
              placeholder="给你的植物起个名字"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              disabled={isSubmitting}
            />
          </div>

          <div className="form-group">
            <label className="form-label">植物种类 *</label>
            <select
              className="form-select"
              value={formData.species}
              onChange={(e) => setFormData({ ...formData, species: e.target.value })}
              disabled={isSubmitting}
            >
              <option value="花卉">🌸 花卉</option>
              <option value="盆栽">🪴 盆栽</option>
              <option value="树木">🌳 树木</option>
              <option value="草本">🌿 草本</option>
              <option value="其他">🌱 其他</option>
            </select>
          </div>

          <div className="form-group">
            <label className="form-label">植物简介</label>
            <textarea
              className="form-textarea"
              placeholder="描述一下你的植物..."
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              disabled={isSubmitting}
            />
          </div>

          <div className="form-group">
            <label className="form-label">植物照片 *</label>
            <label className="file-upload">
              <input
                type="file"
                accept="image/*"
                onChange={handleImageChange}
                disabled={isSubmitting}
              />
              {imagePreview ? (
                <img src={imagePreview} alt="预览" className="file-preview" />
              ) : (
                <div>
                  <div style={{ fontSize: "3rem", marginBottom: "1rem" }}>📷</div>
                  <p style={{ color: "var(--color-text-light)" }}>
                    点击上传图片
                  </p>
                </div>
              )}
            </label>
          </div>

          {statusMessage && (
            <div style={{
              padding: "1rem",
              background: "var(--bg-primary)",
              borderRadius: "12px",
              marginBottom: "1rem",
              textAlign: "center",
              color: "var(--color-primary)",
              fontWeight: "600"
            }}>
              {statusMessage}
            </div>
          )}

          <div style={{ display: "flex", gap: "1rem" }}>
            <button
              type="button"
              className="btn btn-outline"
              onClick={() => router.push("/")}
              disabled={isSubmitting}
              style={{ flex: 1 }}
            >
              取消
            </button>
            <button
              type="submit"
              className="btn btn-primary"
              disabled={isSubmitting}
              style={{ flex: 1 }}
            >
              {isSubmitting ? "创建中..." : "创建植物"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}




