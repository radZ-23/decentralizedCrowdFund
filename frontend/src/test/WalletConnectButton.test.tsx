import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import WalletConnectButton from '../components/ui/WalletConnectButton';

// Mock web3 utilities
vi.mock('../utils/web3', () => ({
  connectWallet: vi.fn(),
  getCurrentWallet: vi.fn(),
  onAccountChanged: vi.fn(),
  onNetworkChanged: vi.fn(),
  removeListeners: vi.fn(),
  isMetaMaskInstalled: vi.fn(() => true),
}));

import {
  connectWallet,
  getCurrentWallet,
  onAccountChanged,
  onNetworkChanged,
  removeListeners,
  isMetaMaskInstalled,
} from '../utils/web3';

describe('WalletConnectButton', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(isMetaMaskInstalled).mockReturnValue(true);
    localStorage.clear();
    // Reset window.ethereum
    Object.defineProperty(window, 'ethereum', {
      value: {
        isMetaMask: true,
        request: vi.fn().mockResolvedValue('0x539'),
      },
      writable: true,
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('renders connect button when no wallet is connected', async () => {
    vi.mocked(getCurrentWallet).mockResolvedValue(null);
    vi.mocked(onAccountChanged).mockImplementation(() => {});
    vi.mocked(onNetworkChanged).mockImplementation(() => {});
    vi.mocked(removeListeners).mockImplementation(() => {});

    render(<WalletConnectButton />);

    await waitFor(() => {
      expect(screen.getByText(/Connect Wallet/i)).toBeInTheDocument();
    });
  });

  it('shows connecting state when connecting', async () => {
    vi.mocked(getCurrentWallet).mockResolvedValue(null);
    vi.mocked(onAccountChanged).mockImplementation(() => {});
    vi.mocked(onNetworkChanged).mockImplementation(() => {});
    vi.mocked(removeListeners).mockImplementation(() => {});
    vi.mocked(connectWallet).mockImplementation(() => new Promise((resolve) => setTimeout(() => resolve('0x123'), 100)));

    render(<WalletConnectButton />);
    await waitFor(() => screen.getByText(/Connect Wallet/i));
    fireEvent.click(screen.getByText(/Connect Wallet/i));

    await waitFor(() => {
      expect(screen.getByText(/Connecting/i)).toBeInTheDocument();
    });
  });

  it('displays wallet address when connected', async () => {
    const mockAddress = '0x1234567890abcdef1234567890abcdef12345678';
    vi.mocked(getCurrentWallet).mockResolvedValue(mockAddress);
    vi.mocked(onAccountChanged).mockImplementation(() => {});
    vi.mocked(onNetworkChanged).mockImplementation(() => {});
    vi.mocked(removeListeners).mockImplementation(() => {});

    render(<WalletConnectButton />);

    await waitFor(() => {
      expect(screen.getByText(/0x1234/i)).toBeInTheDocument();
    });
    expect(screen.getByText(/Disconnect/i)).toBeInTheDocument();
  });

  it('calls onConnect callback when wallet connects', async () => {
    const mockOnConnect = vi.fn();
    const mockAddress = '0x1234567890abcdef1234567890abcdef12345678';
    vi.mocked(getCurrentWallet).mockResolvedValue(null);
    vi.mocked(onAccountChanged).mockImplementation(() => {});
    vi.mocked(onNetworkChanged).mockImplementation(() => {});
    vi.mocked(removeListeners).mockImplementation(() => {});
    vi.mocked(connectWallet).mockResolvedValue(mockAddress);

    render(<WalletConnectButton onConnect={mockOnConnect} />);
    await waitFor(() => screen.getByText(/Connect Wallet/i));
    fireEvent.click(screen.getByText(/Connect Wallet/i));

    await waitFor(() => {
      expect(mockOnConnect).toHaveBeenCalledWith(mockAddress);
    });
  });

  it('shows error message when connection fails', async () => {
    vi.mocked(getCurrentWallet).mockResolvedValue(null);
    vi.mocked(onAccountChanged).mockImplementation(() => {});
    vi.mocked(onNetworkChanged).mockImplementation(() => {});
    vi.mocked(removeListeners).mockImplementation(() => {});
    vi.mocked(connectWallet).mockRejectedValue(new Error('User rejected'));

    render(<WalletConnectButton />);
    await waitFor(() => screen.getByText(/Connect Wallet/i));
    fireEvent.click(screen.getByText(/Connect Wallet/i));

    await waitFor(() => {
      expect(screen.getByText(/User rejected/i)).toBeInTheDocument();
    });
  });

  it('renders in compact mode', async () => {
    vi.mocked(getCurrentWallet).mockResolvedValue(null);
    vi.mocked(onAccountChanged).mockImplementation(() => {});
    vi.mocked(onNetworkChanged).mockImplementation(() => {});
    vi.mocked(removeListeners).mockImplementation(() => {});

    render(<WalletConnectButton compact />);

    await waitFor(() => {
      expect(screen.getByText(/Connect/i)).toBeInTheDocument();
    });
  });

  it('has mock connect button when MetaMask not installed', async () => {
    Object.defineProperty(window, 'ethereum', {
      value: undefined,
      writable: true,
    });

    vi.mocked(isMetaMaskInstalled).mockReturnValue(false);
    vi.mocked(getCurrentWallet).mockResolvedValue(null);
    vi.mocked(onAccountChanged).mockImplementation(() => {});
    vi.mocked(onNetworkChanged).mockImplementation(() => {});
    vi.mocked(removeListeners).mockImplementation(() => {});

    render(<WalletConnectButton />);

    await waitFor(() => {
      expect(screen.getByText(/Mock Connect/i)).toBeInTheDocument();
    });
  });
});
