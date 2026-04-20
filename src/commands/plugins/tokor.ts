import {BaseCommand} from "../BaseCommand.js";
import {CommandExecutionRequest} from "../types/types.js";
import {Context} from "grammy";
import {convertQwertyToHangul} from 'es-hangul';

//noinspection JSUnusedGlobalSymbols
export default class ToKorCommand extends BaseCommand{
    readonly definition = {
        name: "e",
        description: "/e <영타> or <영타 답장> => 한글 출력",
    };

    async execute(ctx: Context, request: CommandExecutionRequest){
        let message = '';
        if(ctx.msg?.reply_to_message?.text){
            message = ctx.msg?.reply_to_message.text;
        }
        await ctx.reply(convertQwertyToHangul(message || request.rawArgs), {reply_parameters: {message_id: ctx.msg!.message_id}});
    }
}
