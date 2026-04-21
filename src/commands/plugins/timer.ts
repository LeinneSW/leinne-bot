import path from "node:path";
import {randomUUID} from "node:crypto";
import {Context} from "grammy";

import {BaseCommand} from "../BaseCommand.js";
import {CommandExecutionRequest, CommandInitContext} from "../types/types.js";
import {TimerRecord, TimerRepository} from "../../timers/TimerRepository.js";

const MAX_TIMER_SECONDS = 24 * 60 * 60;
const RETRY_DELAY_MS = 60 * 1000;

interface ParsedTimerRequest{
    durationSeconds: number;
    message: string;
}

//noinspection JSUnusedGlobalSymbols
export default class TimerCommand extends BaseCommand{
    readonly definition = {
        name: "timer",
        description: "/timer <시간> <메시지> => 시간이 지나면 메시지 전송",
    };

    private repository?: TimerRepository;
    private scheduledTimeouts = new Map<string, NodeJS.Timeout>();
    private disposed = false;

    override async init(context: CommandInitContext): Promise<void>{
        super.init(context);

        const storagePath = path.resolve(process.cwd(), "data", "timers.json");
        this.repository = new TimerRepository(storagePath);
        await this.repository.init();

        const timers = await this.repository.getAll();
        for(const timer of timers){
            this.scheduleTimer(timer.id, Math.max(timer.dueAt - Date.now(), 0));
        }
    }

    override dispose(): void{
        this.disposed = true;

        for(const timeout of this.scheduledTimeouts.values()){
            clearTimeout(timeout);
        }

        this.scheduledTimeouts.clear();
    }

    async execute(ctx: Context, request: CommandExecutionRequest){
        if(!this.repository){
            throw new Error("Timer repository is not initialized.");
        }

        try{
            const parsedRequest = this.parseRequest(request.rawArgs);
            const now = Date.now();
            const timer: TimerRecord = {
                id: randomUUID(),
                chatId: ctx.chat!.id,
                message: parsedRequest.message,
                dueAt: now + parsedRequest.durationSeconds * 1000,
                createdAt: now,
            };

            await this.repository.add(timer);
            this.scheduleTimer(timer.id, parsedRequest.durationSeconds * 1000);

            await ctx.reply(
                [
                    `타이머를 설정했습니다.`,
                    `남은 시간: ${this.formatDuration(parsedRequest.durationSeconds)}`,
                    `전송 예정 시각: ${this.formatTimestamp(new Date(timer.dueAt))}`,
                    `메시지: ${timer.message}`,
                ].join("\n"),
                {
                    reply_parameters: {
                        message_id: ctx.msg!.message_id,
                    },
                },
            );
        }catch(error){
            const message = error instanceof Error ? error.message : "타이머를 설정할 수 없습니다.";
            await ctx.reply(
                [
                    "사용법: /timer <시간> <메시지>",
                    "예시: /timer 30 물 마실 시간",
                    "예시: /timer 1h 20m 회의 시작",
                    "시간은 초 숫자 또는 h/m/s 조합만 지원하며 최대 24시간입니다.",
                    message,
                ].join("\n"),
                {
                    reply_parameters: {
                        message_id: ctx.msg!.message_id,
                    },
                },
            );
        }
    }

    private parseRequest(rawArgs: string): ParsedTimerRequest{
        const trimmedArgs = rawArgs.trim();
        if(!trimmedArgs){
            throw new Error("시간과 메시지를 함께 입력해야 합니다.");
        }

        const tokens = trimmedArgs.split(/\s+/);
        if(tokens.length < 2){
            throw new Error("시간 뒤에 전송할 메시지를 입력해야 합니다.");
        }

        let consumedTokens = 0;
        let durationSeconds = 0;

        if(/^\d+$/.test(tokens[0])){
            durationSeconds = Number(tokens[0]);
            consumedTokens = 1;
        }else{
            for(const token of tokens){
                const parsedTokenSeconds = this.parseDurationToken(token);
                if(parsedTokenSeconds === null){
                    break;
                }

                durationSeconds += parsedTokenSeconds;
                consumedTokens += 1;
            }
        }

        if(consumedTokens === 0){
            throw new Error("시간 형식이 올바르지 않습니다.");
        }

        const message = tokens.slice(consumedTokens).join(" ").trim();
        if(!message){
            throw new Error("시간 뒤에 전송할 메시지를 입력해야 합니다.");
        }

        if(!Number.isSafeInteger(durationSeconds) || durationSeconds <= 0){
            throw new Error("시간은 1초 이상이어야 합니다.");
        }

        if(durationSeconds > MAX_TIMER_SECONDS){
            throw new Error("타이머는 최대 24시간까지만 설정할 수 있습니다.");
        }

        return {
            durationSeconds,
            message,
        };
    }

    private parseDurationToken(token: string): number | null{
        const normalizedToken = token.trim().toLowerCase();
        if(!normalizedToken){
            return null;
        }

        if(!/^(?:\d+[hms])+$/.test(normalizedToken)){
            return null;
        }

        let totalSeconds = 0;

        for(const part of normalizedToken.matchAll(/(\d+)([hms])/g)){
            const amount = Number(part[1]);
            const unit = part[2];

            if(unit === "h"){
                totalSeconds += amount * 60 * 60;
                continue;
            }

            if(unit === "m"){
                totalSeconds += amount * 60;
                continue;
            }

            totalSeconds += amount;
        }

        return totalSeconds;
    }

    private scheduleTimer(timerId: string, delayMs: number): void{
        const existingTimeout = this.scheduledTimeouts.get(timerId);
        if(existingTimeout){
            clearTimeout(existingTimeout);
        }

        const timeout = setTimeout(() => {
            void this.deliverTimer(timerId);
        }, delayMs);

        this.scheduledTimeouts.set(timerId, timeout);
    }

    private async deliverTimer(timerId: string): Promise<void>{
        this.scheduledTimeouts.delete(timerId);

        if(this.disposed || !this.repository){
            return;
        }

        const timer = await this.repository.getById(timerId);
        if(!timer){
            return;
        }

        try{
            await this.services.bot.api.sendMessage(timer.chatId, `⏰ ${timer.message}`);
            await this.repository.remove(timer.id);
        }catch(error){
            console.error(`Failed to deliver timer ${timer.id}`, error);

            if(!this.disposed){
                this.scheduleTimer(timer.id, RETRY_DELAY_MS);
            }
        }
    }

    private formatDuration(totalSeconds: number): string{
        const parts: string[] = [];
        const hours = Math.floor(totalSeconds / 3600);
        const minutes = Math.floor((totalSeconds % 3600) / 60);
        const seconds = totalSeconds % 60;

        if(hours > 0){
            parts.push(`${hours}시간`);
        }

        if(minutes > 0){
            parts.push(`${minutes}분`);
        }

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
}
