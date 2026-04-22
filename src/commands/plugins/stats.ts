import {Context} from "grammy";

import {BaseCommand} from "../BaseCommand.js";
import {CommandExecutionRequest} from "../types/types.js";
import {formatTimestamp} from "../../utils/date.js";
import {ActivityOverview, ChatActivityQuery, ChatActivityRecord, DailyActivityStats, UserActivityStats} from "../../activity/types.js";

type PeriodPreset = "today" | "7d" | "30d";

interface PeriodSelection{
    since: number;
    until: number;
    label: string;
    dayCount: number;
}

//noinspection JSUnusedGlobalSymbols
export default class StatsCommand extends BaseCommand{
    readonly definition = {
        name: "stats",
        description: "/stats [users|me|today|7d|30d|daily|user] => 채팅 통계 조회",
    };

    async execute(ctx: Context, request: CommandExecutionRequest){
        const chat = ctx.chat;
        const from = ctx.from;
        if(!chat || !from){
            return;
        }

        const records = await this.services.activity.repository.getByChat(chat.id, {
            includeCommands: true,
            includeBots: true,
        });
        const args = request.args.map((arg) => arg.toLowerCase());
        const subcommand = args[0] ?? "";
        const chatOptions = {reply_parameters: {message_id: ctx.msg!.message_id}};

        if(subcommand === "" || this.isPeriodToken(subcommand)){
            const period = this.resolvePeriod(subcommand || "7d");
            await ctx.reply(this.renderOverview(period, this.getFilteredOverview(records, period)), chatOptions);
            return;
        }

        if(subcommand === "users"){
            const period = this.resolvePeriod(args[1] ?? "7d");
            await ctx.reply(this.renderUserRanking(period, this.getFilteredUserStats(records, period)), chatOptions);
            return;
        }

        if(subcommand === "me"){
            const period = this.resolvePeriod(args[1] ?? "7d");
            const filteredRecords = this.getFilteredRecords(records, period);
            const userStats = this.services.activity.analyzer.findUserById(filteredRecords, from.id);
            await ctx.reply(this.renderUserDetail(period, userStats, "내 통계"), chatOptions);
            return;
        }

        if(subcommand === "user"){
            const target = request.args[1];
            if(!target){
                await ctx.reply("사용법: /stats user @nickname", chatOptions);
                return;
            }

            const period = this.resolvePeriod(args[2] ?? "7d");
            const filteredRecords = this.getFilteredRecords(records, period);
            const userStats = this.services.activity.analyzer.findUserByName(filteredRecords, target);
            await ctx.reply(this.renderUserDetail(period, userStats, `${target} 통계`), chatOptions);
            return;
        }

        if(subcommand === "daily"){
            const period = this.resolvePeriod(args[1] ?? "7d");
            const filteredRecords = this.getFilteredRecords(records, period);
            const dailyStats = this.services.activity.analyzer.buildDailyStats(filteredRecords, period.dayCount);
            await ctx.reply(this.renderDailyStats(period, dailyStats), chatOptions);
            return;
        }

        await ctx.reply(
            [
                "사용법:",
                "/stats",
                "/stats users",
                "/stats me",
                "/stats today",
                "/stats 7d",
                "/stats 30d",
                "/stats daily",
                "/stats user @nickname",
            ].join("\n"),
            chatOptions,
        );
    }

    private getFilteredOverview(records: ChatActivityRecord[], period: PeriodSelection): ActivityOverview{
        return this.services.activity.analyzer.buildOverview(this.getFilteredRecords(records, period), period.dayCount);
    }

    private getFilteredUserStats(records: ChatActivityRecord[], period: PeriodSelection): UserActivityStats[]{
        return this.services.activity.analyzer.buildUserStats(this.getFilteredRecords(records, period));
    }

    private getFilteredRecords(records: ChatActivityRecord[], period: PeriodSelection): ChatActivityRecord[]{
        const query: ChatActivityQuery = {
            since: period.since,
            until: period.until,
        };

        return this.services.activity.analyzer.filter(records, query);
    }

