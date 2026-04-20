import "dotenv/config";

import {BotApplication} from "./app/BotApplication.js";
import {loadConfig} from "./config/loadConfig.js";

async function main(): Promise<void>{
    const app = new BotApplication(loadConfig());
    await app.start();
}

main().catch((error) => {
    console.error("Failed to start bot", error);
    process.exit(1);
});
