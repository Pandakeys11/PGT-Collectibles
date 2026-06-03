import "server-only";

import { Connection, PublicKey } from "@solana/web3.js";
import { getSlabzNetwork } from "@/lib/slabz/config";

/** Circle USDC on Solana devnet (USDC-DEV faucet). Override with SLABZ_USDC_MINT if Slabz uses another mint. */
const DEVNET_USDC_MINT = "4zMMC9srt5Ri5X14GAgXhaHiiQ6mwhi5u9dYAP3kkeX";
const MAINNET_USDC_MINT = "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v";

export type SlabzWalletBalance = {
  walletAddress: string;
  network: "devnet" | "mainnet";
  sol: number;
  usdc: number;
  usdcSymbol: string;
  rpcUrl: string;
};

function rpcUrlForNetwork(network: "devnet" | "mainnet"): string {
  if (network === "mainnet") {
    return (
      process.env.SOLANA_MAINNET_RPC_URL?.trim() ||
      process.env.NEXT_PUBLIC_SOLANA_MAINNET_RPC_URL?.trim() ||
      "https://api.mainnet-beta.solana.com"
    );
  }
  return (
    process.env.SOLANA_DEVNET_RPC_URL?.trim() ||
    process.env.NEXT_PUBLIC_SOLANA_DEVNET_RPC_URL?.trim() ||
    "https://api.devnet.solana.com"
  );
}

function usdcMintForNetwork(network: "devnet" | "mainnet"): string {
  const override = process.env.SLABZ_USDC_MINT?.trim();
  if (override) return override;
  return network === "mainnet" ? MAINNET_USDC_MINT : DEVNET_USDC_MINT;
}

export async function fetchSlabzWalletBalance(
  walletAddress: string,
  network?: "devnet" | "mainnet",
): Promise<SlabzWalletBalance> {
  const net = network ?? getSlabzNetwork();
  const rpcUrl = rpcUrlForNetwork(net);
  const connection = new Connection(rpcUrl, "confirmed");
  const owner = new PublicKey(walletAddress.trim());
  const mint = new PublicKey(usdcMintForNetwork(net));

  const [lamports, tokenAccounts] = await Promise.all([
    connection.getBalance(owner, "confirmed"),
    connection.getParsedTokenAccountsByOwner(owner, { mint }, "confirmed"),
  ]);

  let usdc = 0;
  for (const { account } of tokenAccounts.value) {
    const parsed = account.data;
    if (parsed && "parsed" in parsed) {
      const amount = parsed.parsed?.info?.tokenAmount?.uiAmount;
      if (typeof amount === "number" && Number.isFinite(amount)) usdc += amount;
    }
  }

  return {
    walletAddress: walletAddress.trim(),
    network: net,
    sol: lamports / 1_000_000_000,
    usdc,
    usdcSymbol: net === "devnet" ? "USDC-DEV" : "USDC",
    rpcUrl,
  };
}
