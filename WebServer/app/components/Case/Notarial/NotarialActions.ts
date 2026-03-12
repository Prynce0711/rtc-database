"use server";

import { validateSession } from "@/app/lib/authActions";
import {
  deleteGarageFile,
  moveGarageFile,
  uploadFileToGarage,
} from "@/app/lib/garageActions";
import { prisma } from "@/app/lib/prisma";
import Roles from "@/app/lib/Roles";
import { prettifyError } from "zod";
import ActionResult from "../../ActionResult";
import { generateFileKey, NotarialData, NotarialSchema } from "./schema";

export async function getNotarial(): Promise<ActionResult<NotarialData[]>> {
  try {
    const sessionResult = await validateSession();
    if (!sessionResult.success) {
      return sessionResult;
    }

    const notarial = await prisma.notarial.findMany({
      include: {
        file: true,
      },
    });

    return { success: true, result: notarial };
  } catch (error) {
    console.error("Error fetching notarial data:", error);
    return { success: false, error: "Error fetching notarial data" };
  }
}

export async function createNotarial(
  data: Record<string, unknown>,
): Promise<ActionResult<NotarialData>> {
  try {
    const sessionResult = await validateSession([Roles.ADMIN, Roles.ATTY]);
    if (!sessionResult.success) {
      return sessionResult;
    }

    const parsedData = NotarialSchema.safeParse(data);
    if (!parsedData.success) {
      return {
        success: false,
        error: "Invalid notarial data: " + prettifyError(parsedData.error),
      };
    }

    const createdNotarial = await prisma.notarial.create({
      data: {
        ...parsedData.data,
        file: undefined,
        fileId: undefined,
      },
    });
    if (parsedData.data.file) {
      try {
        const uploadResult = await uploadFileToGarage(
          parsedData.data.file,
          generateFileKey(parsedData.data),
        );

        if (!uploadResult.success) {
          await prisma.notarial.delete({ where: { id: createdNotarial.id } });
          return {
            success: false,
            error:
              "Notarial created but file upload failed: " + uploadResult.error,
          };
        }

        await prisma.notarial.update({
          where: { id: createdNotarial.id },
          data: {
            fileId: uploadResult.result.id,
          },
        });
      } catch (uploadError) {
        console.error("Error uploading file to garage:", uploadError);

        await prisma.notarial.delete({ where: { id: createdNotarial.id } });

        return {
          success: false,
          error:
            "Notarial created but file upload failed: " +
            (uploadError instanceof Error
              ? uploadError.message
              : "Unknown error"),
        };
      }
    }

    const notarialWithFile = await prisma.notarial.findUnique({
      where: { id: createdNotarial.id },
      include: { file: true },
    });

    if (!notarialWithFile) {
      return {
        success: false,
        error: "Notarial created but failed to retrieve with file data",
      };
    }

    return { success: true, result: notarialWithFile };
  } catch (error) {
    console.error("Error creating notarial data:", error);
    return { success: false, error: "Error creating notarial data" };
  }
}

export async function updateNotarial(
  id: number,
  data: Record<string, unknown>,
): Promise<ActionResult<NotarialData>> {
  try {
    const sessionResult = await validateSession([Roles.ADMIN, Roles.ATTY]);
    if (!sessionResult.success) {
      return sessionResult;
    }

    const existingNotarial = await prisma.notarial.findUnique({
      where: { id },
      include: { file: true },
    });

    if (!existingNotarial) {
      return { success: false, error: "Notarial data not found" };
    }

    const parsedData = NotarialSchema.safeParse(data);
    if (!parsedData.success) {
      return {
        success: false,
        error: "Invalid notarial data: " + prettifyError(parsedData.error),
      };
    }

    const mergedData = {
      title:
        parsedData.data.title !== undefined
          ? parsedData.data.title
          : existingNotarial.title,
      name:
        parsedData.data.name !== undefined
          ? parsedData.data.name
          : existingNotarial.name,
      attorney:
        parsedData.data.attorney !== undefined
          ? parsedData.data.attorney
          : existingNotarial.attorney,
      date:
        parsedData.data.date !== undefined
          ? parsedData.data.date
          : existingNotarial.date,
    };

    const incomingFile = parsedData.data.file;
    const removeFile = parsedData.data.removeFile === true;
    const shouldRemoveFile = removeFile || incomingFile === null;
    const removingOnly = shouldRemoveFile && !incomingFile;

    await prisma.notarial.update({
      where: { id },
      data: {
        ...mergedData,
        fileId: removingOnly ? null : undefined,
      },
    });

    if (removingOnly) {
      if (existingNotarial.file) {
        await deleteGarageFile(existingNotarial.file.key);
      }
    } else if (incomingFile) {
      if (existingNotarial.file) {
        await prisma.notarial.update({
          where: { id },
          data: { fileId: null },
        });
        await deleteGarageFile(existingNotarial.file.key);
      }

      const uploadKey = generateFileKey(mergedData);
      if (!uploadKey) {
        return {
          success: false,
          error: "Notarial updated but generated file key is empty.",
        };
      }

      const updatedFile = await uploadFileToGarage(incomingFile, uploadKey);

      if (!updatedFile.success) {
        return {
          success: false,
          error:
            "Notarial updated but file upload failed: " + updatedFile.error,
        };
      }

      await prisma.notarial.update({
        where: { id },
        data: {
          fileId: updatedFile.result.id,
        },
      });
    } else if (existingNotarial.file) {
      const nextKey = generateFileKey(mergedData);
      if (nextKey && nextKey !== existingNotarial.file.key) {
        await moveGarageFile(existingNotarial.file.key, nextKey);
      }
    }

    const notarialWithFile = await prisma.notarial.findUnique({
      where: { id },
      include: { file: true },
    });

    if (!notarialWithFile) {
      return {
        success: false,
        error: "Notarial updated but failed to retrieve with file data",
      };
    }

    return { success: true, result: notarialWithFile };
  } catch (error) {
    console.error("Error updating notarial data:", error);
    return { success: false, error: "Error updating notarial data" };
  }
}

export async function deleteNotarial(id: number): Promise<ActionResult<void>> {
  try {
    const sessionResult = await validateSession([Roles.ADMIN, Roles.ATTY]);
    if (!sessionResult.success) {
      return sessionResult;
    }

    const notarial = await prisma.notarial.findUnique({
      where: { id },
      include: { file: true },
    });

    if (!notarial) {
      return { success: false, error: "Notarial data not found" };
    }

    if (notarial.file) {
      await deleteGarageFile(notarial.file.key);
    }

    await prisma.notarial.delete({ where: { id } });

    return { success: true, result: undefined };
  } catch (error) {
    console.error("Error deleting notarial data:", error);
    return { success: false, error: "Error deleting notarial data" };
  }
}
