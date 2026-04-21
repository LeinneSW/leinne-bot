import {Context} from "grammy";

import {BaseCommand} from "../BaseCommand.js";
import {CommandExecutionRequest} from "../types/types.js";
import {formatDuration, formatTimestamp} from "../../utils/date.js";

//noinspection JSUnusedGlobalSymbols
export default class StatusCommand extends BaseCommand{
    readonly definition = {
        name: "status",
        description: "/status => 현재 봇 상태 확인",
    };

    async execute(ctx: Context, {services}: CommandExecutionRequest){
        const uptimeSeconds = Math.floor(process.uptime());
        const startedAt = new Date(Date.now() - uptimeSeconds * 1000);
        const memoryUsage = process.memoryUsage();
        const commandCount = services.registry.list().length;

        await ctx.reply(
            [
                `봇 시작 시각: ${formatTimestamp(startedAt)}`,
                `총 가동 시간: ${formatDuration(uptimeSeconds)}`,
                `메모리: RSS ${this.formatMegabytes(memoryUsage.rss)}, heap ${this.formatMegabytes(memoryUsage.heapUsed)} / ${this.formatMegabytes(memoryUsage.heapTotal)}`,
                `명령어: ${commandCount}개 활성화 됨`,
                `Node: ${process.version}`,
            ].join("\n"),
            {
                reply_parameters: {
                    message_id: ctx.msg!.message_id,
                },
            },
        );
    }

    private formatMegabytes(bytes: number): string{
        return `${(bytes / 1024 / 1024).toFixed(1)}MB`;
    }
}
