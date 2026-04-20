import {Bot, Context} from "grammy";
import {convertHangulToQwerty} from "es-hangul";

import {CommandRegistry} from "./CommandRegistry.js";
import {CommandExecutionRequest} from "./types/types.js";

interface ParsedCommand{
    token: string;
    args: string[];
    rawArgs: string;
}

export class CommandHandler{
    constructor(
        private readonly registry: CommandRegistry,
        private readonly bot: Bot,
    ){}

    register(bot: Bot, botUsername?: string): void{
        bot.on("message:text", async(ctx, next) => {
            const parsedCommand = this.parseCommand(ctx, botUsername);
            if(!parsedCommand){
                return next();
            }

            const command = this.resolveCommand(parsedCommand.token);
            if(!command){
                return;
            }

            const request: CommandExecutionRequest = {
                commandName: command.name,
                aliasUsed: parsedCommand.token,
                args: parsedCommand.args,
                rawArgs: parsedCommand.rawArgs,
                services: {
                    registry: this.registry,
                    bot: this.bot,
                },
            };

            await command.plugin.execute(ctx, request);
        });
    }

    private resolveCommand(token: string){
        const directMatch = this.registry.resolve(token);
        if(directMatch){
            return directMatch;
        }

        const qwertyToken = convertHangulToQwerty(token).toLowerCase();
        if(qwertyToken === token.toLowerCase()){
            return null;
        }
        return this.registry.resolve(qwertyToken);
    }

    private parseCommand(ctx: Context, botUsername?: string): ParsedCommand | null{
        const message = ctx.message;
        const text = message?.text;
        if(!text){
            return null;
        }

        const entity = message.entities?.find((item) => item.type === "bot_command" && item.offset === 0);
        const commandSegment = entity ? text.slice(0, entity.length) : this.extractLeadingCommandSegment(text);
        if(!commandSegment){
            return null;
        }

        const commandText = commandSegment.slice(1).trim();
        if(!commandText){
            return null;
        }

        const [commandName, targetUsername] = commandText.split("@", 2);
        if(targetUsername && botUsername && targetUsername.toLowerCase() !== botUsername.toLowerCase()){
            return null;
        }

        const rawArgs = text.slice(commandSegment.length).trim();
        return {
            token: commandName.toLowerCase(),
            rawArgs,
            args: rawArgs ? rawArgs.split(/\s+/) : [],
        };
    }

    private extractLeadingCommandSegment(text: string): string | null{
        if(!text.startsWith("/")){
            return null;
        }
        const firstWhitespaceIndex = text.search(/\s/);
        if(firstWhitespaceIndex === -1){
            return text;
        }
        return text.slice(0, firstWhitespaceIndex);
    }
}
