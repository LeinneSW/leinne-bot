import {BaseCommand} from "../BaseCommand.js";
import {CommandExecutionRequest} from "../types/types.js";
import {Context} from "grammy";
import {convertHangulToQwerty} from 'es-hangul';

//noinspection JSUnusedGlobalSymbols
export default class ToEngCommand extends BaseCommand{
    readonly definition = {
        name: "k",
        description: "/ㅏ <한글> or <한글 답장> => 영타 출력",
    };

    async execute(ctx: Context, request: CommandExecutionRequest){
        let message = '';
        if(ctx.msg?.reply_to_message?.text){
            message = ctx.msg?.reply_to_message.text;
        }
        await ctx.reply(convertHangulToQwerty(message || request.rawArgs), {reply_parameters: {message_id: ctx.msg!.message_id}});
    }
}
