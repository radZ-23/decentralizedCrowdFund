/**
 * Web3 Utility Functions for MedTrustFund
 * Handles wallet connection and blockchain interactions
 */

declare global {
  interface Window {
    ethereum?: any;
  }
}

/**
 * Check if MetaMask is installed
 */
export const isMetaMaskInstalled = () => {
  return typeof window.ethereum !== "undefined";
};

/**
 * Connect to MetaMask wallet
 */
export const connectWallet = async (): Promise<string> => {
  if (!isMetaMaskInstalled()) {
    throw new Error("MetaMask not installed. Please install at https://metamask.io");
  }

  try {
    const accounts = await window.ethereum.request({
      method: "eth_requestAccounts",
    });

    if (accounts.length === 0) {
      throw new Error("No accounts found. Please unlock your MetaMask wallet.");
    }

    return accounts[0];
  } catch (error: any) {
    throw new Error(`Failed to connect wallet: ${error.message}`);
  }
};

/**
 * Get current wallet address (if already connected)
 */
export const getCurrentWallet = async (): Promise<string | null> => {
  if (!isMetaMaskInstalled()) {
    return null;
  }

  try {
    const accounts = await window.ethereum.request({
      method: "eth_accounts",
    });

    return accounts.length > 0 ? accounts[0] : null;
  } catch (error) {
    console.error("Error getting current wallet:", error);
    return null;
  }
};

/**
 * Switch to a specific network (e.g., Polygon Amoy)
 */
export const switchNetwork = async (chainId: string) => {
  if (!isMetaMaskInstalled()) {
    throw new Error("MetaMask not installed");
  }

  try {
    await window.ethereum.request({
      method: "wallet_switchEthereumChain",
      params: [{ chainId }],
    });
  } catch (error: any) {
    // Chain not added to MetaMask
    if (error.code === 4902) {
      throw new Error("Network not added to MetaMask. Please add it manually.");
    }
    throw error;
  }
};

/**
 * Send a transaction to a smart contract
 */
export const sendTransaction = async (
  to: string,
  data: string,
  value?: string,
  gasLimit?: string
) => {
  if (!isMetaMaskInstalled()) {
    throw new Error("MetaMask not installed");
  }

  const transaction = {
    to,
    data,
    value: value || "0x0",
    ...(gasLimit && { gas: gasLimit }),
  };

  try {
    const txHash = await window.ethereum.request({
      method: "eth_sendTransaction",
      params: [transaction],
    });

    return txHash;
  } catch (error: any) {
    if (error.code === 4001) {
      throw new Error("Transaction rejected by user");
    }
    throw new Error(`Transaction failed: ${error.message}`);
  }
};

/**
 * Sign a message with the connected wallet
 */
export const signMessage = async (message: string): Promise<string> => {
  if (!isMetaMaskInstalled()) {
    throw new Error("MetaMask not installed");
  }

  try {
    const signature = await window.ethereum.request({
      method: "personal_sign",
      params: [message, (await getCurrentWallet())!],
    });

    return signature;
  } catch (error: any) {
    if (error.code === 4001) {
      throw new Error("Signature rejected by user");
    }
    throw new Error(`Signature failed: ${error.message}`);
  }
};

/**
 * Format ETH value to wei
 */
export const ethToWei = (eth: string | number): string => {
  const wei = BigInt(Math.floor(Number(eth) * 1e18));
  return "0x" + wei.toString(16);
};

/**
 * Format wei to ETH
 */
export const weiToEth = (wei: string | number | bigint): string => {
  const weiBigInt = BigInt(wei);
  const eth = Number(weiBigInt) / 1e18;
  return eth.toFixed(4);
};

/**
 * Listen for account changes
 */
export const onAccountChanged = (callback: (accounts: string[]) => void) => {
  if (isMetaMaskInstalled()) {
    window.ethereum.on("accountsChanged", callback);
  }
};

/**
 * Listen for network changes
 */
export const onNetworkChanged = (callback: (chainId: string) => void) => {
  if (isMetaMaskInstalled()) {
    window.ethereum.on("chainChanged", callback);
  }
};

/**
 * Remove listeners (call on component unmount)
 */
export const removeListeners = () => {
  if (isMetaMaskInstalled()) {
    window.ethereum.removeAllListeners();
  }
};
