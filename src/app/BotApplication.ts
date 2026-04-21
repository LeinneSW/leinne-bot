import {Bot} from "grammy";

import {CommandHandler} from "../commands/CommandHandler.js";
import {CommandLoader} from "../commands/CommandLoader.js";
import {CommandRegistry} from "../commands/CommandRegistry.js";
import {CommandPlugin, CommandServices} from "../commands/types/types.js";

export interface AppConfig{
    botToken: string;
    commandsDirectory: string;
}

export class BotApplication{
    private readonly bot: Bot;
    private readonly registry = new CommandRegistry();
    private readonly loader: CommandLoader;
    private readonly commandHandler: CommandHandler;
    private readonly services: CommandServices;
    private loadedCommands: CommandPlugin[] = [];
    private isDisposing = false;

    constructor(private readonly config: AppConfig){
        this.bot = new Bot(this.config.botToken);
        this.loader = new CommandLoader(this.config.commandsDirectory);
        this.services = {
            registry: this.registry,
            bot: this.bot,
        };
        this.commandHandler = new CommandHandler(this.registry, this.bot);
    }

    async start(): Promise<void>{
        this.bot.catch((error) => {
            console.error("Bot error", error.error);
        });

        this.loadedCommands = await this.loader.loadAll();

        for(const command of this.loadedCommands){
            this.registry.register(command);
        }

        const botProfile = await this.bot.api.getMe();

        for(const command of this.loadedCommands){
            await command.init?.({
                services: this.services,
                commandsDirectory: this.config.commandsDirectory,
            });
        }

        this.commandHandler.register(this.bot, botProfile.username);
        await this.bot.api.setMyCommands(this.registry.toTelegramCommands());

        process.once("SIGINT", () => this.bot.stop());
        process.once("SIGTERM", () => this.bot.stop());

        try{
            await this.bot.start({
                onStart: () => {
                    const loadedCommandNames = this.registry
                        .list()
                        .map((command) => `/${command.name}`)
                        .join(", ");

                    console.log(`Telegram bot is running as @${botProfile.username}`);
                    console.log(`Commands directory: ${this.config.commandsDirectory}`);
                    console.log(`Loaded commands: ${loadedCommandNames || "none"}`);
                },
            });
        }finally{
            await this.disposeCommands();
        }
    }

    private async disposeCommands(): Promise<void>{
        if(this.isDisposing){
            return;
        }

        this.isDisposing = true;

        for(const command of [...this.loadedCommands].reverse()){
            await command.dispose?.();
        }
    }
}
