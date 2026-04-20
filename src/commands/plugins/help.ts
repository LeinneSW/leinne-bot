import {BaseCommand} from "../BaseCommand.js";
import {Context} from "grammy";
import {CommandExecutionRequest} from "../types/types.js";

//noinspection JSUnusedGlobalSymbols
export default class HelpCommand extends BaseCommand{
    readonly definition = {
        name: "help",
        description: "사용 가능한 명령어 목록을 보여줍니다",
        aliases: ["commands"],
    };

    async execute(ctx: Context, {services}: CommandExecutionRequest){
        const lines = services.registry.list().map((command) => {
            const aliases = command.aliases.length > 0 ? ` (${command.aliases.map((alias) => `/${alias}`).join(", ")})` : "";
            return `/${command.name}${aliases} - ${command.description}`;
        });

        await ctx.reply(lines.join("\n"));
    }
}
