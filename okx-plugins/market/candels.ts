import {
    PluginBase,
    WalletClientBase,
    createTool,
  } from "@goat-sdk/core";
  import { z } from "zod";
  import crypto from "crypto";
  
  export class OkxCandlesPlugin extends PluginBase<WalletClientBase> {
    private apiKey: string;
    private secretKey: string;
    private passphrase: string;
  
    constructor() {
      super("okx_candles", []);
      this.apiKey = process.env.OKX_API_KEY!;
      this.secretKey = process.env.OKX_API_SECRET!;
      this.passphrase = process.env.OKX_API_PASSPHRASE!.trim();
    }
  
    supportsChain = (_chain: any) => true;
  
    getTools(_walletClient: WalletClientBase) {
      return [
        createTool(
          {
            name: "okx_get_candles",
            description:
              "Retrieve candlestick data for a token on a specific chain",
            parameters: z.object({
              chainIndex: z.string().default("501"), 
              tokenContractAddress: z.string().default(
                "So11111111111111111111111111111111111111112"
              ),
              bar: z.string().optional(), // e.g. "1m", "5m", "1H"
              limit: z.string().optional(), // number of candles to fetch (max 299)
              after: z.string().optional(), // pagination param
              before: z.string().optional(), // pagination param
            }),
          },
          async ({
            chainIndex,
            tokenContractAddress,
            bar,
            limit,
            after,
            before,
          }) => {
            const method = "GET";
  
            // Build query params string
            const queryParams = new URLSearchParams({
              chainIndex,
              tokenContractAddress,
              ...(bar ? { bar } : {}),
              ...(limit ? { limit } : {}),
              ...(after ? { after } : {}),
              ...(before ? { before } : {}),
            });
  
            const requestPath = `/api/v5/dex/market/candles?${queryParams.toString()}`;
  
            const timestamp = new Date().toISOString();
  
            // Prehash string = timestamp + method + requestPath (no body for GET)
            const prehash = timestamp + method + requestPath;
            const sign = crypto
              .createHmac("sha256", this.secretKey)
              .update(prehash)
              .digest("base64");
  
            const headers = {
              "OK-ACCESS-KEY": this.apiKey,
              "OK-ACCESS-SIGN": sign,
              "OK-ACCESS-TIMESTAMP": timestamp,
              "OK-ACCESS-PASSPHRASE": this.passphrase,
            };
  
            const response = await fetch(`https://web3.okx.com${requestPath}`, {
              method,
              headers,
            });
  
            const json = await response.json();
  
            if (json.code !== "0" || !Array.isArray(json.data)) {
              throw new Error(`Failed to fetch candles: ${json.msg || "Unknown error"}`);
            }
  
            // Format a few candles as text summary (e.g., last 5)
            const candles = json.data.slice(0, 5).map((candle: string[]) => {
              const [ts, o, h, l, c, vol, volUsd, confirm] = candle;
              return `🕒 ${new Date(Number(ts)).toLocaleString()}
  Open: ${o}, High: ${h}, Low: ${l}, Close: ${c}
  Volume: ${vol} (base), $${volUsd} (USD)
  Completed: ${confirm === "1" ? "Yes" : "No"}`;
            });
  
            return {
              type: "text",
              content: `📊 Candlestick data for token ${tokenContractAddress} on chain ${chainIndex}:\n\n${candles.join(
                "\n\n"
              )}`,
            };
          }
        ),
      ];
    }
  }
  
  export const OkxCandles = () => new OkxCandlesPlugin();
  