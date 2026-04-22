export interface ChatActivityRecord{
    chatId: number;
    messageId: number;
    userId: number;
    username: string | null;
    displayName: string;
    textLength: number;
    messageType: "text";
    isCommand: boolean;
    isBot: boolean;
    createdAt: number;
}

export interface ChatActivityQuery{
    since?: number;
    until?: number;
    includeCommands?: boolean;
    includeBots?: boolean;
}

export interface UserActivityStats{
    userId: number;
    username: string | null;
    displayName: string;
    chatCount: number;
    share: number;
    totalTextLength: number;
    averageTextLength: number;
    medianTextLength: number;
    lastMessageAt: number;
    activeDayCount: number;
}

export interface ActivityOverview{
    totalChatCount: number;
    totalTextLength: number;
    participantCount: number;
    averageChatsPerDay: number;
    topUsers: UserActivityStats[];
}

export interface DailyActivityStats{
    dayKey: string;
    label: string;
    chatCount: number;
    totalTextLength: number;
}
