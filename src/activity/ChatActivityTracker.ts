import {Bot, Context} from "grammy";

import {getLeadingCommandSegment} from "../commands/commandParsing.js";
import {ChatActivityRepository} from "./ChatActivityRepository.js";
import {ChatActivityRecord} from "./types.js";

export class ChatActivityTracker{
    constructor(private readonly repository: ChatActivityRepository){}

    register(bot: Bot): void{
        bot.on("message:text", async(ctx, next) => {
            try{
                await this.capture(ctx);
            }catch(error){
                console.error("Failed to capture chat activity", error);
            }

            return next();
        });
    }

    private async capture(ctx: Context): Promise<void>{
        const message = ctx.message;
        const chat = ctx.chat;
        const from = ctx.from;
        const text = message?.text;
        if(!message || !chat || !from || !text){
            return;
        }

        const record: ChatActivityRecord = {
            chatId: chat.id,
            messageId: message.message_id,
            userId: from.id,
            username: from.username ?? null,
            displayName: this.getDisplayName(from),
            textLength: this.measureTextLength(text),
            messageType: "text",
            isCommand: getLeadingCommandSegment(text, message.entities) !== null,
            isBot: from.is_bot,
            createdAt: message.date * 1000,
        };

        await this.repository.append(record);
    }

    private getDisplayName(user: NonNullable<Context["from"]>): string{
        const name = `${user.first_name ?? ""} ${user.last_name ?? ""}`.trim();
        if(name){
            return name;
        }

        if(user.username){
            return user.username;
        }

        return String(user.id);
    }

    private measureTextLength(text: string): number{
        const normalizedText = text.replace(/\s+/g, " ").trim();
        return Array.from(normalizedText).length;
    }
}