    private renderOverview(period: PeriodSelection, overview: ActivityOverview): string{
        const lines = [
            `[${period.label} 채팅 요약]`,
            `총 채팅 수: ${this.formatCount(overview.totalChatCount)}`,
            `총 채팅 길이: ${this.formatCount(overview.totalTextLength)}자`,
            `참여자: ${this.formatCount(overview.participantCount)}명`,
            `일평균 채팅 수: ${overview.averageChatsPerDay.toFixed(1)}개`,
        ];

        if(overview.topUsers.length === 0){
            lines.push("집계할 채팅이 없습니다.");
            return lines.join("\n");
        }

        for(const [index, user] of overview.topUsers.entries()){
            lines.push(`${index + 1}위 ${this.formatUserLabel(user)} ${this.formatCount(user.chatCount)}개 (${this.formatPercent(user.share)})`);
        }

        return lines.join("\n");
    }

    private renderUserRanking(period: PeriodSelection, userStats: UserActivityStats[]): string{
        const lines = [`[${period.label} 유저별 채팅 순위]`];

        if(userStats.length === 0){
            lines.push("집계할 채팅이 없습니다.");
            return lines.join("\n");
        }

        for(const [index, user] of userStats.slice(0, 10).entries()){
            lines.push(
                `${index + 1}. ${this.formatUserLabel(user)} - ${this.formatCount(user.chatCount)}개 (${this.formatPercent(user.share)}), 총 ${this.formatCount(user.totalTextLength)}자, 평균 ${user.averageTextLength.toFixed(1)}자`,
            );
        }

        return lines.join("\n");
    }

    private renderUserDetail(period: PeriodSelection, userStats: UserActivityStats | null, title: string): string{
        const lines = [`[${title} - ${period.label}]`];
        if(!userStats){
            lines.push("집계할 채팅이 없습니다.");
            return lines.join("\n");
        }

        lines.push(`대상: ${this.formatUserLabel(userStats)}`);
        lines.push(`채팅 수: ${this.formatCount(userStats.chatCount)}개`);
        lines.push(`채팅 비율: ${this.formatPercent(userStats.share)}`);
        lines.push(`총 길이: ${this.formatCount(userStats.totalTextLength)}자`);
        lines.push(`평균 길이: ${userStats.averageTextLength.toFixed(1)}자`);
        lines.push(`중앙값 길이: ${userStats.medianTextLength.toFixed(1)}자`);
        lines.push(`활동 일수: ${this.formatCount(userStats.activeDayCount)}일`);
        lines.push(`최근 활동: ${formatTimestamp(new Date(userStats.lastMessageAt))}`);
        return lines.join("\n");
    }

    private renderDailyStats(period: PeriodSelection, dailyStats: DailyActivityStats[]): string{
        const lines = [`[${period.label} 일별 채팅]`];
        for(const stats of dailyStats){
            lines.push(`${stats.label} ${this.formatCount(stats.chatCount)}개 / ${this.formatCount(stats.totalTextLength)}자`);
        }

        return lines.join("\n");
    }

    private resolvePeriod(token: string): PeriodSelection{
        const now = new Date();
        const end = Date.now();
        const normalizedToken = token.toLowerCase();

        if(normalizedToken === "today"){
            const start = new Date(now);
            start.setHours(0, 0, 0, 0);
            return {
                since: start.getTime(),
                until: end,
                label: "오늘",
                dayCount: 1,
            };
        }

        if(normalizedToken === "30d"){
            const start = new Date(now);
            start.setHours(0, 0, 0, 0);
            start.setDate(start.getDate() - 29);
            return {
                since: start.getTime(),
                until: end,
                label: "최근 30일",
                dayCount: 30,
            };
        }

        const start = new Date(now);
        start.setHours(0, 0, 0, 0);
        start.setDate(start.getDate() - 6);
        return {
            since: start.getTime(),
            until: end,
            label: "최근 7일",
            dayCount: 7,
        };
    }

    private isPeriodToken(token: string): token is PeriodPreset{
        return token === "today" || token === "7d" || token === "30d";
    }

    private formatUserLabel(user: UserActivityStats): string{
        return user.username ? `@${user.username}` : user.displayName;
    }

    private formatPercent(value: number): string{
        return `${value.toFixed(1)}%`;
    }

    private formatCount(value: number): string{
        return value.toLocaleString("ko-KR");
    }
}
