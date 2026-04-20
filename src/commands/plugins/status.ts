import {Context} from "grammy";

import {BaseCommand} from "../BaseCommand.js";
import {CommandExecutionRequest} from "../types/types.js";

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
                `봇 시작 시각: ${this.formatTimestamp(startedAt)}`,
                `총 가동 시간: ${this.formatDuration(uptimeSeconds)}`,
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

    private formatDuration(totalSeconds: number): string{
        const parts: string[] = [];
        const days = Math.floor(totalSeconds / 86400);
        if(days > 0){
            parts.push(`${days}일`);
        }

        const hours = Math.floor((totalSeconds % 86400) / 3600);
        if(hours > 0){
            parts.push(`${hours}시간`);
        }

        const minutes = Math.floor((totalSeconds % 3600) / 60);
        if(minutes > 0){
            parts.push(`${minutes}분`);
        }

        const seconds = totalSeconds % 60;
        if(seconds > 0){
            parts.push(`${seconds}초`);
        }
        return parts.join(" ");
    }

    private formatTimestamp(date: Date): string{
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, "0");
        const day = String(date.getDate()).padStart(2, "0");
        const hours = String(date.getHours()).padStart(2, "0");
        const minutes = String(date.getMinutes()).padStart(2, "0");
        const seconds = String(date.getSeconds()).padStart(2, "0");

        return `${year}/${month}/${day} ${hours}:${minutes}:${seconds}`;
    }

    private formatMegabytes(bytes: number): string{
        return `${(bytes / 1024 / 1024).toFixed(1)}MB`;
    }
}
