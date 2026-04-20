import {Context} from "grammy";

import {BaseCommand} from "../BaseCommand.js";
import {CommandExecutionRequest} from "../types/types.js";

//noinspection JSUnusedGlobalSymbols
export default class BmiCommand extends BaseCommand{
    readonly definition = {
        name: "bmi",
        description: "/bmi <키> <몸무게> => BMI 계산",
    };

    async execute(ctx: Context, request: CommandExecutionRequest){
        const chatOptions = {reply_parameters: {message_id: ctx.msg!.message_id}};

        try{
            const [heightInput, weightInput] = this.parseArguments(request);
            const heightMeters = this.parseHeight(heightInput);
            const weightKg = this.parseWeight(weightInput);
            const bmi = weightKg / (heightMeters * heightMeters);

            await ctx.reply(
                [
                    `BMI: ${bmi.toFixed(1)}`,
                    `${this.printStatus(bmi)}`,
                    `키: ${(heightMeters * 100).toFixed(1)}cm, 몸무게: ${weightKg.toFixed(1)}kg`,
                ].join("\n"),
                chatOptions,
            );
        }catch(error){
            const message = error instanceof Error ? error.message : "BMI를 계산할 수 없습니다.";
            await ctx.reply(`사용법: /bmi <키> <몸무게>\n예시: /bmi 170 65\n${message}`, chatOptions);
        }
    }

    private parseArguments(request: CommandExecutionRequest): [string, string]{
        if(request.args.length !== 2){
            throw new Error("키와 몸무게를 각각 하나씩 입력해야 합니다.");
        }

        return [request.args[0], request.args[1]];
    }

    private parseHeight(input: string): number{
        const normalized = input.trim().toLowerCase().replace(/,/g, "");
        const numericValue = this.parseNumericValue(normalized.replace(/cm|m/g, ""));

        if(normalized.endsWith("cm")){
            return this.validateHeightMeters(numericValue / 100);
        }

        if(normalized.endsWith("m")){
            return this.validateHeightMeters(numericValue);
        }

        if(numericValue >= 3){
            return this.validateHeightMeters(numericValue / 100);
        }

        return this.validateHeightMeters(numericValue);
    }

    private parseWeight(input: string): number{
        const normalized = input.trim().toLowerCase().replace(/,/g, "");
        const numericValue = this.parseNumericValue(normalized.replace(/kg/g, ""));

        return this.validateWeightKg(numericValue);
    }

    private parseNumericValue(input: string): number{
        if(!/^\d+(\.\d+)?$/.test(input)){
            throw new Error(`숫자 형식이 올바르지 않습니다: ${input}`);
        }

        return Number(input);
    }

    private validateHeightMeters(heightMeters: number): number{
        if(!Number.isFinite(heightMeters) || heightMeters < 0.5 || heightMeters > 3){
            throw new Error("키 형식이 올바르지 않습니다. 예: 170, 170cm, 1.70m");
        }

        return heightMeters;
    }

    private validateWeightKg(weightKg: number): number{
        if(!Number.isFinite(weightKg) || weightKg < 10 || weightKg > 500){
            throw new Error("몸무게 형식이 올바르지 않습니다. 예: 65, 65kg");
        }

        return weightKg;
    }

    private printStatus(bmi: number): string{
        if(bmi < 18.5){
            return "많이 드셔야겠네요. 저체중입니다.";
        }
        if(bmi < 23){
            return "건강하시네요! 정상입니다.";
        }
        if(bmi < 25){
            return "관리좀 하셔야겠어요. 과체중입니다.";
        }
        if(bmi < 30){
            return "이젠 식단관리 하셔야합니다. 비만입니다.";
        }
        return "심각한 수준입니다. 애인을 사귈 수 있을까요? 고도비만이십니다.";
    }
}
