import {promises as fs} from "node:fs";
import path from "node:path";
import {pathToFileURL} from "node:url";

import {BaseCommand} from "./BaseCommand.js";
import {CommandPlugin, CommandPluginClass} from "./types/types.js";

export class CommandLoader{
    constructor(private readonly commandsDirectory: string){}

    async loadAll(): Promise<CommandPlugin[]>{
        const files = await this.collectCommandFiles(this.commandsDirectory);
        const commands: CommandPlugin[] = [];

        for(const file of files.sort((left, right) => left.localeCompare(right))){
            commands.push(await this.loadFile(file));
        }

        return commands;
    }

    private async collectCommandFiles(directory: string): Promise<string[]>{
        try{
            const entries = await fs.readdir(directory, {withFileTypes: true});
            const files: string[] = [];

            for(const entry of entries){
                const entryPath = path.join(directory, entry.name);

                if(entry.isDirectory()){
                    files.push(...(await this.collectCommandFiles(entryPath)));
                    continue;
                }

                if(entry.isFile() && this.shouldLoadFile(entry.name)){
                    files.push(entryPath);
                }
            }

            return files;
        }catch(error){
            if((error as NodeJS.ErrnoException).code === "ENOENT"){
                return [];
            }

            throw error;
        }
    }

    private shouldLoadFile(fileName: string): boolean{
        if(fileName.startsWith("_") || fileName.startsWith(".")){
            return false;
        }

        if(fileName.endsWith(".d.ts")){
            return false;
        }

        return /\.(cjs|cts|js|mjs|mts|ts)$/i.test(fileName);
    }

    private async loadFile(filePath: string): Promise<CommandPlugin>{
        const importedModule = await import(pathToFileURL(filePath).href);
        const exportedValue = this.unwrapModule(importedModule);
        const commandModule = this.normalizeModule(exportedValue, filePath);

        return new commandModule();
    }

    private unwrapModule(importedModule: unknown): unknown{
        if(this.isRecord(importedModule) && "default" in importedModule){
            return importedModule.default;
        }

        return importedModule;
    }

    private normalizeModule(candidate: unknown, filePath: string): CommandPluginClass{
        if(this.isClassExport(candidate)){
            return candidate;
        }

        throw new Error(`Invalid command module at "${filePath}". Export a class extending BaseCommand.`);
    }

    private isClassExport(value: unknown): value is CommandPluginClass{
        if(typeof value !== "function"){
            return false;
        }

        return value.prototype instanceof BaseCommand;
    }

    private isRecord(value: unknown): value is Record<string, unknown>{
        return typeof value === "object" && value !== null;
    }
}
