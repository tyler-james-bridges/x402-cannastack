'use client';

// useX402Fetch — returns a `fetch`-compatible function that automatically
// handles HTTP 402 Payment Required responses from the cannastack API by
// signing an EIP-3009 (transferWithAuthorization) payment with the connected
// browser wallet and retrying the request.
//
// Security: there are NO private keys here. All signing happens inside the
// user's wallet UI (MetaMask / Coinbase / WalletConnect) via signTypedData.
// We only ever hold the wallet's public address + a signTypedData call.

import { useCallback, useMemo } from 'react';
import { getAddress, publicActions } from 'viem';
import { base } from 'viem/chains';
import { useAccount, useConfig } from 'wagmi';
import { getWalletClient } from 'wagmi/actions';
import { wrapFetchWithPaymentFromConfig } from '@x402/fetch';
import { ExactEvmScheme } from '@x402/evm';

// Base mainnet USDC. Max we will auto-approve per request, in base units
// (USDC has 6 decimals). Each endpoint is $0.02; cap at $1.00 as a safety net
// so a misconfigured server can never drain more than this per call.
const MAX_PAYMENT_BASE_UNITS = BigInt(1_000_000); // 1.00 USDC

export interface X402FetchState {
  /** A fetch wrapper that pays via the connected wallet, or null if no wallet. */
  payFetch: ((input: RequestInfo | URL, init?: RequestInit) => Promise<Response>) | null;
  /** True when a wallet is connected on the correct (Base) chain. */
  ready: boolean;
  /** True when a wallet is connected but on the wrong chain. */
  wrongChain: boolean;
  isConnected: boolean;
}

export function useX402Fetch(): X402FetchState {
  const config = useConfig();
  const { isConnected, chainId } = useAccount();

  const wrongChain = isConnected && chainId !== base.id;
  const ready = isConnected && !wrongChain;

  const payFetch = useMemo(() => {
    if (!ready) return null;

    return async (input: RequestInfo | URL, init?: RequestInit) => {
      // Resolve the wallet client lazily, at call time, so we always use the
      // currently-connected account/chain.
      const walletClient = await getWalletClient(config, { chainId: base.id });
      if (!walletClient) {
        throw new Error('Wallet not available. Reconnect and try again.');
      }

      // Extend with publicActions so the x402 scheme can read on-chain state
      // (nonce / allowance checks) through the same client. The wallet still
      // performs all signing in its own UI.
      const signerClient = walletClient.extend(publicActions);
      const address = getAddress(walletClient.account.address);

      // Structural signer the x402 ExactEvmScheme expects.
      const signer = {
        address,
        signTypedData: (message: {
          domain: Record<string, unknown>;
          types: Record<string, unknown>;
          primaryType: string;
          message: Record<string, unknown>;
        }) =>
          // viem's signTypedData has stricter generics than the x402 structural
          // type; the runtime shape is identical (EIP-712 typed data).
          signerClient.signTypedData(
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            { account: walletClient.account, ...(message as any) },
          ),
        readContract: (args: {
          address: `0x${string}`;
          abi: readonly unknown[];
          functionName: string;
          args?: readonly unknown[];
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
        }) => signerClient.readContract(args as any),
      };

      const fetchWithPayment = wrapFetchWithPaymentFromConfig(globalThis.fetch, {
        schemes: [
          {
            network: 'eip155:8453', // Base mainnet
            client: new ExactEvmScheme(signer),
          },
        ],
        // Safety cap: reject any payment requirement above MAX_PAYMENT so a
        // misconfigured/hostile server can never pull more than $1 per call.
        policies: [
          (_version, requirements) =>
            requirements.filter((r) => {
              try {
                return BigInt(r.amount) <= MAX_PAYMENT_BASE_UNITS;
              } catch {
                return false;
              }
            }),
        ],
      });

      return fetchWithPayment(input, init);
    };
  }, [config, ready]);

  return useCallback(
    () => ({ payFetch, ready, wrongChain, isConnected }),
    [payFetch, ready, wrongChain, isConnected],
  )();
}
