import {BaseCommand} from "../BaseCommand.js";
import {Context} from "grammy";
import {CommandExecutionRequest, CommandInitContext} from "../types/types.js";

//noinspection JSUnusedGlobalSymbols
export default class HelloCommand extends BaseCommand{
    readonly definition = {
        name: "hello",
        description: "예시 커맨드입니다",
        aliases: ["hi"],
    };

    override init(context: CommandInitContext){
        super.init(context);
        console.log(`[command:init] /${this.definition.name}`);
    }

    override dispose(){
        console.log(`[command:dispose] /${this.definition.name}`);
    }

    async execute(ctx: Context, {args, rawArgs}: CommandExecutionRequest){
        const commandList = this.services.registry.list().map((command) => `/${command.name}`).join(", ");

        await ctx.reply(
            [
                "새 커맨드가 정상적으로 실행되었습니다.",
                `args: ${args.join(", ") || "(none)"}`,
                `rawArgs: ${rawArgs || "(empty)"}`,
                `available: ${commandList}`,
            ].join("\n"),
        );
    }
}
