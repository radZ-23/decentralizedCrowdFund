import { useState, useEffect } from "react";
import {
  connectWallet,
  getCurrentWallet,
  isMetaMaskInstalled,
  onAccountChanged,
  onNetworkChanged,
  removeListeners,
} from "../../utils/web3";

interface WalletConnectButtonProps {
  onConnect?: (address: string) => void;
  compact?: boolean;
}

export default function WalletConnectButton({ onConnect, compact = false }: WalletConnectButtonProps) {
  const [walletAddress, setWalletAddress] = useState<string>("");
  const [chainIdHex, setChainIdHex] = useState<string | null>(null);
  const [connecting, setConnecting] = useState(false);
  const [error, setError] = useState("");

  const refreshChainId = async () => {
    if (!isMetaMaskInstalled()) {
      setChainIdHex(null);
      return;
    }
    try {
      const id = await window.ethereum.request({ method: "eth_chainId" });
      setChainIdHex(typeof id === "string" ? id : null);
    } catch {
      setChainIdHex(null);
    }
  };

  useEffect(() => {
    // Check if wallet was previously connected
    const savedWallet = localStorage.getItem("walletAddress");
    if (savedWallet) {
      setWalletAddress(savedWallet);
    }

    // Check current wallet on mount
    checkCurrentWallet();
    refreshChainId();

    // Listen for account changes (MetaMask switches account in real time)
    onAccountChanged((accounts: string[]) => {
      if (accounts.length > 0) {
        setWalletAddress(accounts[0]);
        localStorage.setItem("walletAddress", accounts[0]);
        onConnect?.(accounts[0]);
      } else {
        setWalletAddress("");
        localStorage.removeItem("walletAddress");
      }
    });

    onNetworkChanged(() => {
      refreshChainId();
    });

    return () => {
      removeListeners();
    };
  }, []);

  const checkCurrentWallet = async () => {
    try {
      const wallet = await getCurrentWallet();
      if (wallet) {
        setWalletAddress(wallet);
        localStorage.setItem("walletAddress", wallet);
      }
    } catch (err) {
      console.error("Error checking current wallet:", err);
    }
  };

  const handleConnect = async () => {
    setError("");
    if (!isMetaMaskInstalled()) {
      return;
    }
    setConnecting(true);
    try {
      const address = await connectWallet();
      setWalletAddress(address);
      localStorage.setItem("walletAddress", address);
      onConnect?.(address);
      await refreshChainId();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setConnecting(false);
    }
  };

  const handleDisconnect = () => {
    setWalletAddress("");
    localStorage.removeItem("walletAddress");
    setError("");
  };

  const truncateAddress = (address: string) => {
    return `${address.slice(0, 6)}...${address.slice(-4)}`;
  };

  const copyToClipboard = async () => {
    try {
      await navigator.clipboard.writeText(walletAddress);
      alert("Address copied to clipboard!");
    } catch (err) {
      console.error("Failed to copy:", err);
    }
  };

  const chainLabel =
    chainIdHex != null
      ? `Chain ${parseInt(chainIdHex, 16)}`
      : null;

  if (walletAddress) {
    return (
      <div className="flex flex-col items-end sm:flex-row sm:items-center gap-1 sm:gap-2">
        <div className="flex flex-col items-end sm:items-start gap-0.5">
          <div className="flex items-center gap-2 px-3 py-2 bg-green-50 border border-green-200 rounded-lg dark:bg-emerald-950/40 dark:border-emerald-500/30">
            <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse shrink-0" />
            <span
              className="text-sm font-mono text-green-800 dark:text-emerald-200 cursor-pointer hover:text-green-900 dark:hover:text-emerald-100"
              onClick={copyToClipboard}
              title={walletAddress}
            >
              {truncateAddress(walletAddress)}
            </span>
          </div>
          {chainLabel && (
            <span className="text-[10px] font-mono text-slate-500 dark:text-slate-400 px-1" title="Updates when you switch network in the wallet">
              {chainLabel} · live
            </span>
          )}
        </div>
        <button
          onClick={handleDisconnect}
          className="px-3 py-2 text-sm text-red-600 hover:bg-red-50 rounded-lg transition"
        >
          Disconnect
        </button>
      </div>
    );
  }

  if (compact) {
    if (!isMetaMaskInstalled()) {
      return (
        <a
          href="https://metamask.io/download/"
          target="_blank"
          rel="noopener noreferrer"
          className="px-3 py-1.5 bg-slate-700/80 text-slate-200 text-sm font-medium rounded-lg border border-slate-600 hover:bg-slate-600 transition"
        >
          Install wallet
        </a>
      );
    }
    return (
      <button
        type="button"
        onClick={handleConnect}
        disabled={connecting}
        className="px-3 py-1.5 bg-gradient-to-r from-purple-600 to-purple-900 text-white text-sm font-medium rounded-lg hover:shadow-md transition disabled:opacity-50"
      >
        {connecting ? "Connecting..." : "🔗 Connect"}
      </button>
    );
  }

  if (!isMetaMaskInstalled()) {
    return (
      <div className="w-full space-y-3 rounded-xl border border-amber-500/25 bg-amber-950/20 px-4 py-4">
        <p className="text-sm text-amber-100/90 text-center leading-relaxed">
          No Ethereum wallet extension was detected in this browser (for example{" "}
          <a
            href="https://metamask.io/download/"
            target="_blank"
            rel="noopener noreferrer"
            className="text-purple-300 underline underline-offset-2 hover:text-purple-200"
          >
            MetaMask
          </a>
          ). That is normal on a fresh machine or if you use a browser without extensions.
        </p>
        <button
          type="button"
          onClick={() => {
            const mockAddress =
              "0x" +
              Array.from({ length: 40 }, () => Math.floor(Math.random() * 16).toString(16)).join("");
            setWalletAddress(mockAddress);
            localStorage.setItem("walletAddress", mockAddress);
            setError("");
            onConnect?.(mockAddress);
          }}
          className="w-full px-4 py-3 bg-slate-800 border border-slate-600 text-slate-200 text-sm font-medium rounded-lg hover:bg-slate-700 transition"
        >
          🧪 Mock connect (local testing without MetaMask)
        </button>
      </div>
    );
  }

  return (
    <div className="w-full">
      <button
        type="button"
        onClick={handleConnect}
        disabled={connecting}
        className="w-full px-4 py-3 bg-gradient-to-r from-purple-600 to-purple-900 text-white font-semibold rounded-lg hover:shadow-lg transition disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {connecting ? (
          <span className="flex items-center justify-center gap-2">
            <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
            Connecting...
          </span>
        ) : (
          "🔗 Connect Wallet"
        )}
      </button>
      {error ? (
        <p className="mt-2 text-sm text-red-400 text-center">{error}</p>
      ) : null}
    </div>
  );
}
