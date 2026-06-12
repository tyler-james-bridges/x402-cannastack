'use client';

// ConnectWallet — header control for connecting / disconnecting a browser
// wallet, showing the truncated address + connected chain, and prompting a
// switch to Base when on the wrong network. All signing/connection happens in
// the wallet's own UI; this component holds no secrets.

import { useEffect, useRef, useState } from 'react';
import { getAddress } from 'viem';
import { base } from 'viem/chains';
import {
  useAccount,
  useChainId,
  useConnect,
  useDisconnect,
  useSwitchChain,
} from 'wagmi';

function truncate(addr: string) {
  const a = getAddress(addr);
  return `${a.slice(0, 6)}…${a.slice(-4)}`;
}

const connectorLabels: Record<string, string> = {
  injected: 'MetaMask / Browser',
  metaMask: 'MetaMask',
  metaMaskSDK: 'MetaMask',
  coinbaseWallet: 'Coinbase Wallet',
  coinbaseWalletSDK: 'Coinbase Wallet',
  walletConnect: 'WalletConnect',
};

export function ConnectWallet({ className = '' }: { className?: string }) {
  const { address, isConnected, chainId } = useAccount();
  const activeChainId = useChainId();
  const { connectors, connect, isPending, error } = useConnect();
  const { disconnect } = useDisconnect();
  const { switchChain, isPending: switching } = useSwitchChain();

  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
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
        onClick={() => setOpen((v) => !v)}
        disabled={isPending}
        className={`${pill} text-[#9DFFB5] border-[#9DFFB5] hover:bg-[#9DFFB5]/10 disabled:opacity-60`}
      >
        {isPending ? 'CONNECTING…' : 'CONNECT WALLET'}
      </button>
      {open && (
        <div className="absolute right-0 mt-2 z-50 min-w-[200px] border border-[#22262A] bg-[#111315] rounded-md p-1 shadow-xl">
          <div className="px-3 py-2 text-[10px] font-mono text-[#4F5354] tracking-[1.2px] border-b border-[#22262A]">
            CONNECT ON BASE
          </div>
          {connectors.map((c) => (
            <button
              key={c.uid}
              onClick={() => {
                connect({ connector: c, chainId: base.id });
                setOpen(false);
              }}
              className="w-full text-left px-3 py-2 text-xs font-mono text-[#F1F1EE] hover:bg-[#9DFFB5]/10 rounded"
            >
              {connectorLabels[c.id] ?? c.name}
            </button>
          ))}
          {error && (
            <p className="px-3 py-2 text-[10px] font-mono text-[#FF7361] break-words">
              {error.message.slice(0, 120)}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
