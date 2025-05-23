import express, { Request, Response } from "express";
import bodyParser from "body-parser";
import twilio from "twilio";
import base58 from "bs58";
import { Keypair, Connection } from "@solana/web3.js";

import { getOnChainTools } from "@goat-sdk/adapter-vercel-ai";
import { solana } from "@goat-sdk/wallet-solana";
import { generateText } from "ai";
import { openai } from "@ai-sdk/openai";

require("dotenv").config();

const app = express();
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

const twilioClient = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);

const keypair = Keypair.fromSecretKey(base58.decode(process.env.SOLANA_PRIVATE_KEY as string));
const connection = new Connection(process.env.SOLANA_RPC_URL as string);

let tools: any;

(async () => {
    tools = await getOnChainTools({
        wallet: solana({ keypair, connection }),
    });

    // WhatsApp endpoint with typed req/res
    app.post("/api/send-whatsapp", async (req: Request, res: Response) => {
        const from = req.body.From;
        const userMessage = req.body.Body;

        console.log("Received WhatsApp:", from, userMessage);

        try {
            const result = await generateText({
                model: openai("gpt-4o-mini"),
                tools,
                maxSteps: 10,
                prompt: `You are a based crypto degen assistant. You're knowledgeable about DeFi, NFTs, and trading. You use crypto slang naturally and stay up to date with Solana ecosystem. Keep responses concise and use emojis. User asked: ${userMessage}`
            });

            const responseText = result.text;

            const message = await twilioClient.messages.create({
                to: from,
                from: `whatsapp:${process.env.TWILIO_WHATSAPP_NUMBER}`,
                body: responseText,
            });

            res.json({ success: true, sid: message.sid });
        } catch (err: any) {
            console.error("Error:", err);
            res.status(500).json({ success: false, error: err.message });
        }
    });

    const PORT = process.env.PORT || 3000;
    app.listen(PORT, () => {
        console.log(`🚀 Server running on port ${PORT}`);
    });
})();
