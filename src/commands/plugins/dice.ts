import {Context} from "grammy";
import {josa,  numberToHangul} from "es-hangul";
import {BaseCommand} from "../BaseCommand.js";
import {CommandExecutionRequest} from "../types/types.js";

//noinspection JSUnusedGlobalSymbols
export default class DiceCommand extends BaseCommand{
    readonly definition = {
        name: "dice",
        description: "/dice => 1~100 주사위 굴리기",
    };

    async execute(ctx: Context, _request: CommandExecutionRequest){
        const chatOptions = {reply_parameters: {message_id: ctx.msg!.message_id}};

        let message = '또동...';
        const pendingMessage = await ctx.reply(message, chatOptions);
        await this.delay(150);

        message += ' 또동...'
        await ctx.api.editMessageText(pendingMessage.chat.id, pendingMessage.message_id, message);
        await this.delay(300);

        message += ' 🎲'
        await ctx.api.editMessageText(pendingMessage.chat.id, pendingMessage.message_id, message);
        await this.delay(100);

        message += '주사위를'
        await ctx.api.editMessageText(pendingMessage.chat.id, pendingMessage.message_id, message);
        await this.delay(150);

        message += ' 굴리는'
        await ctx.api.editMessageText(pendingMessage.chat.id, pendingMessage.message_id, message);
        await this.delay(150);

        message += ' 중입니다...'
        await ctx.api.editMessageText(pendingMessage.chat.id, pendingMessage.message_id, message);
        await this.delay(800);

        const value = Math.floor(Math.random() * 100) + 1;
        await ctx.api.editMessageText(
            pendingMessage.chat.id,
            pendingMessage.message_id,
            this.getReaction(value),
            {parse_mode: "HTML"},
        );
    }

    private getReaction(value: number): string{
        const boldNumber = `<b>${value}</b>`;
        const boldStr = `<b>${value}${josa.pick(numberToHangul(value), '이/가')}</b>`;
        if(value === 100){
            return this.pickRandom([
                `압도적입니다! ${boldStr} 나왔습니다! 운이 정말 좋으시네요!`,
                `무려 ${boldStr} 떴습니다! 당장 복권 사러 가셔야겠는데요?`,
                `${boldStr}라니, 주사위가 완벽하게 편을 들어주는데요?`,
                `주사위의 신이 강림했다! 축하드립니다! ${boldNumber}입니다!`,
                `미쳤다, ${boldStr} 나왔어요! 오늘 폼 미쳤네요.`
            ]);
        }
        if(value >= 90){
            return this.pickRandom([
                `${boldNumber}! 와... 거의 만점급이네요!`,
                `오, ${boldNumber}! 이 정도면 전설급이라고 봐도 되는 수준 아닌가요?`,
                `${boldStr} 떴습니다. 진짜 잘 나왔네요, 축하드려요!`,
                `크~ ${boldNumber}! 오늘 주사위 운 좀 치시는데요?`,
                `${boldNumber}입니다. 와, 보는 제가 다 기분이 좋아지네요.`
            ]);
        }
        if(value >= 80){
            return this.pickRandom([
                `${boldNumber}! 이 정도면 꽤 훌륭하죠.`,
                `오, ${boldNumber} 나왔네요. 상당히 만족스러운 결과입니다.`,
                `${boldNumber}입니다. 기분 좋게 넘어가셔도 될 것 같아요.`,
                `${boldNumber}! 나름 상위권 안착이네요.`,
                `꽤 잘 나왔네요! ${boldNumber}입니다. 이 기세로 계속 가시죠.`
            ]);
        }
        if(value >= 60){
            return this.pickRandom([
                `${boldStr} 나왔네요. 무난무난합니다.`,
                `${boldNumber}입니다. 딱 평타 쳤네요!`,
                `나쁘지 않아요. ${boldStr} 떴습니다.`,
                `${boldNumber}이라... 뭐, 이 정도면 선방했죠.`,
                `평범하지만 충분히 괜찮은 숫자, ${boldNumber}입니다.`
            ]);
        }
        if(value >= 40){
            return this.pickRandom([
                `아... ${boldNumber} 나왔네요. 뭔가 좀 애매하죠?`,
                `${boldNumber}입니다. 썩 나쁘진 않은데, 묘하게 아쉽네요.`,
                `${boldNumber}이라... 다시 굴리고 싶은 마음이 굴뚝같으시겠어요.`,
                `음, ${boldNumber}이네요. 딱 절반 언저리라 살짝 찝찝합니다.`,
                `${boldStr} 떴습니다. 좋지도 나쁘지도 않은 계륵 같은 결과네요.`
            ]);
        }
        if(value >= 20){
            return this.pickRandom([
                `아이고, ${boldStr} 나왔네요. 많이 아쉽습니다.`,
                `${boldNumber}입니다. 기대하셨을 텐데 운이 살짝 빗겨갔네요.`,
                `에구... ${boldNumber}이라니, 좀 낮은데요.`,
                `${boldNumber} 떴습니다. 다음 판을 노려봐야겠어요.`,
                `쓰읍... ${boldNumber}입니다. 주사위가 좀 안 도와주네요.`
            ]);
        }
        if(value >= 2){
            return this.pickRandom([
                `힘차게 굴렸지만 주사위에 적힌 숫자는 ${boldNumber}... 이건 좀 처참하네요.`,
                `숫자 ${boldNumber} 나왔습니다. 오늘 주사위 왜 이러죠?`,
                `아앗... ${boldNumber}입니다. 주사위가 너무 매정하네요.`,
                `눈물 나는 숫자네요... ${boldStr} 떴습니다.`,
                `${boldNumber}이라니, 밑바닥을 찍었으니 이제 올라갈 일만 남았습니다!`
            ]);
        }
        return this.pickRandom([
            `1이라니... 설마 했는데 1이 떴습니다.`,
            `와, 1이네요. 어떤 의미로는 100보다 띄우기 힘든 숫자죠.`,
            `1이 나왔습니다. 오늘은 그냥 푹 쉬시는 게 좋겠어요.`,
            `...1입니다. 주사위가 장난치는 게 분명해요.`,
            `1이 떴습니다! 액땜 제대로 하셨네요.`
        ]);
    }

    private pickRandom(messages: string[]): string{
        return messages[Math.floor(Math.random() * messages.length)];
    }

    private async delay(milliseconds: number): Promise<void>{
        await new Promise((resolve) => setTimeout(resolve, milliseconds));
    }
}
