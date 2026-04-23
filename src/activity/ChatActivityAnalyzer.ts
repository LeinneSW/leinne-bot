import {ActivityOverview, ChatActivityQuery, ChatActivityRecord, DailyActivityStats, UserActivityStats} from "./types.js";

export class ChatActivityAnalyzer{
    filterByDateRange(records: ChatActivityRecord[], query: ChatActivityQuery = {}): ChatActivityRecord[]{
        return records.filter((record) => {
            return !((query.since !== undefined && record.createdAt < query.since) || // 시작점보다 이른 채팅은 제외
                (query.until !== undefined && query.until <= record.createdAt));      // 끝점보다 이후인 채팅은 제외
        });
    }

    buildOverview(records: ChatActivityRecord[], dayCount: number, topLimit = 3): ActivityOverview{
        const userStats = this.buildUserStats(records);
        const totalChatCount = records.length;
        const totalTextLength = records.reduce((sum, record) => sum + record.textLength, 0);
        const safeDayCount = Math.max(dayCount, 1);

        return {
            totalChatCount,
            totalTextLength,
            participantCount: userStats.length,
            averageChatsPerDay: totalChatCount / safeDayCount,
            topUsers: userStats.slice(0, topLimit),
        };
    }

    buildUserStats(records: ChatActivityRecord[]): UserActivityStats[]{
        const totalChatCount = records.length;
        const grouped = new Map<number, ChatActivityRecord[]>();

        for(const record of records){
            const bucket = grouped.get(record.userId);
            if(bucket){
                bucket.push(record);
                continue;
            }

            grouped.set(record.userId, [record]);
        }

        return Array.from(grouped.values())
            .map((userRecords) => this.createUserStats(userRecords, totalChatCount))
            .sort((left, right) => {
                if(right.chatCount !== left.chatCount){
                    return right.chatCount - left.chatCount;
                }

                if(right.totalTextLength !== left.totalTextLength){
                    return right.totalTextLength - left.totalTextLength;
                }

                return left.displayName.localeCompare(right.displayName);
            });
    }

    findUserById(records: ChatActivityRecord[], userId: number): UserActivityStats | null{
        const groupedRecords = records.filter((record) => record.userId === userId);
        if(groupedRecords.length === 0){
            return null;
        }

        return this.createUserStats(groupedRecords, records.length);
    }

    buildDailyStats(records: ChatActivityRecord[], dayCount: number, now = new Date()): DailyActivityStats[]{
        const days = Math.max(dayCount, 1);
        const dayMap = new Map<string, DailyActivityStats>();

        for(let offset = days - 1; offset >= 0; offset -= 1){
            const day = new Date(now);
            day.setHours(0, 0, 0, 0);
            day.setDate(day.getDate() - offset);
            const key = this.toDayKey(day);
            dayMap.set(key, {
                dayKey: key,
                label: `${String(day.getMonth() + 1).padStart(2, "0")}/${String(day.getDate()).padStart(2, "0")}`,
                chatCount: 0,
                totalTextLength: 0,
            });
        }

        for(const record of records){
            const day = new Date(record.createdAt);
            const key = this.toDayKey(day);
            const stats = dayMap.get(key);
            if(!stats){
                continue;
            }

            stats.chatCount += 1;
            stats.totalTextLength += record.textLength;
        }

        return Array.from(dayMap.values());
    }

    private createUserStats(records: ChatActivityRecord[], totalChatCount: number): UserActivityStats{
        const sortedLengths = records
            .map((record) => record.textLength)
            .sort((left, right) => left - right);
        const totalTextLength = sortedLengths.reduce((sum, value) => sum + value, 0);
        const latestRecord = records.reduce((latest, record) => {
            if(record.createdAt >= latest.createdAt){
                return record;
            }
            return latest;
        }, records[0]);

        return {
            userId: latestRecord.userId,
            username: latestRecord.username,
            displayName: latestRecord.displayName,
            chatCount: records.length,
            share: totalChatCount === 0 ? 0 : (records.length / totalChatCount) * 100,
            totalTextLength,
            averageTextLength: this.calculateTrimmedMean(sortedLengths),
        };
    }

    private calculateTrimmedMean(sortedValues: number[]): number{
        if(sortedValues.length === 0){
            return 0;
        }

        const trimSize = sortedValues.length >= 10 ? Math.floor(sortedValues.length * 0.1) : 0;
        const trimmedValues = sortedValues.slice(trimSize, sortedValues.length - trimSize);
        const values = trimmedValues.length > 0 ? trimmedValues : sortedValues;
        const total = values.reduce((sum, value) => sum + value, 0);
        return total / values.length;
    }

    private toDayKey(date: Date): string{
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, "0");
        const day = String(date.getDate()).padStart(2, "0");
        return `${year}-${month}-${day}`;
    }
}
