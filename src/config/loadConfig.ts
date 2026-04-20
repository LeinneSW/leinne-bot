import path from "node:path";
import {fileURLToPath} from "node:url";

import {AppConfig} from "../app/BotApplication.js";

const moduleDirectory = path.dirname(fileURLToPath(import.meta.url));

export function loadConfig(): AppConfig{
    const botToken = process.env.BOT_TOKEN;
    if(!botToken){
        throw new Error("BOT_TOKEN is not set. Copy .env.example to .env and add your Telegram bot token.");
    }

    return {
        botToken,
        commandsDirectory: process.env.COMMANDS_DIR?.trim()
            ? path.resolve(process.cwd(), process.env.COMMANDS_DIR.trim())
            : path.resolve(moduleDirectory, "../commands/plugins"),
    };
}
