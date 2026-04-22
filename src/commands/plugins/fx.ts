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

const CURRENCY_SYMBOL_MAP: Record<string, string> = {
    "$": "USD",
    "₩": "KRW",
    "€": "EUR",
    "£": "GBP",
    "¥": "JPY",
};

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
            const conversionRequest = this.parseRequest(request.args);
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

    private parseRequest(tokens: string[]): ParsedConversionRequest{
        if(tokens.length === 0){
            throw new Error(
                [
                    "사용법: /fx <금액> <기준통화> <대상통화>",
                    "예시: /fx 100 USD KRW",
                    "예시: /fx USD/KRW 100",
                    "예시: /fx $100",
                    "예시: /fx 100 USD -> KRW 기준",
                    "예시: /fx USD KRW",
                ].join("\n"),
            );
        }

        let amount: number | null = null;
        const currencies: string[] = [];

        for(const token of tokens){
            if(this.isConnectorToken(token)){
                continue;
            }

            const currencyPair = this.parseCurrencyPair(token);
            if(currencyPair){
                currencies.push(currencyPair.base, currencyPair.quote);
                continue;
            }

            const amountWithCurrency = this.parseAmountWithCurrencyToken(token);
            if(amountWithCurrency){
                amount = this.useAmount(amountWithCurrency.amount, amount);
                currencies.push(amountWithCurrency.currency);
                continue;
            }

            const currency = this.parseStandaloneCurrencyToken(token);
            if(currency){
                currencies.push(currency);
                continue;
            }

            const parsedAmount = this.tryParseAmount(token);
            if(parsedAmount !== null){
                amount = this.useAmount(parsedAmount, amount);
                continue;
            }

            throw new Error(`해석할 수 없는 입력입니다: "${token}"\n예시: /fx 100 USD KRW`);
        }

        if(currencies.length === 1){
            return {
                amount: amount ?? 1,
                base: "KRW",
                quote: currencies[0],
            };
        }

        if(currencies.length !== 2){
            throw new Error("변환하려는 통화 코드가 필요합니다. 예시: /fx 100 USD, /fx 100 USD KRW");
        }

        return {
            amount: amount ?? 1,
            base: currencies[0],
            quote: currencies[1],
        };
    }

    private isConnectorToken(token: string): boolean{
        const normalizedToken = token.toLowerCase();
        return normalizedToken === "to" || normalizedToken === "in" || normalizedToken === "into" || normalizedToken === "->";
    }

    private parseCurrencyPair(token: string): {base: string; quote: string} | null{
        const slashIndex = token.indexOf("/");
        if(slashIndex <= 0 || slashIndex !== token.lastIndexOf("/")){
            return null;
        }

        const base = this.parseStandaloneCurrencyToken(token.slice(0, slashIndex));
        const quote = this.parseStandaloneCurrencyToken(token.slice(slashIndex + 1));
        if(!base || !quote){
            return null;
        }

        return {base, quote};
    }

    private parseAmountWithCurrencyToken(token: string): {amount: number; currency: string} | null{
        if(token.length < 2){
            return null;
        }

        const leadingCurrency = this.parseStandaloneCurrencyToken(token[0]);
        if(leadingCurrency){
            const amount = this.tryParseAmount(token.slice(1));
            if(amount !== null){
                return {amount, currency: leadingCurrency};
            }
        }

        const trailingCurrency = this.parseStandaloneCurrencyToken(token[token.length - 1]);
        if(trailingCurrency){
            const amount = this.tryParseAmount(token.slice(0, -1));
            if(amount !== null){
                return {amount, currency: trailingCurrency};
            }
        }

        if(token.length > 3){
            const leadingCode = this.parseStandaloneCurrencyToken(token.slice(0, 3));
            if(leadingCode){
                const amount = this.tryParseAmount(token.slice(3));
                if(amount !== null){
                    return {amount, currency: leadingCode};
                }
            }

            const trailingCode = this.parseStandaloneCurrencyToken(token.slice(-3));
            if(trailingCode){
                const amount = this.tryParseAmount(token.slice(0, -3));
                if(amount !== null){
                    return {amount, currency: trailingCode};
                }
            }
        }

        return null;
    }

    private parseStandaloneCurrencyToken(token: string): string | null{
        if(token in CURRENCY_SYMBOL_MAP){
            return CURRENCY_SYMBOL_MAP[token];
        }

        if(token.length !== 3){
            return null;
        }

        for(const char of token){
            const code = char.charCodeAt(0);
            const isAsciiLetter = (code >= 65 && code <= 90) || (code >= 97 && code <= 122);
            if(!isAsciiLetter){
                return null;
            }
        }

        return token.toUpperCase();
    }

    private tryParseAmount(token: string): number | null{
        if(!token){
            return null;
        }

        let normalized = "";
        let hasDigit = false;
        let hasDecimalPoint = false;

        for(let index = 0; index < token.length; index += 1){
            const char = token[index];

            if(index === 0 && (char === "+" || char === "-")){
                normalized += char;
                continue;
            }

            if(char >= "0" && char <= "9"){
                normalized += char;
                hasDigit = true;
                continue;
            }

            if(char === ","){
                continue;
            }

            if(char === "." && !hasDecimalPoint){
                normalized += char;
                hasDecimalPoint = true;
                continue;
            }

            return null;
        }

        if(!hasDigit || normalized === "+" || normalized === "-" || normalized === "." || normalized === "+." || normalized === "-."){
            return null;
        }

        const amount = Number(normalized);
        if(!Number.isFinite(amount)){
            return null;
        }

        if(amount < 0){
            throw new Error("금액은 0 이상이어야 합니다.");
        }

        return amount;
    }

    private useAmount(amount: number, currentAmount: number | null): number{
        if(currentAmount !== null){
            throw new Error("금액은 하나만 입력해 주세요. 예시: /fx 100 USD KRW");
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
