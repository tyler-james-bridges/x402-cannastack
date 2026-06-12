// Wagmi configuration for the cannastack browser wallet + x402 payment flow.
//
// Base mainnet only (eip155:8453) — that is where the paid endpoints settle.
// No private keys, no secrets here. The WalletConnect projectId is read from a
// public env var and is optional (the injected / Coinbase connectors work
// without it). Get a projectId at https://cloud.reown.com to enable the
// WalletConnect (mobile / QR) connector.

import { http, createConfig, createStorage } from 'wagmi';
import { base } from 'wagmi/chains';
import { coinbaseWallet, injected, walletConnect } from 'wagmi/connectors';

const walletConnectProjectId =
  process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID?.trim() || undefined;

export const baseChain = base;

// Only register WalletConnect when a projectId is configured, otherwise the
// connector throws at runtime.
const connectors = [
  injected({ shimDisconnect: true }),
  coinbaseWallet({ appName: 'cannastack', preference: 'all' }),
  ...(walletConnectProjectId
    ? [
        walletConnect({
          projectId: walletConnectProjectId,
          showQrModal: true,
          metadata: {
            name: 'cannastack',
            description: 'Agent-native cannabis data, $0.02 per call via x402.',
            url: 'https://cannastack.0x402.sh',
            icons: ['https://cannastack.0x402.sh/icon.svg'],
          },
        }),
      ]
    : []),
];

export const wagmiConfig = createConfig({
  chains: [base],
  connectors,
  // Persist the last connection so a refresh keeps the wallet connected.
  storage: createStorage({
    storage: typeof window !== 'undefined' ? window.localStorage : undefined,
    key: 'cannastack.wagmi',
  }),
  ssr: true,
  transports: {
    // Default public Base RPC. No API key — do NOT put a keyed RPC URL here;
    // it would be exposed to the browser.
    [base.id]: http(),
  },
});

export const hasWalletConnect = Boolean(walletConnectProjectId);

declare module 'wagmi' {
  interface Register {
    config: typeof wagmiConfig;
  }
}
