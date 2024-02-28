import { defineChain } from "viem";
import { http, createConfig } from "wagmi";

export interface EvmWalletConnect {
  contract: any;
  publicClient: any;
  address: string;
}

export const seiDevnet = defineChain({
  id: 713715,
  name: "Sei EVM Devnet",
  nativeCurrency: {
    decimals: 18,
    name: "Sei",
    symbol: "SEI",
  },
  rpcUrls: {
    default: {
      http: ["https://evm-rpc-arctic-1.sei-apis.com"],
      webSocket: ["wss://evm-ws-arctic-1.sei-apis.com"],
    },
  },
  blockExplorers: {
    default: { name: "Seistream", url: "https://seistream.app/" },
  },
});

export const wagmiConfig = createConfig({
  chains: [seiDevnet],
  transports: {
    [seiDevnet.id]: http(),
  },
});

export const WASM_PRECOMPILE_ABI = [
  {
    inputs: [
      {
        internalType: "string",
        name: "contractAddress",
        type: "string",
      },
      {
        internalType: "bytes",
        name: "msg",
        type: "bytes",
      },
      {
        internalType: "bytes",
        name: "coins",
        type: "bytes",
      },
    ],
    name: "execute",
    outputs: [
      {
        internalType: "bytes",
        name: "response",
        type: "bytes",
      },
    ],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [
      {
        internalType: "string",
        name: "contractAddress",
        type: "string",
      },
      {
        internalType: "bytes",
        name: "req",
        type: "bytes",
      },
    ],
    name: "query",
    outputs: [
      {
        internalType: "bytes",
        name: "response",
        type: "bytes",
      },
    ],
    stateMutability: "view",
    type: "function",
  },
];

export const WASM_PRECOMPILE_ADDRESS =
  "0x0000000000000000000000000000000000001002";
