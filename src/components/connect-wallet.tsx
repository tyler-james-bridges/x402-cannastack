'use client';

// ConnectWallet — header control for connecting / disconnecting a browser
// wallet, showing the truncated address + connected chain, and prompting a
// switch to Base when on the wrong network. All signing/connection happens in
// the wallet's own UI; this component holds no secrets.

import { useEffect, useMemo, useRef, useState } from 'react';
import { getAddress } from 'viem';
import { base } from 'viem/chains';
import {
  useAccount,
  useChainId,
  useConnect,
  useDisconnect,
  useSwitchChain,
} from 'wagmi';
import { hasWalletConnect } from '@/lib/wagmi';
import type { Connector } from 'wagmi';

function truncate(addr: string) {
  const a = getAddress(addr);
  return `${a.slice(0, 6)}…${a.slice(-4)}`;
}

const connectorLabels: Record<string, string> = {
  injected: 'Browser wallet',
  metaMask: 'MetaMask',
  metaMaskSDK: 'MetaMask',
  coinbaseWallet: 'Coinbase Wallet',
  coinbaseWalletSDK: 'Coinbase Wallet',
  walletConnect: 'WalletConnect',
};

function friendlyError(err: unknown): string {
  const message = err instanceof Error ? err.message : String(err);
  if (/ProviderNotFound|No provider/i.test(message)) {
    return 'No browser wallet found. Install a wallet extension, or on mobile open this site inside your wallet app.';
  }
  if (/rejected|denied|cancell?ed/i.test(message)) {
    return 'Request cancelled in wallet.';
  }
  if (/already pending|Resource unavailable/i.test(message)) {
    return 'Your wallet already has a pending request — open the wallet to finish or dismiss it.';
  }
  return message.slice(0, 140);
}

