"use client";
import React, { useEffect, useState } from "react";
import { RefreshCw } from "lucide-react";
import { Table } from "@rtc-database/shared";
import { getLogs } from "../../ActivityLogs/LogActions";
import LogBadges from "../../ActivityLogs/LogBadges";
import type { CompleteLogData } from "../../ActivityLogs/schema";
import { LogAction } from "@rtc-database/shared/prisma/enums";

function getRelativeTime(timestamp: Date): string {
    const now = new Date();
    const diff = now.getTime() - new Date(timestamp).getTime();
    const seconds = Math.floor(diff / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);
    const weeks = Math.floor(days / 7);

    if (seconds < 60) return "Just now";
    if (minutes === 1) return "1 min ago";
    if (minutes < 60) return `${minutes} mins ago`;
    if (hours === 1) return "1 hour ago";
    if (hours < 24) return `${hours} hours ago`;
    if (days === 1) return "Yesterday";
    if (days < 7) return `${days} days ago`;
    if (weeks === 1) return "1 week ago";
    if (weeks < 4) return `${weeks} weeks ago`;
    return new Date(timestamp).toLocaleDateString();
}

function getUserInitials(name?: string): string {
    if (!name) return "?";
    return name
        .split(" ")
        .map((n) => n[0])
        .join("")
        .toUpperCase()
        .slice(0, 2);
}

const RecentActivities: React.FC = () => {
    const [logs, setLogs] = useState<CompleteLogData[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        getLogs().then((res) => {
            if (res.success && res.result) {
                const sorted = res.result.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
                setLogs(sorted.slice(0, 5));
            }
            setLoading(false);
        });
    }, []);

    return (
        <div className="lg:col-span-2 card surface-card-hover">
            <div
                className="card-body"
                style={{ padding: "var(--space-card-padding)" }}
            >
                <div className="flex justify-between items-center">
                    <h2 className="card-title text-xl sm:text-2xl font-black">
                        Recent Activity
                    </h2>
                    <span className="text-xs text-subtle">Last 5 system logs</span>
                </div>

                <div className="mt-5">
                    {loading ? (
                        <div className="flex justify-center p-4">
                            <RefreshCw className="w-6 h-6 animate-spin text-primary" />
                        </div>
                    ) : logs.length > 0 ? (
                        <div className="overflow-x-auto">
                            <Table
                                headers={[
                                    {
                                        key: "user.name",
                                        label: "User",
                                        className: "text-xs font-semibold uppercase tracking-wider",
                                        align: "center" as const,
                                    },
                                    {
                                        key: "user.role",
                                        label: "Role",
                                        className: "text-xs font-semibold uppercase tracking-wider",
                                        align: "center" as const,
                                    },
                                    {
                                        key: "action",
                                        label: "Action",
                                        className: "text-xs font-semibold uppercase tracking-wider",
                                        align: "center" as const,
                                    },
                                    {
                                        key: "timestamp",
                                        label: "Time",
                                        className: "text-xs font-semibold uppercase tracking-wider",
                                        align: "center" as const,
                                    },
                                ]}
                                data={logs}
                                showPagination={false}
                                className="bg-base-300 rounded-lg shadow"
                                renderRow={(log) => (
                                    <tr
                                        key={log.id}
                                        className="bg-base-100 hover:bg-base-200 transition-colors text-xs"
                                    >
                                        <td className="py-3.5 align-middle text-center">
                                            <div className="flex items-center justify-center gap-2.5">
                                                <div className="w-8 h-8 rounded-full bg-primary/10 text-primary flex items-center justify-center text-xs font-bold shrink-0">
                                                    {getUserInitials(log.user?.name)}
                                                </div>
                                                <span className="font-medium text-sm">
                                                    {log.user?.name || "Unknown"}
                                                </span>
                                            </div>
                                        </td>
                                        <td className="py-3.5 align-middle text-center">
                                            <span className="text-sm text-base-content/60 capitalize">
                                                {log.user?.role || "N/A"}
                                            </span>
                                        </td>
                                        <td className="py-3.5 align-middle text-center">
                                            <div className="flex justify-center">
                                                <LogBadges logAction={log.action as LogAction} />
                                            </div>
                                        </td>
                                        <td className="py-3.5 align-middle text-center">
                                            <div className="flex flex-col items-center">
                                                <span className="text-sm text-base-content/70 font-medium">
                                                    {getRelativeTime(log.timestamp)}
                                                </span>
                                                <span className="text-[10px] text-base-content/40 transition-colors">
                                                    {new Date(log.timestamp).toLocaleString()}
                                                </span>
                                            </div>
                                        </td>
                                    </tr>
                                )}
                            />
                        </div>
                    ) : (
                        <div className="text-center py-8 text-subtle">
                            No recent activities found
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default RecentActivities;
