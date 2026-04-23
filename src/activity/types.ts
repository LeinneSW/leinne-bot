export interface ChatActivityRecord{
    chatId: number;
    userId: number;
    username: string | null;
    displayName: string;
    textLength: number;
    createdAt: number;
}

export interface ChatActivityQuery{
    since?: number;
    until?: number;
}

export interface UserActivityStats{
    userId: number;
    username: string | null;
    displayName: string;
    chatCount: number;
    share: number;
    totalTextLength: number;
    averageTextLength: number;
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