export function ConnectWallet({ className = '' }: { className?: string }) {
  const { address, isConnected, chainId } = useAccount();
  const activeChainId = useChainId();
  const { connectors, connectAsync } = useConnect();
  const { disconnect } = useDisconnect();
  const { switchChain, isPending: switching } = useSwitchChain();

  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [pendingUid, setPendingUid] = useState<string | null>(null);
  const [connectError, setConnectError] = useState<string | null>(null);
  const ref = useRef<HTMLDivElement>(null);

  // Avoid hydration mismatch: wallet state is client-only. The mount flag is
  // set once after the first client render; this is the documented hydration
  // guard pattern, hence the rule suppression.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMounted(true);
  }, []);

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    if (open) document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, [open]);

  // Which connectors to offer. Wallet extensions announce themselves via
  // EIP-6963 and each gets its own connector (talking straight to that
  // extension, immune to window.ethereum tug-of-war between extensions).
  // When any are present, hide wagmi's generic 'injected' entry — it's a
  // duplicate that targets whichever extension won window.ethereum. When none
  // are present (e.g. mobile browsers), only offer 'injected' if a provider
  // actually exists; otherwise tapping it can only ever throw.
  const visibleConnectors = useMemo(() => {
    if (!mounted) return [] as Connector[];
    const discovered = connectors.filter((c) => c.type === 'injected' && c.id !== 'injected');
    return connectors.filter((c) => {
      if (c.id !== 'injected') return true;
      if (discovered.length > 0) return false;
      return Boolean((window as { ethereum?: unknown }).ethereum);
    });
  }, [connectors, mounted]);

  const hasInjectedOption = visibleConnectors.some((c) => c.type === 'injected');

  async function handleConnect(connector: Connector) {
    setConnectError(null);
    setPendingUid(connector.uid);
    try {
      await connectAsync({ connector, chainId: base.id });
      setOpen(false); // close only on success — failures stay visible
    } catch (err) {
      setConnectError(friendlyError(err));
    } finally {
      setPendingUid(null);
    }
  }

  const wrongChain = isConnected && (chainId ?? activeChainId) !== base.id;

  const pill =
    'font-mono text-[11px] tracking-[1.2px] px-2.5 py-1 border rounded transition-colors';

  if (!mounted) {
    return (
      <span className={`${pill} text-[#4F5354] border-[#22262A] ${className}`}>
        WALLET
      </span>
    );
  }

  // Connected + wrong chain → switch prompt.
  if (isConnected && wrongChain) {
    return (
      <div className={`flex items-center gap-2 ${className}`}>
        <button
          onClick={() => switchChain({ chainId: base.id })}
          disabled={switching}
          className={`${pill} text-[#FFB976] border-[#FFB976] hover:bg-[#FFB976]/10 disabled:opacity-60`}
        >
          {switching ? 'SWITCHING…' : '⚠ SWITCH TO BASE'}
        </button>
        <button
          onClick={() => disconnect()}
          className={`${pill} text-[#8A8E8C] border-[#22262A] hover:text-[#F1F1EE] hover:border-[#4F5354]`}
        >
          ✕
        </button>
      </div>
    );
  }

  // Connected on Base → address + disconnect.
  if (isConnected && address) {
    return (
      <div className={`relative ${className}`} ref={ref}>
        <button
          onClick={() => setOpen((v) => !v)}
          className={`${pill} text-[#9DFFB5] border-[#9DFFB5] hover:bg-[#9DFFB5]/10 flex items-center gap-1.5`}
        >
          <span className="w-1.5 h-1.5 rounded-full bg-[#9DFFB5] shadow-[0_0_8px_#9DFFB5]" />
          {truncate(address)}
        </button>
        {open && (
          <div className="absolute right-0 mt-2 z-50 min-w-[180px] border border-[#22262A] bg-[#111315] rounded-md p-1 shadow-xl">
            <div className="px-3 py-2 text-[10px] font-mono text-[#4F5354] tracking-[1.2px] border-b border-[#22262A]">
              BASE · eip155:8453
            </div>
            <button
              onClick={() => {
                disconnect();
                setOpen(false);
              }}
              className="w-full text-left px-3 py-2 text-xs font-mono text-[#FF7361] hover:bg-[#FF7361]/10 rounded"
            >
              Disconnect
            </button>
          </div>
        )}
      </div>
    );
  }

  // Disconnected → connect dropdown.
  return (
    <div className={`relative ${className}`} ref={ref}>
      <button
        onClick={() => {
          setConnectError(null);
          setOpen((v) => !v);
        }}
        className={`${pill} text-[#9DFFB5] border-[#9DFFB5] hover:bg-[#9DFFB5]/10`}
      >
        CONNECT WALLET
      </button>
      {open && (
        <div className="absolute right-0 mt-2 z-50 min-w-[220px] max-w-[280px] border border-[#22262A] bg-[#111315] rounded-md p-1 shadow-xl">
          <div className="px-3 py-2 text-[10px] font-mono text-[#4F5354] tracking-[1.2px] border-b border-[#22262A]">
            CONNECT ON BASE
          </div>
          {visibleConnectors.map((c) => (
            <button
              key={c.uid}
              onClick={() => handleConnect(c)}
              disabled={pendingUid !== null}
              className="w-full text-left px-3 py-2 text-xs font-mono text-[#F1F1EE] hover:bg-[#9DFFB5]/10 rounded disabled:opacity-60"
            >
              {pendingUid === c.uid ? 'CONNECTING…' : (connectorLabels[c.id] ?? c.name)}
            </button>
          ))}
          {!hasInjectedOption && !hasWalletConnect && (
            <p className="px-3 py-2 text-[10px] font-mono text-[#8A8E8C] leading-relaxed border-t border-[#22262A]">
              No wallet extension detected. On mobile, pick Coinbase Wallet above
              or open this site in your wallet app&apos;s built-in browser.
            </p>
          )}
          {connectError && (
            <p className="px-3 py-2 text-[10px] font-mono text-[#FF7361] leading-relaxed break-words border-t border-[#22262A]">
              {connectError}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
