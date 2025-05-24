import {
    PluginBase,
    WalletClientBase,
    createTool,
  } from "@goat-sdk/core";
  import { z } from "zod";
  import crypto from "crypto";
  
  export class OkxHistoricalCandlesPlugin extends PluginBase<WalletClientBase> {
    private apiKey: string;
    private secretKey: string;
    private passphrase: string;
  
    constructor() {
      super("okx_historical_candles", []);
      this.apiKey = process.env.OKX_API_KEY!;
      this.secretKey = process.env.OKX_API_SECRET!;
      this.passphrase = process.env.OKX_API_PASSPHRASE!.trim();
    }
  
    supportsChain = (_chain: any) => true;
  
    getTools(_walletClient: WalletClientBase) {
      return [
        createTool(
          {
            name: "okx_historical_candles",
            description: "Retrieve historical candlestick charts",
            parameters: z.object({
              chainIndex: z.string(),
              tokenContractAddress: z.string(),
              after: z.string().optional(),
              before: z.string().optional(),
              bar: z.string().optional(),
              limit: z.string().optional(),
            }),
          },
          async ({ chainIndex, tokenContractAddress, after, before, bar, limit }) => {
            const method = "GET";
            const basePath = "/api/v5/dex/market/historical-candles";
  
            // Build query params string
            const params = new URLSearchParams({
              chainIndex,
              tokenContractAddress,
            });
            if (after) params.append("after", after);
            if (before) params.append("before", before);
            if (bar) params.append("bar", bar);
            if (limit) params.append("limit", limit);
  
            const requestPath = basePath + "?" + params.toString();
  
            const timestamp = new Date().toISOString();
  
            // For GET requests, the body is empty string
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
  
            const res = await fetch(`https://web3.okx.com${requestPath}`, {
              method,
              headers,
            });
  
            const json = await res.json();
  
            if (json.code !== "0") {
              throw new Error(`Failed to fetch candles: ${json.msg || "Unknown error"}`);
            }
  
            // json.data is array of arrays:
            // [ts,o,h,l,c,vol,volUsd,confirm]
            const candles = json.data as Array<
              [string, string, string, string, string, string, string, string]
            >;
  
            // Format nicely:
            const formatted = candles.map(([ts, o, h, l, c, vol, volUsd, confirm]) => {
              return `📊 Time: ${new Date(Number(ts)).toLocaleString()}
  Open: ${o}
  High: ${h}
  Low: ${l}
  Close: ${c}
  Volume (base): ${vol}
  Volume (USD): ${volUsd}
  Completed: ${confirm === "1" ? "Yes" : "No"}`;
            });
  
            return {
              type: "text",
              content: formatted.join("\n\n"),
            };
          }
        ),
      ];
    }
  }
  
  export const OkxHistoricalCandles = () => new OkxHistoricalCandlesPlugin();
  