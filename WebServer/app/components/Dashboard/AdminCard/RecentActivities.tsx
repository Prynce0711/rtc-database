"use client";
import React, { useEffect, useState } from "react";
import { Table } from "@rtc-database/shared";
import { getLogs } from "../../ActivityLogs/LogActions";
import { CompleteLogData } from "../../ActivityLogs/schema";
import LogBadges from "../../ActivityLogs/LogBadges";
import { LogAction } from "@rtc-database/shared/prisma/enums";

function getRelativeTime(timestamp: Date): string {
    const now = new Date();
    const diff = now.getTime() - new Date(timestamp).getTime();
    const seconds = Math.floor(diff / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    if (seconds < 60) return "Just now";
    if (minutes === 1) return "1 min ago";
    if (minutes < 60) return `${minutes} mins ago`;
    if (hours === 1) return "1 hour ago";
    if (hours < 24) return `${hours} hours ago`;
    if (days === 1) return "Yesterday";
    if (days < 7) return `${days} days ago`;
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
        const fetchLogs = async () => {
            const res = await getLogs();
            if (res.success && res.result) {
                const sorted = [...res.result].sort(
                    (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
                );
                setLogs(sorted.slice(0, 5));
            }
            setLoading(false);
        };
        fetchLogs();
    }, []);

    return (
        <div className="lg:col-span-2 card surface-card-hover">
            <div
                className="card-body"
                style={{ padding: "var(--space-card-padding)" }}
            >
                <div className="flex justify-between items-center mb-5">
                    <h2 className="card-title text-xl sm:text-2xl font-black">
                        Recent Activity
                    </h2>
                    <span className="text-xs text-subtle">Last 5 system logs</span>
                </div>

                <div className="overflow-x-auto">
                    <Table
                        headers={[
                            {
                                key: "user",
                                label: "User",
                                className: "text-xs font-semibold uppercase tracking-wider",
                                align: "left",
                            },
                            {
                                key: "action",
                                label: "Action",
                                className: "text-xs font-semibold uppercase tracking-wider",
                                align: "center",
                            },
                            {
                                key: "time",
                                label: "Time",
                                className: "text-xs font-semibold uppercase tracking-wider",
                                align: "right",
                            },
                        ]}
                        data={logs}
                        rowsPerPage={5}
                        showPagination={false}
                        className="bg-base-300 rounded-lg shadow w-full min-w-[400px]"
                        renderRow={(log) => (
                            <tr
                                key={log.id}
                                className="bg-base-100 hover:bg-base-200 transition-colors text-xs"
                            >
                                <td className="py-3.5 px-4 align-middle">
                                    <div className="flex items-center gap-2.5">
                                        <div className="w-8 h-8 rounded-full bg-primary/10 text-primary flex items-center justify-center text-xs font-bold shrink-0">
                                            {getUserInitials(log.user?.name)}
                                        </div>
                                        <div className="flex flex-col">
                                            <span className="font-medium text-sm">
                                                {log.user?.name || "Unknown"}
                                            </span>
                                            <span className="text-[10px] text-base-content/60 capitalize">
                                                {log.user?.role || "N/A"}
                                            </span>
                                        </div>
                                    </div>
                                </td>
                                <td className="py-3.5 px-4 align-middle text-center">
                                    <div className="flex justify-center">
                                        <LogBadges logAction={log.action as LogAction} />
                                    </div>
                                </td>
                                <td className="py-3.5 px-4 align-middle text-right">
                                    <div className="flex flex-col items-end">
                                        <span className="text-sm text-base-content/70 font-medium">
                                            {getRelativeTime(log.timestamp)}
                                        </span>
                                        <span className="text-[10px] text-base-content/40">
                                            {new Date(log.timestamp).toLocaleTimeString([], {
                                                hour: "2-digit",
                                                minute: "2-digit",
                                            })}
                                        </span>
                                    </div>
                                </td>
                            </tr>
                        )}
                    />
                    {loading && (
                        <div className="flex justify-center p-4">
                            <span className="loading loading-spinner loading-md text-primary"></span>
                        </div>
                    )}
                    {!loading && logs.length === 0 && (
                        <div className="text-center p-4 text-sm text-base-content/60">
                            No recent activity found.
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default RecentActivities;
