"use client";

import type { NotarialFormEntry } from "@/app/components/Case/Notarial/Notarial";
import {
  createNotarial,
  deleteNotarial,
} from "@/app/components/Case/Notarial/NotarialActions";
import NotarialEdit from "@/app/components/Case/Notarial/NotarialEdit";
import { useSession } from "@/app/lib/authClient";
import Roles from "@/app/lib/Roles";
import { RedirectingUI } from "@rtc-database/shared";
import { redirect, useRouter } from "next/navigation";

const NotarialAddPage = () => {
  const router = useRouter();
  const session = useSession();

  if (session.isPending) {
    return <RedirectingUI titleText="Loading notarial access..." />;
  }

  const role = session.data?.user?.role;

  if (!role) {
    redirect("/");
  }

  if (role !== Roles.ADMIN && role !== Roles.NOTARIAL) {
    redirect("/user/dashboard");
  }

  return (
    <NotarialEdit
      type="ADD"
      onCreate={async (entries: NotarialFormEntry[]) => {
        const createdIds: number[] = [];

        const rollbackCreated = async () => {
          if (createdIds.length === 0) return;
          await Promise.allSettled(createdIds.map((id) => deleteNotarial(id)));
        };

        for (const entry of entries) {
          const payload: Record<string, unknown> = {
            title: entry.title || null,
            name: entry.name || null,
            attorney: entry.atty || null,
            date: entry.date ? new Date(entry.date) : null,
            path: undefined,
            removeFile: undefined,
            file: entry.file ?? undefined,
          };

          const result = await createNotarial(payload);
          if (!result.success) {
            await rollbackCreated();
            const message = "error" in result ? result.error : undefined;
            return message || "Failed to create notarial entry.";
          }

          if (!result.result) {
            await rollbackCreated();
            return "Failed to create notarial entry.";
          }

          createdIds.push(result.result.id);
        }

        return null;
      }}
      onClose={() => router.push("/user/cases/notarial")}
    />
  );
};

export default NotarialAddPage;
