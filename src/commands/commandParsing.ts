interface CommandEntityLike{
    type: string;
    offset: number;
    length: number;
}

export function getLeadingCommandSegment(text: string, entities?: CommandEntityLike[]): string | null{
    const entity = entities?.find((item) => item.type === "bot_command" && item.offset === 0);
    if(entity){
        return text.slice(0, entity.length);
    }

    if(!text.startsWith("/")){
        return null;
    }

    const firstWhitespaceIndex = text.search(/\s/);
    if(firstWhitespaceIndex === -1){
        return text;
    }

    return text.slice(0, firstWhitespaceIndex);
}
