import {CommandDefinition, CommandInitContext, CommandPlugin} from "./types/types.js";

export abstract class BaseCommand implements CommandPlugin{
    abstract readonly definition: CommandDefinition;

    protected initContext?: CommandInitContext;

    init(context: CommandInitContext): Promise<void> | void{
        this.initContext = context;
    }

    dispose(): Promise<void> | void{
    }

    protected get services(){
        if(!this.initContext){
            throw new Error(`Command "${this.definition.name}" accessed services before init().`);
        }

        return this.initContext.services;
    }

    abstract execute(...args: Parameters<CommandPlugin["execute"]>): ReturnType<CommandPlugin["execute"]>;
}
