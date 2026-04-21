import {promises as fs} from "node:fs";
import path from "node:path";

export interface TimerRecord{
    id: string;
    chatId: number;
    message: string;
    dueAt: number;
    createdAt: number;
}

export class TimerRepository{
    private writeQueue = Promise.resolve();

    constructor(private readonly filePath: string){}

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

    async getAll(): Promise<TimerRecord[]>{
        await this.writeQueue;
        return this.readAllUnsafe();
    }

    async getById(id: string): Promise<TimerRecord | null>{
        const timers = await this.getAll();
        return timers.find((timer) => timer.id === id) ?? null;
    }

    async add(record: TimerRecord): Promise<void>{
        await this.enqueue(async() => {
            const timers = await this.readAllUnsafe();
            timers.push(record);
            await this.writeAllUnsafe(timers);
        });
    }

    async remove(id: string): Promise<boolean>{
        return this.enqueue(async() => {
            const timers = await this.readAllUnsafe();
            const filteredTimers = timers.filter((timer) => timer.id !== id);

            if(filteredTimers.length === timers.length){
                return false;
            }

            await this.writeAllUnsafe(filteredTimers);
            return true;
        });
    }

    private enqueue<T>(operation: () => Promise<T>): Promise<T>{
        const result = this.writeQueue.then(operation, operation);
        this.writeQueue = result.then(() => undefined, () => undefined);
        return result;
    }

    private async readAllUnsafe(): Promise<TimerRecord[]>{
        const content = await fs.readFile(this.filePath, "utf8");
        const parsed = JSON.parse(content) as unknown;

        if(!Array.isArray(parsed)){
            throw new Error(`Invalid timer storage format: ${this.filePath}`);
        }

        return parsed.map((item) => this.normalizeRecord(item));
    }

    private normalizeRecord(value: unknown): TimerRecord{
        if(typeof value !== "object" || value === null){
            throw new Error(`Invalid timer record in ${this.filePath}`);
        }

        const candidate = value as Partial<TimerRecord>;

        if(
            typeof candidate.id !== "string"
            || typeof candidate.chatId !== "number"
            || !Number.isFinite(candidate.chatId)
            || typeof candidate.message !== "string"
            || typeof candidate.dueAt !== "number"
            || !Number.isFinite(candidate.dueAt)
            || typeof candidate.createdAt !== "number"
            || !Number.isFinite(candidate.createdAt)
        ){
            throw new Error(`Invalid timer record in ${this.filePath}`);
        }

        return {
            id: candidate.id,
            chatId: candidate.chatId,
            message: candidate.message,
            dueAt: candidate.dueAt,
            createdAt: candidate.createdAt,
        };
    }

    private async writeAllUnsafe(records: TimerRecord[]): Promise<void>{
        const tempPath = `${this.filePath}.tmp`;
        await fs.writeFile(tempPath, JSON.stringify(records, null, 2), "utf8");
        await fs.rename(tempPath, this.filePath);
    }
}
