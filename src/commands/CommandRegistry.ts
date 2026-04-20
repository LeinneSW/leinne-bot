import {CommandCatalog, CommandPlugin, CommandSummary} from "./types/types.js";

export interface RegisteredCommand{
    name: string;
    description: string;
    aliases: string[];
    plugin: CommandPlugin;
}

export class CommandRegistry implements CommandCatalog{
    private readonly commands = new Map<string, RegisteredCommand>();
    private readonly aliases = new Map<string, string>();

    register(plugin: CommandPlugin): void{
        const name = this.normalizeToken(plugin.definition.name);
        const description = plugin.definition.description.trim();

        if(!name){
            throw new Error("Command name is required.");
        }

        if(!description){
            throw new Error(`Command "${plugin.definition.name}" must have a description.`);
        }

        this.assertAvailable(name);

        const aliases = Array.from(
            new Set(
                (plugin.definition.aliases ?? [])
                    .map((alias) => this.normalizeToken(alias))
                    .filter((alias) => alias.length > 0 && alias !== name),
            ),
        );

        for(const alias of aliases){
            this.assertAvailable(alias);
        }

        const registeredCommand: RegisteredCommand = {
            name,
            description,
            aliases,
            plugin,
        };

        this.commands.set(name, registeredCommand);

        for(const alias of aliases){
            this.aliases.set(alias, name);
        }
    }

    resolve(token: string): RegisteredCommand | null{
        const normalizedToken = this.normalizeToken(token);
        const name = this.aliases.get(normalizedToken) ?? normalizedToken;

        return this.commands.get(name) ?? null;
    }

    list(): CommandSummary[]{
        return Array.from(this.commands.values())
            .sort((left, right) => left.name.localeCompare(right.name))
            .map((command) => ({
                name: command.name,
                description: command.description,
                aliases: [...command.aliases],
            }));
    }

    toTelegramCommands(): Array<{command: string; description: string}>{
        return this.list().map((command) => ({
            command: command.name,
            description: command.description,
        }));
    }

    private assertAvailable(token: string): void{
        if(this.commands.has(token)){
            throw new Error(`Command token "${token}" is already registered as a command name.`);
        }

        if(this.aliases.has(token)){
            throw new Error(`Command token "${token}" is already registered as an alias.`);
        }
    }

    private normalizeToken(token: string): string{
        return token.trim().replace(/^\//, "").toLowerCase();
    }
}
