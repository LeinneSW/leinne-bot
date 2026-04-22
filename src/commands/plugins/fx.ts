import {Context} from "grammy";

import {BaseCommand} from "../BaseCommand.js";
import {CommandExecutionRequest} from "../types/types.js";

interface ParsedConversionRequest{
    amount: number;
    base: string;
    quote: string;
}

interface FrankfurterLatestResponse{
    amount: number;
    base: string;
    date: string;
    rates: Record<string, number>;
}

interface ApiErrorResponse{
    message?: string;
}

//noinspection JSUnusedGlobalSymbols
export default class FxCommand extends BaseCommand{
    readonly definition = {
        name: "fx",
        aliases: ["exc", "exchange"],
        description: "/fx 100 USD KRW => 환율 변환",
    };

    async execute(ctx: Context, request: CommandExecutionRequest){
        const chatOptions = {reply_parameters: {message_id: ctx.msg!.message_id}};

        try{
            const conversionRequest = this.parseRequest(request.rawArgs);
            const result = await this.convertCurrency(conversionRequest);

            await ctx.reply(
                [
                    `${this.formatAmount(result.amount)} ${result.base} = ${this.formatAmount(result.convertedAmount)} ${result.quote}`,
                    `기준 환율: 1 ${result.base} = ${this.formatRate(result.rate)} ${result.quote}`,
                    `기준일: ${result.date}`,
                    "출처: Frankfurter",
                ].join("\n"),
                chatOptions,
            );
        }catch(error){
            const message = error instanceof Error ? error.message : "환율 변환에 실패했습니다.";
            await ctx.reply(message, chatOptions);
        }
    }

    private parseRequest(rawArgs: string): ParsedConversionRequest{
        const input = rawArgs.trim();

        if(!input){
            throw new Error(
                [
                    "사용법: /fx <금액> <기준통화> <대상통화>",
                    "예시: /fx 100 USD KRW",
                    "예시: /fx USD/KRW 100",
                    "예시: /fx USD KRW",
                ].join("\n"),
            );
        }

        let amount: number | null = null;
        const currencies: string[] = [];

        for(const token of input.split(/\s+/)){
            const normalizedToken = token.trim();
            const lowerToken = normalizedToken.toLowerCase();

            if(["to", "in", "into", "->"].includes(lowerToken)){
                continue;
            }

            const pairMatch = normalizedToken.match(/^([a-z]{3})\/([a-z]{3})$/i);
            if(pairMatch){
                currencies.push(pairMatch[1].toUpperCase(), pairMatch[2].toUpperCase());
                continue;
            }

            const amountWithCurrencyMatch = normalizedToken.match(/^([-+]?(?:\d+(?:,\d{3})*|\d+|\.\d+)(?:\.\d+)?)([a-z]{3})$/i);
            if(amountWithCurrencyMatch){
                amount = this.parseAmountToken(amountWithCurrencyMatch[1], amount);
                currencies.push(amountWithCurrencyMatch[2].toUpperCase());
                continue;
            }

            if(/^[a-z]{3}$/i.test(normalizedToken)){
                currencies.push(normalizedToken.toUpperCase());
                continue;
            }

            if(/^[-+]?(?:\d+(?:,\d{3})*|\d+|\.\d+)(?:\.\d+)?$/.test(normalizedToken)){
                amount = this.parseAmountToken(normalizedToken, amount);
                continue;
            }

            throw new Error(`해석할 수 없는 입력입니다: "${normalizedToken}"\n예시: /fx 100 USD KRW`);
        }

        if(currencies.length !== 2){
            throw new Error("통화 코드는 두 개가 필요합니다. 예시: /fx 100 USD KRW");
        }

        return {
            amount: amount ?? 1,
            base: currencies[0],
            quote: currencies[1],
        };
    }

    private parseAmountToken(token: string, currentAmount: number | null): number{
        if(currentAmount !== null){
            throw new Error("금액은 하나만 입력해 주세요. 예시: /fx 100 USD KRW");
        }

        const amount = Number(token.replace(/,/g, ""));
        if(!Number.isFinite(amount)){
            throw new Error(`금액을 읽을 수 없습니다: "${token}"`);
        }

        if(amount < 0){
            throw new Error("금액은 0 이상이어야 합니다.");
        }

        return amount;
    }

    private async convertCurrency(request: ParsedConversionRequest): Promise<{
        amount: number;
        base: string;
        quote: string;
        convertedAmount: number;
        rate: number;
        date: string;
    }>{
        if(request.base === request.quote){
            return {
                amount: request.amount,
                base: request.base,
                quote: request.quote,
                convertedAmount: request.amount,
                rate: 1,
                date: new Date().toISOString().slice(0, 10),
            };
        }

        const url = new URL("https://api.frankfurter.dev/v1/latest");
        url.searchParams.set("amount", request.amount.toString());
        url.searchParams.set("base", request.base);
        url.searchParams.set("symbols", request.quote);

        const response = await fetch(url);
        const payload = await this.readJsonResponse<FrankfurterLatestResponse | ApiErrorResponse>(response);

        if(!response.ok){
            const message = "message" in payload && typeof payload.message === "string"
                ? payload.message
                : `HTTP ${response.status}`;
            throw new Error(`환율 조회 실패: ${message}`);
        }

        if(!this.isLatestResponse(payload)){
            throw new Error("환율 응답이 올바르지 않습니다.");
        }

        const convertedAmount = payload.rates[request.quote];
        if(!Number.isFinite(convertedAmount)){
            throw new Error("환율 응답이 올바르지 않습니다.");
        }

        return {
            amount: request.amount,
            base: request.base,
            quote: request.quote,
            convertedAmount,
            rate: convertedAmount / (request.amount || 1),
            date: payload.date,
        };
    }

    private async readJsonResponse<T>(response: Response): Promise<T>{
        const text = await response.text();

        if(!text){
            throw new Error("빈 응답을 받았습니다.");
        }

        return JSON.parse(text) as T;
    }

    private isLatestResponse(payload: FrankfurterLatestResponse | ApiErrorResponse): payload is FrankfurterLatestResponse{
        return (
            typeof payload === "object"
            && payload !== null
            && "rates" in payload
            && typeof payload.rates === "object"
            && payload.rates !== null
            && "date" in payload
            && typeof payload.date === "string"
        );
    }

    private formatAmount(value: number): string{
        const maximumFractionDigits = Math.abs(value) >= 1_000 ? 2 : 4;
        return new Intl.NumberFormat("ko-KR", {
            minimumFractionDigits: 0,
            maximumFractionDigits,
        }).format(value);
    }

    private formatRate(value: number): string{
        return new Intl.NumberFormat("ko-KR", {
            minimumFractionDigits: 0,
            maximumFractionDigits: 6,
        }).format(value);
    }
}
