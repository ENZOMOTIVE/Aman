import {
    PluginBase,
    WalletClientBase,
    createTool,
  } from "@goat-sdk/core";
  import crypto from "crypto";
  import { z } from "zod"
  
  export class OkxSupportedChainsPlugin extends PluginBase<WalletClientBase> {
    private apiKey: string;
    private secretKey: string;
    private passphrase: string;
  
    constructor() {
      super("okx_supported_chains", []);
      this.apiKey = process.env.OKX_API_KEY!;
      this.secretKey = process.env.OKX_API_SECRET!;
      this.passphrase = process.env.OKX_API_PASSPHRASE!.trim();
    }
  
    supportsChain = (_chain: any) => true;
  
    getTools(_walletClient: WalletClientBase) {
      return [
        createTool(
          {
            name: "okx_supported_chains",
            description: "Retrieve all chains supported for balance",
            parameters: z.object({}), // no params required
          },
          async () => {
            const method = "GET";
            const requestPath = "/api/v5/dex/balance/supported/chain";
            const timestamp = new Date().toISOString();
  
            // For GET requests, body is empty string
            const prehash = timestamp + method + requestPath;
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
  
            const res = await fetch(`https://web3.okx.com${requestPath}`, {
              method,
              headers,
            });
  
            const json = await res.json();
  
            if (json.code !== "0") {
              throw new Error(`Failed to fetch supported chains: ${json.msg || "Unknown error"}`);
            }
  
            // json.data is array of supported chains
            const chains = json.data as Array<{
              name: string;
              logoUrl: string;
              shortName: string;
              chainIndex: string;
            }>;
  
            const formatted = chains.map(
              (chain) =>
                `🔗 ${chain.name} (${chain.shortName})
  Chain Index: ${chain.chainIndex}
  Logo: ${chain.logoUrl}`
            );
  
            return {
              type: "text",
              content: formatted.join("\n\n"),
            };
          }
        ),
      ];
    }
  }
  
  export const OkxSupportedChains = () => new OkxSupportedChainsPlugin();
  