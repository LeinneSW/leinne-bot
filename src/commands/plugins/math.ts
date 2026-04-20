import {BaseCommand} from "../BaseCommand.js";
import {CommandExecutionRequest, CommandInitContext} from "../types/types.js";
import {Context} from "grammy";
import {all, create} from "mathjs";

//noinspection JSUnusedGlobalSymbols
export default class MathCommand extends BaseCommand{
    private readonly math = create(all, {});
    readonly definition = {
        name: "m",
        aliases: ["calc"],
        description: "/m <수식> or <수식 답장> => 계산 결과",
    };

    override init(context: CommandInitContext): void{
        super.init(context);
        this.registerDefaultDefinitions();
    }

    async execute(ctx: Context, request: CommandExecutionRequest){
        const expression = ctx.msg?.reply_to_message?.text?.trim() || request.rawArgs.trim();

        if(!expression){
            await ctx.reply("사용법: /m <수식> 또는 수식에 답장 후 /m\n예시: 1,000,000 * 12.5%");
            return;
        }

        const chatOptions = {reply_parameters: {message_id: ctx.msg!.message_id}};
        try{
            const result = this.evaluateNumber(expression);
            await ctx.reply(`결과: ${result}`, chatOptions);
        }catch(error){
            const message = error instanceof Error ? error.message : "Failed to evaluate expression.";
            await ctx.reply(`계산 실패: ${message}`, chatOptions);
        }
    }

    private evaluateNumber(expression: string, scope: Record<string, number> = {}): number{
        this.validateExpression(expression);
        const normalizedExpression = this.normalizeExpression(expression);

        const result = this.math.evaluate(normalizedExpression, scope);
        const numericResult = this.normalizeResult(result);

        if(!Number.isFinite(numericResult)){
            throw new Error("Result must be a finite number.");
        }

        return numericResult;
    }

    private registerFunction(name: string, fn: (...args: number[]) => number): void{
        this.assertIdentifier(name);
        this.math.import({[name]: fn}, {override: true});
    }

    private registerSymbol(name: string, value: number): void{
        this.assertIdentifier(name);

        if(!Number.isFinite(value)){
            throw new Error(`Symbol "${name}" must be a finite number.`);
        }

        this.math.import({[name]: value}, {override: true});
    }

    private registerDefaultDefinitions(): void{
        this.registerFunction("avg", (...values) => {
            if(values.length === 0){
                throw new Error("avg requires at least one number.");
            }

            return values.reduce((sum, value) => sum + value, 0) / values.length;
        });

        this.registerFunction("clamp", (value, min, max) => Math.min(Math.max(value, min), max));
        this.registerFunction("pct", (value) => value / 100);
        this.registerFunction("tax", (price, rate) => price * (1 + rate));

        this.registerSymbol("k", 1_000);
        this.registerSymbol("mil", 1_000_000);
        this.registerSymbol("bil", 1_000_000_000);
        this.registerSymbol("tau", Math.PI * 2);
    }

    private normalizeExpression(expression: string): string{
        const withoutNumericCommas = expression.replace(/\b\d{1,3}(,\d{3})+(\.\d+)?\b/g, (value) => value.replace(/,/g, ""));
        return this.transformPercentOperators(withoutNumericCommas);
    }

    private transformPercentOperators(expression: string): string{
        let result = "";

        for(let index = 0; index < expression.length; index += 1){
            const char = expression[index];

            if(char !== "%"){
                result += char;
                continue;
            }

            const nextIndex = this.findNextNonWhitespaceIndex(expression, index + 1);

            if(nextIndex !== -1){
                const nextChar = expression[nextIndex];

                if(/[A-Za-z0-9_(.]/.test(nextChar)){
                    throw new Error('Percent "%" must be used as a postfix operator like "12.5%".');
                }
            }

            const operandStart = this.findPercentOperandStart(result);
            const operand = result.slice(operandStart).trim();

            if(!operand){
                throw new Error('Percent "%" must follow a number, symbol, function call, or parenthesized expression.');
            }

            result = `${result.slice(0, operandStart)}(${operand} / 100)`;
        }

        return result;
    }

    private validateExpression(expression: string): void{
        const trimmed = expression.trim();

        if(!trimmed){
            throw new Error("Expression is empty.");
        }

        if(trimmed.length > 200){
            throw new Error("Expression is too long.");
        }

        if(/[;=]/.test(trimmed)){
            throw new Error('";" and "=" are not allowed.');
        }
    }

    private findNextNonWhitespaceIndex(expression: string, startIndex: number): number{
        for(let index = startIndex; index < expression.length; index += 1){
            if(!/\s/.test(expression[index])){
                return index;
            }
        }

        return -1;
    }

    private findPercentOperandStart(source: string): number{
        let index = source.length - 1;

        while(index >= 0 && /\s/.test(source[index])){
            index -= 1;
        }

        if(index < 0){
            throw new Error('Percent "%" is missing a left-hand operand.');
        }

        const char = source[index];

        if(char === ")"){
            const openIndex = this.findMatchingOpenParen(source, index);
            let start = openIndex;
            let identifierIndex = openIndex - 1;

            while(identifierIndex >= 0 && /\s/.test(source[identifierIndex])){
                identifierIndex -= 1;
            }

            while(identifierIndex >= 0 && /[A-Za-z0-9_]/.test(source[identifierIndex])){
                start = identifierIndex;
                identifierIndex -= 1;
            }

            return start;
        }

        if(/[0-9.]/.test(char)){
            while(index >= 0 && /[0-9.]/.test(source[index])){
                index -= 1;
            }

            return index + 1;
        }

        if(/[A-Za-z0-9_]/.test(char)){
            while(index >= 0 && /[A-Za-z0-9_]/.test(source[index])){
                index -= 1;
            }

            return index + 1;
        }

        throw new Error('Percent "%" must follow a number, symbol, function call, or parenthesized expression.');
    }

    private findMatchingOpenParen(source: string, closeIndex: number): number{
        let depth = 0;

        for(let index = closeIndex; index >= 0; index -= 1){
            if(source[index] === ")"){
                depth += 1;
            }else if(source[index] === "("){
                depth -= 1;

                if(depth === 0){
                    return index;
                }
            }
        }

        throw new Error("Unmatched closing parenthesis.");
    }

    private normalizeResult(result: unknown): number{
        if(typeof result === "number"){
            return result;
        }

        if(typeof result === "bigint"){
            return Number(result);
        }

        if(this.hasToNumber(result)){
            return result.toNumber();
        }

        throw new Error("Expression did not produce a scalar number.");
    }

    private hasToNumber(value: unknown): value is {toNumber(): number}{
        return typeof value === "object" && value !== null && "toNumber" in value && typeof value.toNumber === "function";
    }

    private assertIdentifier(name: string): void{
        if(!/^[A-Za-z_][A-Za-z0-9_]*$/.test(name)){
            throw new Error(`Invalid math identifier: "${name}"`);
        }
    }
}
