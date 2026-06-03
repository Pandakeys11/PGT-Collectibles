"use client";

import { VersionedTransaction } from "@solana/web3.js";

export type PhantomProvider = {
  isPhantom?: boolean;
  isConnected?: boolean;
  publicKey?: { toString: () => string } | null;
  connect: (opts?: { onlyIfTrusted?: boolean }) => Promise<{
    publicKey: { toString: () => string };
  }>;
  disconnect: () => Promise<void>;
  signTransaction: (tx: VersionedTransaction) => Promise<VersionedTransaction>;
  on?: (event: string, handler: (...args: unknown[]) => void) => void;
};

declare global {
  interface Window {
    solana?: PhantomProvider;
    phantom?: { solana?: PhantomProvider };
  }
}

const PHANTOM_INSTALL_URL = "https://phantom.app/";

function readPublicKey(provider: PhantomProvider): string | null {
  const pk = provider.publicKey;
  if (!pk) return null;
  try {
    const s = pk.toString();
    return s?.trim() || null;
  } catch {
    return null;
  }
}

/** Prefer window.phantom.solana (current) then legacy window.solana. */
export function getPhantomProvider(): PhantomProvider | null {
  if (typeof window === "undefined") return null;
  const phantom = window.phantom?.solana;
  if (phantom?.isPhantom) return phantom;
  const solana = window.solana;
  if (solana?.isPhantom) return solana;
  return null;
}

export function isPhantomInstalled(): boolean {
  return Boolean(getPhantomProvider());
}

/** Extension injects async — brief poll after page load. */
export async function waitForPhantomProvider(timeoutMs = 4000): Promise<PhantomProvider | null> {
  const existing = getPhantomProvider();
  if (existing) return existing;

  const started = Date.now();
  return new Promise((resolve) => {
    const tick = () => {
      const p = getPhantomProvider();
      if (p) {
        resolve(p);
        return;
      }
      if (Date.now() - started >= timeoutMs) {
        resolve(null);
        return;
      }
      window.setTimeout(tick, 120);
    };
    tick();
  });
}

function phantomUserMessage(err: unknown): string {
  const code = (err as { code?: number })?.code;
  const msg = err instanceof Error ? err.message : String(err ?? "Connection failed");
  if (code === 4001 || /user rejected|rejected/i.test(msg)) {
    return "Connection cancelled — approve the request in Phantom to link your wallet.";
  }
  if (/blocked|popup/i.test(msg)) {
    return "Phantom popup was blocked. Allow popups for this site and try again.";
  }
  return msg;
}

export type ConnectPhantomOptions = {
  onlyIfTrusted?: boolean;
  forceReconnect?: boolean;
};

export async function connectPhantomWallet(options?: ConnectPhantomOptions): Promise<string> {
  const provider = await waitForPhantomProvider();
  if (!provider) {
    throw new Error(
      `Phantom wallet not detected. Install the extension from ${PHANTOM_INSTALL_URL}, then refresh this page.`,
    );
  }

  if (!options?.forceReconnect) {
    const existing = readPublicKey(provider);
    if (existing) return existing;
  } else {
    try {
      await provider.disconnect();
    } catch {
      /* ignore */
    }
  }

  try {
    const res = await provider.connect({
      onlyIfTrusted: options?.onlyIfTrusted ?? false,
    });
    const address =
      res?.publicKey?.toString?.() ?? readPublicKey(provider);
    if (!address) {
      throw new Error("Phantom connected but did not return a wallet address.");
    }
    return address;
  } catch (err) {
    throw new Error(phantomUserMessage(err));
  }
}

/** Reconnect silently when Phantom already trusts this site. */
export async function tryEagerPhantomConnect(): Promise<string | null> {
  const provider = await waitForPhantomProvider(1500);
  if (!provider) return null;
  const existing = readPublicKey(provider);
  if (existing) return existing;
  try {
    const res = await provider.connect({ onlyIfTrusted: true });
    return res?.publicKey?.toString?.() ?? readPublicKey(provider);
  } catch {
    return null;
  }
}

export async function disconnectPhantomWallet(): Promise<void> {
  const provider = getPhantomProvider();
  if (!provider) return;
  try {
    await provider.disconnect();
  } catch {
    /* ignore */
  }
}

export async function signSlabzBase64Transaction(unsignedBase64: string): Promise<string> {
  const provider = getPhantomProvider();
  if (!provider) {
    throw new Error("Connect Phantom first, then try again.");
  }

  const connected = readPublicKey(provider);
  if (!connected) {
    throw new Error("Phantom is not connected. Tap Connect Phantom again.");
  }

  const bytes = Uint8Array.from(atob(unsignedBase64), (c) => c.charCodeAt(0));
  const tx = VersionedTransaction.deserialize(bytes);
  const signed = await provider.signTransaction(tx);
  const serialized = signed.serialize();
  let binary = "";
  for (let i = 0; i < serialized.length; i++) {
    binary += String.fromCharCode(serialized[i]!);
  }
  return btoa(binary);
}

const WALLET_STORAGE_PREFIX = "pgt.slabz.wallet";

export function slabzWalletStorageKey(clerkUserId: string | null | undefined): string {
  if (clerkUserId?.trim()) return `${WALLET_STORAGE_PREFIX}.${clerkUserId.trim()}`;
  return `${WALLET_STORAGE_PREFIX}.guest`;
}

export function readLocalSlabzWallet(clerkUserId?: string | null): string | null {
  try {
    const key = slabzWalletStorageKey(clerkUserId);
    return localStorage.getItem(key)?.trim() || null;
  } catch {
    return null;
  }
}

export function writeLocalSlabzWallet(address: string | null, clerkUserId?: string | null): void {
  try {
    const key = slabzWalletStorageKey(clerkUserId);
    if (!address) localStorage.removeItem(key);
    else localStorage.setItem(key, address);
  } catch {
    /* ignore */
  }
}

export function subscribePhantomAccountChange(
  onAddress: (address: string | null) => void,
): () => void {
  const provider = getPhantomProvider();
  if (!provider?.on) return () => {};

  const handler = (pubkey: unknown) => {
    const pk = pubkey as { toString?: () => string } | null;
    onAddress(pk?.toString?.() ?? null);
  };

  provider.on("accountChanged", handler);
  return () => {
    try {
      provider.on?.("accountChanged", handler);
    } catch {
      /* ignore */
    }
  };
}
