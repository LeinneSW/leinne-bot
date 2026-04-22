import {Bot, Context} from "grammy";
import type {ChatActivityAnalyzer} from "../../activity/ChatActivityAnalyzer.js";
import type {ChatActivityRepository} from "../../activity/ChatActivityRepository.js";

export interface CommandDefinition{
    name: string;
    description: string;
    aliases?: string[];
}

export interface CommandSummary{
    name: string;
    description: string;
    aliases: string[];
}

export interface CommandCatalog{
    list(): CommandSummary[];
}

export interface CommandServices{
    registry: CommandCatalog;
    bot: Bot;
    activity: {
        repository: ChatActivityRepository;
        analyzer: ChatActivityAnalyzer;
    };
}

export interface CommandExecutionRequest{
    commandName: string;
    aliasUsed: string;
    args: string[];
    rawArgs: string;
    services: CommandServices;
}

export interface CommandInitContext{
    services: CommandServices;
    commandsDirectory: string;
}

export interface CommandPlugin{
    readonly definition: CommandDefinition;
    init?(context: CommandInitContext): Promise<void> | void;
    dispose?(): Promise<void> | void;
    execute(ctx: Context, request: CommandExecutionRequest): Promise<void> | void;
}

export interface CommandPluginClass{
    new (): CommandPlugin;
}
