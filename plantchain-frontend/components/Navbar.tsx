"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

export function Navbar() {
  const [address, setAddress] = useState<string | undefined>(undefined);
  const [isConnecting, setIsConnecting] = useState(false);
  const router = useRouter();

  useEffect(() => {
    checkConnection();
  }, []);

  const checkConnection = async () => {
    if (typeof window === "undefined" || !(window as any).ethereum) return;
    try {
      const accounts = await (window as any).ethereum.request({
        method: "eth_accounts",
      });
      if (accounts && accounts.length > 0) {
        setAddress(accounts[0]);
      }
    } catch {}
  };

  const connectWallet = async () => {
    if (typeof window === "undefined" || !(window as any).ethereum) {
      alert("请安装 MetaMask!");
      return;
    }

    setIsConnecting(true);
    try {
      const accounts = await (window as any).ethereum.request({
        method: "eth_requestAccounts",
      });
      if (accounts && accounts.length > 0) {
        setAddress(accounts[0]);
      }
    } catch (error) {
      console.error("连接失败:", error);
    } finally {
      setIsConnecting(false);
    }
  };

  const formatAddress = (addr: string) => {
    return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
  };

  return (
    <nav className="nav">
      <Link href="/" className="nav-logo">
        🌿 PlantChain
      </Link>
      
      <div className="nav-actions" style={{ gap: "0.75rem" }}>
        {address && (
          <>
            <Link href="/explore" className="btn btn-outline">探索</Link>
            <Link href="/points" className="btn btn-outline">我的积分</Link>
            <Link href="/points-records" className="btn btn-outline">积分记录</Link>
          </>
        )}
        {address ? (
          <>
            <button
              onClick={() => router.push("/create")}
              className="btn btn-secondary"
            >
              ➕ 创建植物
            </button>
            <div className="wallet-address">{formatAddress(address)}</div>
          </>
        ) : (
          <button
            onClick={connectWallet}
            disabled={isConnecting}
            className="btn btn-primary"
          >
            {isConnecting ? "连接中..." : "连接钱包"}
          </button>
        )}
      </div>
    </nav>
  );
}

