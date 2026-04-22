import {Bot, Context} from "grammy";
import {convertHangulToQwerty} from "es-hangul";

import {getLeadingCommandSegment} from "./commandParsing.js";
import {CommandRegistry} from "./CommandRegistry.js";
import {CommandExecutionRequest, CommandServices} from "./types/types.js";

interface ParsedCommand{
    token: string;
    args: string[];
    rawArgs: string;
}

export class CommandHandler{
    constructor(
        private readonly registry: CommandRegistry,
        private readonly services: CommandServices,
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
                services: this.services,
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

        const commandSegment = getLeadingCommandSegment(text, message.entities);
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
}
