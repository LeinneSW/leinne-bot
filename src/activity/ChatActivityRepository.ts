import {promises as fs} from "node:fs";
import path from "node:path";
import {DatabaseSync} from "node:sqlite";

import {ChatActivityQuery, ChatActivityRecord} from "./types.js";

export class ChatActivityRepository{
    private database?: DatabaseSync;

    constructor(
        private readonly databasePath: string,
        private readonly legacyJsonPath?: string,
    ){}

    async init(): Promise<void>{
        await fs.mkdir(path.dirname(this.databasePath), {recursive: true});

        this.database = new DatabaseSync(this.databasePath);
        this.database.exec(`
            PRAGMA journal_mode = WAL;
            PRAGMA synchronous = NORMAL;

            CREATE TABLE IF NOT EXISTS chat_activity (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                chat_id INTEGER NOT NULL,
                user_id INTEGER NOT NULL,
                username TEXT,
                display_name TEXT NOT NULL,
                text_length INTEGER NOT NULL,
                created_at INTEGER NOT NULL
            );

            CREATE INDEX IF NOT EXISTS idx_chat_activity_chat_time
                ON chat_activity (chat_id, created_at);

            CREATE INDEX IF NOT EXISTS idx_chat_activity_chat_user_time
                ON chat_activity (chat_id, user_id, created_at);
        `);

        await this.importLegacyJsonIfNeeded();
    }

    close(): void{
        this.database?.close();
        this.database = undefined;
    }

    async getAll(): Promise<ChatActivityRecord[]>{
        const rows = this.getDatabase()
            .prepare(`
                SELECT
                    chat_id,
                    user_id,
                    username,
                    display_name,
                    text_length,
                    created_at
                FROM chat_activity
                ORDER BY created_at ASC
            `)
            .all() as unknown as ChatActivityRow[];

        return rows.map((row) => this.mapRow(row));
    }

    async getByChat(chatId: number, query: ChatActivityQuery = {}): Promise<ChatActivityRecord[]>{
        const conditions = ["chat_id = ?"];
        const parameters: Array<number | string | null> = [chatId];

        if(query.since !== undefined){
            conditions.push("created_at >= ?");
            parameters.push(query.since);
        }

        if(query.until !== undefined){
            conditions.push("created_at < ?");
            parameters.push(query.until);
        }

        const rows = this.getDatabase()
            .prepare(`
                SELECT
                    chat_id,
                    user_id,
                    username,
                    display_name,
                    text_length,
                    created_at
                FROM chat_activity
                WHERE ${conditions.join(" AND ")}
                ORDER BY created_at ASC
            `)
            .all(...parameters) as unknown as ChatActivityRow[];

        return rows.map((row) => this.mapRow(row));
    }

    async append(record: ChatActivityRecord): Promise<void>{
        this.getDatabase()
            .prepare(`
                INSERT INTO chat_activity (
                    chat_id,
                    user_id,
                    username,
                    display_name,
                    text_length,
                    created_at
                ) VALUES (?, ?, ?, ?, ?, ?)
            `)
            .run(
                record.chatId,
                record.userId,
                record.username,
                record.displayName,
                record.textLength,
                record.createdAt,
            );
    }

    private async importLegacyJsonIfNeeded(): Promise<void>{
        if(!this.legacyJsonPath){
            return;
        }

        const database = this.getDatabase();
        const existingCount = database.prepare("SELECT COUNT(*) AS count FROM chat_activity").get() as {count: number};
        if(existingCount.count > 0){
            return;
        }

        try{
            await fs.access(this.legacyJsonPath);
        }catch(error){
            if((error as NodeJS.ErrnoException).code === "ENOENT"){
                return;
            }

            throw error;
        }

        const content = await fs.readFile(this.legacyJsonPath, "utf8");
        const parsed = JSON.parse(content) as unknown;
        if(!Array.isArray(parsed)){
            throw new Error(`Invalid legacy chat activity storage format: ${this.legacyJsonPath}`);
        }

        const records = parsed
            .map((item) => this.normalizeLegacyRecord(item))
            .filter((item): item is ChatActivityRecord => item !== null);

        if(records.length === 0){
            return;
        }

        const insert = database.prepare(`
            INSERT INTO chat_activity (
                chat_id,
                user_id,
                username,
                display_name,
                text_length,
                created_at
            ) VALUES (?, ?, ?, ?, ?, ?)
        `);

        database.exec("BEGIN");

        try{
            for(const record of records){
                insert.run(
                    record.chatId,
                    record.userId,
                    record.username,
                    record.displayName,
                    record.textLength,
                    record.createdAt,
                );
            }
            database.exec("COMMIT");
        }catch(error){
            database.exec("ROLLBACK");
            throw error;
        }

        await this.renameLegacyJsonToBackup();
    }

    private normalizeLegacyRecord(value: unknown): ChatActivityRecord | null{
        if(typeof value !== "object" || value === null){
            console.error(`Invalid legacy chat activity record in ${this.legacyJsonPath}`, value);
            return null;
        }

        const candidate = value as Partial<ChatActivityRecord> & {
            isCommand?: unknown;
            isBot?: unknown;
        };

        if(candidate.isCommand === true || candidate.isBot === true){
            return null;
        }

        if(
            typeof candidate.chatId !== "number"
            || !Number.isFinite(candidate.chatId)
            || typeof candidate.userId !== "number"
            || !Number.isFinite(candidate.userId)
            || (typeof candidate.username !== "string" && candidate.username !== null)
            || typeof candidate.displayName !== "string"
            || typeof candidate.textLength !== "number"
            || !Number.isFinite(candidate.textLength)
            || typeof candidate.createdAt !== "number"
            || !Number.isFinite(candidate.createdAt)
        ){
            console.error(`Invalid legacy chat activity record in ${this.legacyJsonPath}`, value);
            return null;
        }

        return {
            chatId: candidate.chatId,
            userId: candidate.userId,
            username: candidate.username,
            displayName: candidate.displayName,
            textLength: candidate.textLength,
            createdAt: candidate.createdAt,
        };
    }

    private mapRow(row: ChatActivityRow): ChatActivityRecord{
        return {
            chatId: row.chat_id,
            userId: row.user_id,
            username: row.username,
            displayName: row.display_name,
            textLength: row.text_length,
            createdAt: row.created_at,
        };
    }

    private getDatabase(): DatabaseSync{
        if(!this.database){
            throw new Error("Chat activity database is not initialized.");
        }

        return this.database;
    }

    private async renameLegacyJsonToBackup(): Promise<void>{
        if(!this.legacyJsonPath){
            return;
        }

        const backupPath = `${this.legacyJsonPath}.bak`;
        try{
            await fs.rm(backupPath, {force: true});
        }catch(error){
            if((error as NodeJS.ErrnoException).code !== "ENOENT"){
                throw error;
            }
        }

        await fs.rename(this.legacyJsonPath, backupPath);
    }
}

interface ChatActivityRow{
    chat_id: number;
    user_id: number;
    username: string | null;
    display_name: string;
    text_length: number;
    created_at: number;
}
