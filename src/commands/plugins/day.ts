import {Context} from "grammy";

import {BaseCommand} from "../BaseCommand.js";
import {CommandExecutionRequest} from "../types/types.js";

const MILLISECONDS_PER_DAY = 24 * 60 * 60 * 1000;

interface ParsedDate {
    year: number;
    month: number;
    day: number;
}

interface OffsetMode {
    offsetDays: number;
}

type ParsedInput = [ParsedDate] | [ParsedDate, ParsedDate] | OffsetMode;

//noinspection JSUnusedGlobalSymbols
export default class DayCommand extends BaseCommand{
    readonly definition = {
        name: "day",
        description: "/day <년/월/일> [년/월/일] => 날짜 차이 계산",
    };

    private escapeMarkdownV2(text: string): string{
        return text.replace(/[_*[\]()~`>#+\-=|{}.!]/g, "\\$&");
    }

    private inlineCode(text: string): string{
        return `\`${text.replace(/[`\\]/g, "\\$&")}\``;
    }

    async execute(ctx: Context, request: CommandExecutionRequest){
        const chatOptions = {
            parse_mode: "MarkdownV2" as const,
            reply_parameters: {
                message_id: ctx.msg!.message_id
            }
        };

        try{
            const parsedInput = this.parseArguments(request);

            if(this.isOffsetMode(parsedInput)){
                const today = this.getTodayDate();
                const targetDate = this.addDays(today, parsedInput.offsetDays);
                await ctx.reply(
                    [
                        `${this.inlineCode(this.formatDate(today))} 기준으로`,
                        `${this.escapeMarkdownV2(this.describeOffset(parsedInput.offsetDays))}는`,
                        `${this.inlineCode(this.formatDate(targetDate))}입니다\\.`,
                    ].join(" "),
                    chatOptions,
                );
                return;
            }

            const dates = parsedInput;
            const [fromDate, toDate] = dates.length === 1
                ? [this.getTodayDate(), dates[0]]
                : dates;

            const exclusiveDays = this.calculateExclusiveDays(fromDate, toDate);
            const inclusiveDays = exclusiveDays + 1;

            await ctx.reply(
                [
                    `${this.escapeMarkdownV2("기준:")} ${this.inlineCode(this.formatDate(fromDate))} ${this.escapeMarkdownV2("->")} ${this.inlineCode(this.formatDate(toDate))}`,
                    this.escapeMarkdownV2(this.describeRelation(fromDate, toDate)),
                    this.escapeMarkdownV2(`당일 미포함: ${exclusiveDays}일`),
                    this.escapeMarkdownV2(`당일 포함: ${inclusiveDays}일`),
                ].join("\n"),
                chatOptions,
            );
        }catch(error){
            const message = error instanceof Error ? error.message : "날짜를 계산할 수 없습니다.";
            await ctx.reply(
                [
                    this.escapeMarkdownV2("사용법:"),
                    this.inlineCode("/day YYYY/MM/DD [YYYY/MM/DD]"),
                    this.inlineCode("/day <일수>"),
                    this.escapeMarkdownV2(message),
                ].join("\n"),
                chatOptions,
            );
        }
    }

    private parseArguments(request: CommandExecutionRequest): ParsedInput{
        if(request.args.length !== 1 && request.args.length !== 2){
            throw new Error("날짜는 1개 또는 2개를 입력해야 합니다.");
        }

        if(request.args.length === 1){
            const numericOffset = this.tryParseOffset(request.args[0]);

            if(numericOffset !== null){
                return {offsetDays: numericOffset};
            }

            return [this.parseDate(request.args[0])];
        }

        return [this.parseDate(request.args[0]), this.parseDate(request.args[1])];
    }

    private tryParseOffset(input: string): number | null{
        const normalized = input.trim();

        if(!/^[+-]?\d+$/.test(normalized)){
            return null;
        }

        const offsetDays = Number(normalized);

        if(!Number.isSafeInteger(offsetDays)){
            throw new Error(`정수 범위를 벗어난 일수입니다: ${input}`);
        }

        return offsetDays;
    }

    private parseDate(input: string): ParsedDate{
        const normalized = input.trim();
        const match = normalized.match(/^(\d{4})\/(\d{1,2})\/(\d{1,2})$/);

        if(!match){
            throw new Error(`날짜 형식이 올바르지 않습니다: ${input}. YYYY/MM/DD 형식만 지원합니다.`);
        }

        const year = Number(match[1]);
        const month = Number(match[2]);
        const day = Number(match[3]);
        const utcTimestamp = Date.UTC(year, month - 1, day);
        const date = new Date(utcTimestamp);

        if(
            date.getUTCFullYear() !== year
            || date.getUTCMonth() !== month - 1
            || date.getUTCDate() !== day
        ){
            throw new Error(`존재하지 않는 날짜입니다: ${input}`);
        }

        return {year, month, day};
    }

    private getTodayDate(): ParsedDate{
        const now = new Date();

        return {
            year: now.getFullYear(),
            month: now.getMonth() + 1,
            day: now.getDate(),
        };
    }

    private addDays(date: ParsedDate, offsetDays: number): ParsedDate{
        const utc = Date.UTC(date.year, date.month - 1, date.day);
        const shifted = new Date(utc + offsetDays * MILLISECONDS_PER_DAY);

        return {
            year: shifted.getUTCFullYear(),
            month: shifted.getUTCMonth() + 1,
            day: shifted.getUTCDate(),
        };
    }

    private calculateExclusiveDays(fromDate: ParsedDate, toDate: ParsedDate): number{
        const fromUtc = Date.UTC(fromDate.year, fromDate.month - 1, fromDate.day);
        const toUtc = Date.UTC(toDate.year, toDate.month - 1, toDate.day);

        return Math.abs(Math.round((toUtc - fromUtc) / MILLISECONDS_PER_DAY));
    }

    private describeRelation(fromDate: ParsedDate, toDate: ParsedDate): string{
        const fromUtc = Date.UTC(fromDate.year, fromDate.month - 1, fromDate.day);
        const toUtc = Date.UTC(toDate.year, toDate.month - 1, toDate.day);

        if(fromUtc === toUtc){
            return "관계: 같은 날짜";
        }

        if(toUtc > fromUtc){
            return "관계: 뒤 날짜가 더 나중";
        }

        return "관계: 뒤 날짜가 더 이전";
    }

    private formatDate(date: ParsedDate): string{
        const month = String(date.month).padStart(2, "0");
        const day = String(date.day).padStart(2, "0");

        return `${date.year}/${month}/${day}`;
    }

    private describeOffset(offsetDays: number): string{
        if(offsetDays === 0){
            return "오늘과 같은 날짜";
        }

        if(offsetDays > 0){
            return `${offsetDays}일 후`;
        }

        return `${Math.abs(offsetDays)}일 전`;
    }

    private isOffsetMode(parsedInput: ParsedInput): parsedInput is OffsetMode{
        return !Array.isArray(parsedInput);
    }
}
