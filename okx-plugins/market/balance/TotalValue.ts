import { PluginBase, WalletClientBase, createTool } from "@goat-sdk/core";
import { z } from "zod";
import crypto from "crypto";

export class OkxTotalValuePlugin extends PluginBase<WalletClientBase> {
  private apiKey: string;
  private secretKey: string;
  private passphrase: string;

  constructor() {
    super("okx_total_value", []);
    this.apiKey = process.env.OKX_API_KEY!;
    this.secretKey = process.env.OKX_API_SECRET!;
    this.passphrase = process.env.OKX_API_PASSPHRASE!;
  }

  supportsChain = (_chain: any) => true;

  getTools(walletClient: WalletClientBase) {
    return [
      createTool(
        {
          name: "okx_total_value",
          description: "Retrieve the total USD value of tokens and DeFi assets for an address",
          parameters: z.object({
            address: z.string(),
            chains: z.string().optional(),
            assetType: z.enum(["0", "1", "2"]).optional(),
            excludeRiskToken: z.boolean().optional(),
          }),
        },
        async ({ address, chains, assetType, excludeRiskToken }) => {
          const requestPath = "/api/v5/dex/balance/total-value";
          const method = "GET";

          // Build query string
          const params = new URLSearchParams();
          params.append("address", address);
          if (chains) params.append("chains", chains);
          if (assetType) params.append("assetType", assetType);
          if (excludeRiskToken !== undefined) params.append("excludeRiskToken", excludeRiskToken.toString());

          const queryString = params.toString();
          const fullPath = requestPath + "?" + queryString;

          const timestamp = new Date().toISOString();
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
            throw new Error(`Failed to get total value: ${json.msg || "Unknown error"}`);
          }

          const totalValue = json.data?.[0]?.totalValue ?? "0";

          return {
            type: "text",
            content: `Total asset value for address ${address} is $${totalValue}`,
          };
        }
      ),
    ];
  }
}

export const OkxTotalValue = () => new OkxTotalValuePlugin();
