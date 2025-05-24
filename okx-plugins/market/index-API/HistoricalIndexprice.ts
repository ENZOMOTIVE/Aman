import {
    PluginBase,
    WalletClientBase,
    createTool,
  } from "@goat-sdk/core";
  import { z } from "zod";
  import crypto from "crypto";
  
  export class HistoricalIndexPricePlugin extends PluginBase<WalletClientBase> {
    private apiKey: string;
    private secretKey: string;
    private passphrase: string;
  
    constructor() {
      super("okx_historical_index_price", []);
      this.apiKey = process.env.OKX_API_KEY!;
      this.secretKey = process.env.OKX_API_SECRET!;
      this.passphrase = process.env.OKX_API_PASSPHRASE!;
    }
  
    supportsChain = (_chain: any) => true;
  
    getTools(walletClient: WalletClientBase) {
      return [
        createTool(
          {
            name: "okx_historical_index_price",
            description: "Get historical index prices for a token from OKX",
            parameters: z.object({
              chainIndex: z.string(),
              tokenContractAddress: z.string().optional().default(""),
              limit: z.string().optional(),
              cursor: z.string().optional(),
              begin: z.string().optional(),
              end: z.string().optional(),
              period: z
                .enum(["1m", "5m", "30m", "1h", "1d"])
                .optional()
                .default("1d"),
            }),
          },
          async ({ chainIndex, tokenContractAddress, limit, cursor, begin, end, period }) => {
            const requestPath = "/api/v5/dex/index/historical-price";
            const method = "GET";
  
            // Build query parameters
            const params = new URLSearchParams();
            params.append("chainIndex", chainIndex);
            if (tokenContractAddress !== undefined) params.append("tokenContractAddress", tokenContractAddress);
            if (limit) params.append("limit", limit);
            if (cursor) params.append("cursor", cursor);
            if (begin) params.append("begin", begin);
            if (end) params.append("end", end);
            if (period) params.append("period", period);
  
            const queryString = params.toString();
            const fullPath = requestPath + "?" + queryString;
  
            const timestamp = new Date().toISOString();
  
            // OKX API sign = HMAC_SHA256(timestamp + method + requestPath + query + body)
            // For GET, body is empty string
            const prehash = timestamp + method + requestPath + "?" + queryString;
            const sign = crypto
              .createHmac("sha256", this.secretKey)
              .update(prehash)
              .digest("base64");
  
            const res = await fetch(`https://web3.okx.com${fullPath}`, {
              method,
              headers: {
                "OK-ACCESS-KEY": this.apiKey,
                "OK-ACCESS-SIGN": sign,
                "OK-ACCESS-TIMESTAMP": timestamp,
                "OK-ACCESS-PASSPHRASE": this.passphrase,
                "Content-Type": "application/json",
              },
            });
  
            const json = await res.json();
  
            if (json.code !== "0" && json.code !== 0) {
              throw new Error(`Failed to fetch historical index prices: ${json.msg || "Unknown error"}`);
            }
  
            // Format prices nicely
            const prices = json.data[0]?.prices || [];
  
            const resultStrings = prices.map(
              (p: { time: string; price: string }) =>
                `Time: ${new Date(Number(p.time)).toLocaleString()}, Price: ${Number(p.price).toFixed(6)}`
            );
  
            return {
              type: "text",
              content: resultStrings.join("\n") || "No historical prices found",
            };
          }
        ),
      ];
    }
  }
  
  export const HistoricalIndexPrice = () => new HistoricalIndexPricePlugin();
  