import {
    PluginBase,
    WalletClientBase,
    createTool,
  } from "@goat-sdk/core";
  import { z } from "zod";
  import crypto from "crypto";
  
  export class okxgettrade extends PluginBase<WalletClientBase> {
    private apiKey: string;
    private secretKey: string;
    private passphrase: string;
  
    constructor() {
      super("market_price", []);
      this.apiKey = process.env.OKX_API_KEY!;
      this.secretKey = process.env.OKX_API_SECRET!;
      this.passphrase = process.env.OKX_API_PASSPHRASE!.trim();
    }
  
    supportsChain = (_chain: any) => true;
  
    getTools(_walletClient: WalletClientBase) {
      return [
        createTool(
          {
            name: "okx_get_trades",
            description: "Retrieve the recent transactions of a token.",
            parameters: z.object({}),
          },
          async () => {
            const method = "POST";
            const requestPath = "/api/v5/dex/market/price-info";
            const requestBody = [
              {
                chainIndex: "501", // Solana
                tokenContractAddress: "So11111111111111111111111111111111111111112", 
              },
            ];
            const bodyString = JSON.stringify(requestBody);
            const timestamp = new Date().toISOString();
  
            // Sign the request
            const prehash = timestamp + method + requestPath + bodyString;
            const sign = crypto
              .createHmac("sha256", this.secretKey)
              .update(prehash)
              .digest("base64");
  
            const headers = {
              "Content-Type": "application/json",
              "OK-ACCESS-KEY": this.apiKey,
              "OK-ACCESS-SIGN": sign,
              "OK-ACCESS-TIMESTAMP": timestamp,
              "OK-ACCESS-PASSPHRASE": this.passphrase,
            };
  
            const response = await fetch(`https://web3.okx.com${requestPath}`, {
              method,
              headers,
              body: bodyString,
            });
  
            const json = await response.json();
  
            if (json.code !== "0" || !json.data?.[0]) {
              throw new Error(`Failed to fetch price: ${json.msg || "Unknown error"}`);
            }
  
            const priceData = json.data[0];
            const output = [
              `🪙 Token Price Info (Solana)`,
              `----------------------------------------`,
              `🔗 Token Address: ${priceData.tokenContractAddress}`,
              `🌐 Chain Index: ${priceData.chainIndex}`,
              `💵 Current Price: $${Number(priceData.price).toFixed(4)}`,
              `📈 24H Change: ${priceData.priceChange24H}%`,
              `🕒 Last Updated: ${new Date(Number(priceData.time)).toLocaleString()}`,
            ].join("\n");
  
            return {
              type: "text",
              content: output,
            };
          }
        ),
      ];
    }
  }
  
  export const OKXGetTrade = () => new okxgettrade();
  