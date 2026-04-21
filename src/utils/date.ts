export function formatTimestamp(date: Date): string{
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    const hours = String(date.getHours()).padStart(2, "0");
    const minutes = String(date.getMinutes()).padStart(2, "0");
    const seconds = String(date.getSeconds()).padStart(2, "0");

    return `${year}/${month}/${day} ${hours}:${minutes}:${seconds}`;
}

export function formatDuration(totalSeconds: number): string{
    const parts: string[] = [];
    let remainingSeconds = Math.max(0, Math.floor(totalSeconds));

    const days = Math.floor(remainingSeconds / 86400);
    if(days > 0){
        parts.push(`${days}일`);
        remainingSeconds %= 86400;
    }

    const hours = Math.floor(remainingSeconds / 3600);
    if(hours > 0){
        parts.push(`${hours}시간`);
        remainingSeconds %= 3600;
    }

    const minutes = Math.floor(remainingSeconds / 60);
    if(minutes > 0){
        parts.push(`${minutes}분`);
        remainingSeconds %= 60;
    }

    if(remainingSeconds > 0 || parts.length === 0){
        parts.push(`${remainingSeconds}초`);
    }

    return parts.join(" ");
}
