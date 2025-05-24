import { Chain, PluginBase, SolanaChain, ToolBase, WalletClientBase, createTool } from "@goat-sdk/core";
import { z } from "zod";
import crypto from "crypto";

export class OkxDexSwap extends PluginBase<WalletClientBase> {
    private apiKey: string;
    private secretKey: string;
    private passphrase: string;

    constructor() {
        super("okx_dex_swap", []);
        this.apiKey = process.env.OKX_API_KEY!;
        this.secretKey = process.env.OKX_API_SECRET!;
        this.passphrase = process.env.OKX_API_PASSPHRASE?.trim()!;
    }

    supportsChain = (_chain: any) => true;

    private generateSignature(timestamp: string, method: string, requestPath: string, body?: string): string {
        const prehash = `${timestamp}${method}${requestPath}${body || ''}`;
        return crypto
            .createHmac("sha256", this.secretKey)
            .update(prehash)
            .digest("base64");
    }

    getTools(walletClient: WalletClientBase) {
        return [
            createTool(
                {
                    name: "okx_dex_swap_quote",
                    description: "Get a quote and execute data for swapping tokens using OKX DEX aggregator",
                    parameters: z.object({
                        chainIndex: z.string().optional().describe("Chain identifier (e.g., '1' for Ethereum, '501' for Solana)"),
                        amount: z.string().describe("Input amount in smallest units (e.g., '1000000' for 1 USDT)"),
                        fromTokenAddress: z.string().describe("Contract address of token to sell"),
                        toTokenAddress: z.string().describe("Contract address of token to buy"),
                        slippage: z.string().describe("Slippage tolerance (e.g., '0.005' for 0.5%)"),
                        userWalletAddress: z.string().describe("User's wallet address"),
                        swapReceiverAddress: z.string().optional().describe("Recipient address (defaults to userWalletAddress)"),
                        feePercent: z.string().optional().describe("Referral fee percentage (0-3% for most chains, 0-10% for Solana)"),
                        fromTokenReferrerWalletAddress: z.string().optional().describe("Referrer wallet for fromToken commission"),
                        toTokenReferrerWalletAddress: z.string().optional().describe("Referrer wallet for toToken commission"),
                        gasLimit: z.string().optional().describe("Gas limit in wei (EVM only)"),
                        gasLevel: z.string().optional().describe("Gas level: 'slow', 'average', or 'fast'"),
                        autoSlippage: z.boolean().optional().describe("Enable automatic slippage calculation"),
                        maxAutoSlippage: z.string().optional().describe("Maximum auto slippage when autoSlippage is enabled"),
                        priceImpactProtectionPercentage: z.string().optional().describe("Price impact protection (0-1, default 0.9)")
                    }),
                },
                async (params) => {
                    const timestamp = new Date().toISOString();
                    const requestPath = "/api/v5/dex/aggregator/swap";
                    const method = "GET";

                    // Build query parameters
                    const queryParams = new URLSearchParams();
                    
                    // Required parameters
                    queryParams.append("amount", params.amount);
                    queryParams.append("fromTokenAddress", params.fromTokenAddress);
                    queryParams.append("toTokenAddress", params.toTokenAddress);
                    queryParams.append("slippage", params.slippage);
                    queryParams.append("userWalletAddress", params.userWalletAddress);

                    // Optional parameters
                    if (params.chainIndex) queryParams.append("chainIndex", params.chainIndex);
                    if (params.swapReceiverAddress) queryParams.append("swapReceiverAddress", params.swapReceiverAddress);
                    if (params.feePercent) queryParams.append("feePercent", params.feePercent);
                    if (params.fromTokenReferrerWalletAddress) queryParams.append("fromTokenReferrerWalletAddress", params.fromTokenReferrerWalletAddress);
                    if (params.toTokenReferrerWalletAddress) queryParams.append("toTokenReferrerWalletAddress", params.toTokenReferrerWalletAddress);
                    if (params.gasLimit) queryParams.append("gasLimit", params.gasLimit);
                    if (params.gasLevel) queryParams.append("gasLevel", params.gasLevel);
                    if (params.autoSlippage !== undefined) queryParams.append("autoSlippage", params.autoSlippage.toString());
                    if (params.maxAutoSlippage) queryParams.append("maxAutoSlippage", params.maxAutoSlippage);
                    if (params.priceImpactProtectionPercentage) queryParams.append("priceImpactProtectionPercentage", params.priceImpactProtectionPercentage);

                    const fullPath = `${requestPath}?${queryParams.toString()}`;
                    const sign = this.generateSignature(timestamp, method, fullPath);

                    console.log("OKX DEX Swap Request:");
                    console.log("URL:", `https://web3.okx.com${fullPath}`);
                    console.log("Method:", method);

                    const res = await fetch(`https://web3.okx.com${fullPath}`, {
                        method,
                        headers: {
                            "OK-ACCESS-KEY": this.apiKey,
                            "OK-ACCESS-SIGN": sign,
                            "OK-ACCESS-TIMESTAMP": timestamp,
                            "OK-ACCESS-PASSPHRASE": this.passphrase,
                        },
                    });

                    const json = await res.json();

                    if (json.code !== "0" || !json.data?.[0]) {
                        throw new Error(`Failed to get swap quote: ${json.msg || "Unknown error"}`);
                    }

                    const swapData = json.data[0];
                    const routerResult = swapData.routerResult;

                    // Format the response
                    const response = [
                        `🔄 OKX DEX Swap Quote`,
                        `========================================`,
                        ``,
                        `📊 SWAP DETAILS:`,
                        `🔗 Chain: ${routerResult.chainIndex || routerResult.chainId}`,
                        `💰 From Amount: ${routerResult.fromTokenAmount} ${routerResult.fromToken.tokenSymbol}`,
                        `💎 To Amount: ${routerResult.toTokenAmount} ${routerResult.toToken.tokenSymbol}`,
                        `📈 Price Impact: ${routerResult.priceImpactPercentage}%`,
                        `⛽ Gas Fee: ${routerResult.estimateGasFee} wei`,
                        `💵 Trade Fee: $${routerResult.tradeFee}`,
                        ``,
                        `🪙 FROM TOKEN:`,
                        `📝 Symbol: ${routerResult.fromToken.tokenSymbol}`,
                        `📍 Address: ${routerResult.fromToken.tokenContractAddress}`,
                        `💲 Price: $${routerResult.fromToken.tokenUnitPrice || 'N/A'}`,
                        `🔢 Decimals: ${routerResult.fromToken.decimal}`,
                        `🍯 Honeypot: ${routerResult.fromToken.isHoneyPot ? 'Yes' : 'No'}`,
                        `💸 Tax Rate: ${(Number(routerResult.fromToken.taxRate) * 100).toFixed(2)}%`,
                        ``,
                        `🎯 TO TOKEN:`,
                        `📝 Symbol: ${routerResult.toToken.tokenSymbol}`,
                        `📍 Address: ${routerResult.toToken.tokenContractAddress}`,
                        `💲 Price: $${routerResult.toToken.tokenUnitPrice || 'N/A'}`,
                        `🔢 Decimals: ${routerResult.toToken.decimal}`,
                        `🍯 Honeypot: ${routerResult.toToken.isHoneyPot ? 'Yes' : 'No'}`,
                        `💸 Tax Rate: ${(Number(routerResult.toToken.taxRate) * 100).toFixed(2)}%`,
                        ``,
                        `🛣️ ROUTING INFO:`,
                        ...routerResult.dexRouterList.map((router: any, idx: number) => [
                            `Route ${idx + 1}: ${router.routerPercent}% of trade`,
                            ...router.subRouterList.map((sub: any) => 
                                sub.dexProtocol.map((protocol: any) => 
                                    `  - ${protocol.dexName}: ${protocol.percent}%`
                                ).join('\n')
                            )
                        ]).flat(),
                        ``,
                        `📋 TRANSACTION DATA:`,
                        `👤 From: ${swapData.tx.from}`,
                        `📍 To Contract: ${swapData.tx.to}`,
                        `⛽ Gas Limit: ${swapData.tx.gas}`,
                        `💰 Gas Price: ${swapData.tx.gasPrice} wei`,
                        `💎 Value: ${swapData.tx.value} wei`,
                        `📉 Min Receive: ${swapData.tx.minReceiveAmount}`,
                        `📊 Slippage: ${swapData.tx.slippage}`,
                        ``,
                        `📞 CALL DATA:`,
                        `${swapData.tx.data.substring(0, 100)}...`,
                        ``,
                        `⚠️  IMPORTANT NOTES:`,
                        `• Review all details before executing the transaction`,
                        `• Ensure you have sufficient gas for the transaction`,
                        `• The actual received amount may vary due to slippage`,
                        `• Use the provided transaction data to execute the swap`
                    ].join("\n");

                    return {
                        type: "text",
                        content: response,
                        metadata: {
                            swapData: swapData,
                            txData: swapData.tx,
                            routerResult: routerResult
                        }
                    };
                }
            ),

            createTool(
                {
                    name: "okx_dex_get_supported_chains",
                    description: "Get information about supported chains for OKX DEX",
                    parameters: z.object({}),
                },
                async () => {
                    const supportedChains = [
                        { chainIndex: "1", name: "Ethereum", symbol: "ETH" },
                        { chainIndex: "56", name: "BNB Smart Chain", symbol: "BNB" },
                        { chainIndex: "137", name: "Polygon", symbol: "MATIC" },
                        { chainIndex: "43114", name: "Avalanche", symbol: "AVAX" },
                        { chainIndex: "250", name: "Fantom", symbol: "FTM" },
                        { chainIndex: "42161", name: "Arbitrum", symbol: "ETH" },
                        { chainIndex: "10", name: "Optimism", symbol: "ETH" },
                        { chainIndex: "501", name: "Solana", symbol: "SOL" },
                        { chainIndex: "592", name: "TON", symbol: "TON" }
                    ];

                    const response = [
                        `🌐 OKX DEX Supported Chains`,
                        `================================`,
                        ``,
                        ...supportedChains.map(chain => 
                            `🔗 ${chain.name} (${chain.symbol}) - Chain Index: ${chain.chainIndex}`
                        ),
                        ``,
                        `💡 Use the chainIndex when making swap requests`
                    ].join("\n");

                    return {
                        type: "text",
                        content: response,
                        metadata: { supportedChains }
                    };
                }
            )
        ];
    }
}

export const OkxSwap = () => new OkxDexSwap();
