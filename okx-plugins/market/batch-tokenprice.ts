import {Chain, PluginBase, SolanaChain, ToolBase, WalletClientBase, createTool} from "@goat-sdk/core"
import {z} from "zod"
import crypto from "crypto";

export class batchtokenprice extends PluginBase<WalletClientBase> {
    private apiKey: string;
    private secretKey: string;
    private passphrase: string;

    constructor() {
        super("market_price", []);
        this.apiKey = process.env.OKX_API_KEY !;
        this.secretKey = process.env.OKX_API_SECRET!;
        this.passphrase = process.env.OKX_API_PASSPHRASE?.trim() !;
    }

 
    supportsChain = (_chain: any) => true;

    getTools(walletClient: WalletClientBase) {
        return [
            createTool(
                {
                    name: "okx_batchtoken_price",
                    description: "  Retrieve the latest price for multiple tokens",
                    parameters: z.object({}),
                },

                async({  }) => {
                    const requestBody = [
                        {
                            chainIndex: "501", 
                            tokenContractAddress: "So11111111111111111111111111111111111111112", 
                        },
                    ];

                    const timestamp = new Date().toISOString();
                    const requestPath = "/api/v5/dex/market/price-info";
                    


          const method = "POST";
          const prehash = `${timestamp}${method}${requestPath}${JSON.stringify(requestBody)}`;
          const sign = crypto
            .createHmac("sha256", this.secretKey)
            .update(prehash)
            .digest("base64");



  console.log("OKX API Request:");
  console.log("URL:", `https://web3.okx.com${requestPath}`);
  console.log("Method:", method);
  console.log("Headers:", {
    "Content-Type": "application/json",
    "OK-ACCESS-KEY": this.apiKey,
    "OK-ACCESS-SIGN": sign,
    "OK-ACCESS-TIMESTAMP": timestamp,
    "OK-ACCESS-PASSPHRASE": this.passphrase,
  });
  console.log("Body:", JSON.stringify(requestBody));

            const res = await fetch(`https://web3.okx.com${requestPath}`, {
                method,
                headers: {
                  "Content-Type": "application/json",
                  "OK-ACCESS-KEY": this.apiKey,
                  "OK-ACCESS-SIGN": sign,
                  "OK-ACCESS-TIMESTAMP": timestamp,
                  "OK-ACCESS-PASSPHRASE": this.passphrase,
                },
                body: JSON.stringify(requestBody),
              });

              const json = await res.json();

              if (json.code !== "0" || !json.data?.[0]) {
                throw new Error(`Failed to fetch price: ${json.msg || "Unknown error"}`);
              }


              const priceData = json.data[0];
              const response = [
                `🪙 SOL Token Price (Solana)`,
                `----------------------------------------`,
                `🔗 Token Address: ${priceData.tokenContractAddress}`,
                `🌐 Chain Index: ${priceData.chainIndex}`,
                `💵 Current Price: $${Number(priceData.price).toFixed(4)}`,
                `🕒 Last Updated: ${new Date(Number(priceData.time)).toLocaleString()}`,
              ].join("\n");

          return {
            type: "text",
            content: response,
          };

                }
            )
        ]
    }
}

export const BatchTokenPrice = () => new batchtokenprice()