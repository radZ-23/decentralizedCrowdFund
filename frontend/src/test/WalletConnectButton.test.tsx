import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import WalletConnectButton from '../components/ui/WalletConnectButton';

// Mock web3 utilities
vi.mock('../../utils/web3', () => ({
  connectWallet: vi.fn(),
  getCurrentWallet: vi.fn(),
  onAccountChanged: vi.fn(),
  removeListeners: vi.fn(),
}));

import { connectWallet, getCurrentWallet, onAccountChanged } from '../../utils/web3';

describe('WalletConnectButton', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
  });

  it('renders connect button when no wallet is connected', () => {
    vi.mocked(getCurrentWallet).mockResolvedValue(null);
    render(<WalletConnectButton />);

    expect(screen.getByText(/Connect Wallet/i)).toBeInTheDocument();
  });

  it('shows connecting state when connecting', async () => {
    vi.mocked(connectWallet).mockImplementation(() => new Promise((resolve) => setTimeout(() => resolve('0x123'), 100)));

    render(<WalletConnectButton />);
    fireEvent.click(screen.getByText(/Connect Wallet/i));

    expect(screen.getByText(/Connecting/i)).toBeInTheDocument();
  });

  it('displays wallet address when connected', async () => {
    const mockAddress = '0x1234567890abcdef1234567890abcdef12345678';
    vi.mocked(getCurrentWallet).mockResolvedValue(mockAddress);

    render(<WalletConnectButton />);

    // Wait for component to mount and check wallet
    await vi.advanceTimersByTimeAsync(100);

    expect(screen.getByText(/0x1234/i)).toBeInTheDocument();
    expect(screen.getByText(/Disconnect/i)).toBeInTheDocument();
  });

  it('calls onConnect callback when wallet connects', async () => {
    const mockOnConnect = vi.fn();
    const mockAddress = '0x1234567890abcdef1234567890abcdef12345678';
    vi.mocked(connectWallet).mockResolvedValue(mockAddress);

    render(<WalletConnectButton onConnect={mockOnConnect} />);
    fireEvent.click(screen.getByText(/Connect Wallet/i));

    await vi.waitFor(() => {
      expect(mockOnConnect).toHaveBeenCalledWith(mockAddress);
    });
  });

  it('shows error message when connection fails', async () => {
    vi.mocked(connectWallet).mockRejectedValue(new Error('User rejected'));

    render(<WalletConnectButton />);
    fireEvent.click(screen.getByText(/Connect Wallet/i));

    await vi.waitFor(() => {
      expect(screen.getByText(/User rejected/i)).toBeInTheDocument();
    });
  });

  it('renders in compact mode', () => {
    render(<WalletConnectButton compact />);

    expect(screen.getByText(/Connect/i)).toBeInTheDocument();
  });

  it('has mock connect button when MetaMask not installed', () => {
    // Simulate no window.ethereum
    Object.defineProperty(window, 'ethereum', {
      value: undefined,
      writable: true,
    });

    render(<WalletConnectButton />);

    expect(screen.getByText(/Mock Connect/i)).toBeInTheDocument();
  });
});
