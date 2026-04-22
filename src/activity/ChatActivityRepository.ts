import {promises as fs} from "node:fs";
import path from "node:path";

import {ChatActivityQuery, ChatActivityRecord} from "./types.js";

export class ChatActivityRepository{
    private writeQueue = Promise.resolve();

    constructor(
        private readonly filePath: string,
        private readonly retentionDays = 90,
    ){}

    async init(): Promise<void>{
        await fs.mkdir(path.dirname(this.filePath), {recursive: true});

        try{
            await fs.access(this.filePath);
        }catch(error){
            if((error as NodeJS.ErrnoException).code !== "ENOENT"){
                throw error;
            }

            await this.writeAllUnsafe([]);
        }
    }

    async getAll(): Promise<ChatActivityRecord[]>{
        await this.writeQueue;
        return this.readAllUnsafe();
    }

    async getByChat(chatId: number, query: ChatActivityQuery = {}): Promise<ChatActivityRecord[]>{
        const records = await this.getAll();
        return records.filter((record) => this.matchesQuery(record, chatId, query));
    }

    async append(record: ChatActivityRecord): Promise<void>{
        await this.enqueue(async() => {
            const records = await this.readAllUnsafe();
            records.push(record);
            const retentionStart = Date.now() - this.retentionDays * 24 * 60 * 60 * 1000;
            const retainedRecords = records.filter((item) => item.createdAt >= retentionStart);
            await this.writeAllUnsafe(retainedRecords);
        });
    }

    private matchesQuery(record: ChatActivityRecord, chatId: number, query: ChatActivityQuery): boolean{
        if(record.chatId !== chatId){
            return false;
        }

        if(query.since !== undefined && record.createdAt < query.since){
            return false;
        }

        if(query.until !== undefined && record.createdAt >= query.until){
            return false;
        }

        if(query.includeCommands !== true && record.isCommand){
            return false;
        }

        if(query.includeBots !== true && record.isBot){
            return false;
        }

        return true;
    }

    private enqueue<T>(operation: () => Promise<T>): Promise<T>{
        const result = this.writeQueue.then(operation, operation);
        this.writeQueue = result.then(() => undefined, () => undefined);
        return result;
    }

    private async readAllUnsafe(): Promise<ChatActivityRecord[]>{
        const content = await fs.readFile(this.filePath, "utf8");
        const parsed = JSON.parse(content) as unknown;

        if(!Array.isArray(parsed)){
            throw new Error(`Invalid chat activity storage format: ${this.filePath}`);
        }

        return parsed.map((item) => this.normalizeRecord(item));
    }

    private normalizeRecord(value: unknown): ChatActivityRecord{
        if(typeof value !== "object" || value === null){
            throw new Error(`Invalid chat activity record in ${this.filePath}`);
        }

        const candidate = value as Partial<ChatActivityRecord>;

        if(
            typeof candidate.chatId !== "number"
            || !Number.isFinite(candidate.chatId)
            || typeof candidate.messageId !== "number"
            || !Number.isFinite(candidate.messageId)
            || typeof candidate.userId !== "number"
            || !Number.isFinite(candidate.userId)
            || (typeof candidate.username !== "string" && candidate.username !== null)
            || typeof candidate.displayName !== "string"
            || typeof candidate.textLength !== "number"
            || !Number.isFinite(candidate.textLength)
            || candidate.messageType !== "text"
            || typeof candidate.isCommand !== "boolean"
            || typeof candidate.isBot !== "boolean"
            || typeof candidate.createdAt !== "number"
            || !Number.isFinite(candidate.createdAt)
        ){
            throw new Error(`Invalid chat activity record in ${this.filePath}`);
        }

        return {
            chatId: candidate.chatId,
            messageId: candidate.messageId,
            userId: candidate.userId,
            username: candidate.username,
            displayName: candidate.displayName,
            textLength: candidate.textLength,
            messageType: "text",
            isCommand: candidate.isCommand,
            isBot: candidate.isBot,
            createdAt: candidate.createdAt,
        };
    }

    private async writeAllUnsafe(records: ChatActivityRecord[]): Promise<void>{
        const tempPath = `${this.filePath}.tmp`;
        await fs.writeFile(tempPath, JSON.stringify(records, null, 2), "utf8");
        await fs.rename(tempPath, this.filePath);
    }
}
