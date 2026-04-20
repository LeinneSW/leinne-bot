import {BaseCommand} from "../BaseCommand.js";
import {CommandExecutionRequest} from "../types/types.js";
import {Context} from "grammy";

//noinspection JSUnusedGlobalSymbols
export default class PingCommand extends BaseCommand{
    readonly definition = {
        name: "ping",
        aliases: ["핑"],
        description: "봇의 네트워크 상태를 확인합니다",
    };

    async execute(ctx: Context, _request: CommandExecutionRequest){
        await ctx.reply(`퐁: ${Date.now() - (ctx.msg?.date || 0) * 1000}ms`);
    }
}
