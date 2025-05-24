import {
    PluginBase,
    WalletClientBase,
    createTool,
  } from "@goat-sdk/core";
  import { z } from "zod";
  import crypto from "crypto";
  
  export class IndexTokenPricePlugin extends PluginBase<WalletClientBase> {
    private apiKey: string;
    private secretKey: string;
    private passphrase: string;
  
    constructor() {
      super("okx_index_token_price", []);
      this.apiKey = process.env.OKX_API_KEY!;
      this.secretKey = process.env.OKX_API_SECRET!;
      this.passphrase = process.env.OKX_API_PASSPHRASE?.trim()!;
    }
  
    supportsChain = (_chain: any) => true;
  
    getTools(walletClient: WalletClientBase) {
      return [
        createTool(
          {
            name: "okx_index_token_price",
            description: "Get batch index token prices from OKX",
            parameters: z.object({
              tokens: z.array(
                z.object({
                  chainIndex: z.string(),
                  tokenContractAddress: z.string(),
                })
              ),
            }),
          },
          async ({ tokens }) => {
            if (!tokens.length) {
              throw new Error("Tokens array cannot be empty");
            }
  
            const requestPath = "/api/v5/dex/index/current-price";
            const method = "POST";
            const timestamp = new Date().toISOString();
  
            const body = JSON.stringify(tokens);
  
            // Create the prehash string as per OKX signing rules:
            // prehash = timestamp + method + requestPath + body
            const prehash = `${timestamp}${method}${requestPath}${body}`;
            const sign = crypto
              .createHmac("sha256", this.secretKey)
              .update(prehash)
              .digest("base64");
  
            const res = await fetch(`https://web3.okx.com${requestPath}`, {
              method,
              headers: {
                "Content-Type": "application/json",
                "OK-ACCESS-KEY": this.apiKey,
                "OK-ACCESS-SIGN": sign,
                "OK-ACCESS-TIMESTAMP": timestamp,
                "OK-ACCESS-PASSPHRASE": this.passphrase,
              },
              body,
            });
  
            const json = await res.json();
  
            if (json.code !== "0" && json.code !== 0) {
              throw new Error(`Failed to fetch index price: ${json.msg || "Unknown error"}`);
            }
  
            // Format response
            const results = json.data.map((entry: any) => {
              return [
                `Chain Index: ${entry.chainIndex}`,
                `Token Address: ${entry.tokenContractAddress || "(native token)"}`,
                `Price: $${Number(entry.price).toFixed(6)}`,
                `Timestamp: ${new Date(Number(entry.time)).toLocaleString()}`,
                `-----------------------`,
              ].join("\n");
            });
  
            return {
              type: "text",
              content: results.join("\n"),
            };
          }
        ),
      ];
    }
  }
  
  export const IndexTokenPrice = () => new IndexTokenPricePlugin();
  