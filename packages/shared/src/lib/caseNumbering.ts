import {
  CaseType,
  Prisma,
  TransmittalSection,
} from "../generated/prisma/client";

type ParsedCaseNumber = {
  area: string;
  number: number;
  year: number;
  tail: string;
  inputOrder: "area-first" | "number-first";
};

type ParsedSheriffCaseNumber = {
  number: number;
  year: number;
  tail: string;
};

const AREA_FIRST_PATTERN = /^\s*([A-Za-z]+)-(\d+)-(\d{4})(.*)$/;
const NUMBER_FIRST_PATTERN = /^\s*(\d+)-([A-Za-z]+)-(\d{4})(.*)$/;
const SHERIFF_PATTERN = /^\s*(\d+)-(\d{4})(.*)$/;

export const parseCaseNumber = (input: string): ParsedCaseNumber | null => {
  const trimmed = input.trim();
  if (!trimmed) return null;

  const areaFirst = trimmed.match(AREA_FIRST_PATTERN);
  if (areaFirst) {
    const number = Number.parseInt(areaFirst[2], 10);
    const year = Number.parseInt(areaFirst[3], 10);
    if (Number.isNaN(number) || Number.isNaN(year)) return null;

    return {
      area: areaFirst[1].toUpperCase(),
      number,
      year,
      tail: areaFirst[4].trim(),
      inputOrder: "area-first",
    };
  }

  const numberFirst = trimmed.match(NUMBER_FIRST_PATTERN);
  if (numberFirst) {
    const number = Number.parseInt(numberFirst[1], 10);
    const year = Number.parseInt(numberFirst[3], 10);
    if (Number.isNaN(number) || Number.isNaN(year)) return null;

    return {
      area: numberFirst[2].toUpperCase(),
      number,
      year,
      tail: numberFirst[4].trim(),
      inputOrder: "number-first",
    };
  }

  return null;
};

export const parseSheriffCaseNumber = (
  input: string,
): ParsedSheriffCaseNumber | null => {
  const trimmed = input.trim();
  if (!trimmed) return null;

  const match = trimmed.match(SHERIFF_PATTERN);
  if (match) {
    const number = Number.parseInt(match[1], 10);
    const year = Number.parseInt(match[2], 10);
    if (Number.isNaN(number) || Number.isNaN(year)) return null;

    return {
      number,
      year,
      tail: match[3].trim(),
    };
  }

  return null;
};

export const formatAutoCaseNumber = (
  area: string,
  number: number,
  year: number,
): string => {
  return `${String(number).padStart(2, "0")}-${area.toUpperCase()}-${year}`;
};

export const formatSheriffCaseNumber = (
  number: number,
  year: number,
): string => {
  return `${String(number).padStart(2, "0")}-${year}`;
};

export const getNextCaseNumber = async (
  tx: Prisma.TransactionClient,
  caseType: CaseType,
  area: string,
  year: number,
): Promise<{
  number: number;
  caseNumber: string;
  area: string;
  year: number;
}> => {
  const normalizedArea = area.toUpperCase();

  const counter = await tx.caseCounter.upsert({
    where: {
      caseType_area_year: {
        caseType,
        area: normalizedArea,
        year,
      },
    },
    update: {
      last: { increment: 1 },
    },
    create: {
      caseType,
      area: normalizedArea,
      year,
      last: 1,
    },
  });

  return {
    number: counter.last,
    caseNumber: formatAutoCaseNumber(normalizedArea, counter.last, year),
    area: normalizedArea,
    year,
  };
};

export const getNextSheriffCaseNumber = async (
  tx: Prisma.TransactionClient,
  year: number,
): Promise<{
  number: number;
  caseNumber: string;
  year: number;
}> => {
  const counter = await tx.caseCounter.upsert({
    where: {
      caseType_area_year: {
        caseType: CaseType.SHERRIFF,
        area: "",
        year,
      },
    },
    update: {
      last: { increment: 1 },
    },
    create: {
      caseType: CaseType.SHERRIFF,
      area: "",
      year,
      last: 1,
    },
  });

  return {
    number: counter.last,
    caseNumber: formatSheriffCaseNumber(counter.last, year),
    year,
  };
};

export const syncCaseCounterToAtLeast = async (
  tx: Prisma.TransactionClient,
  caseType: CaseType,
  area: string,
  year: number,
  candidateNumber: number,
): Promise<void> => {
  if (!Number.isFinite(candidateNumber) || candidateNumber <= 0) return;

  const normalizedArea = area.toUpperCase();
  const existing = await tx.caseCounter.findUnique({
    where: {
      caseType_area_year: {
        caseType,
        area: normalizedArea,
        year,
      },
    },
  });

  if (!existing) {
    await tx.caseCounter.create({
      data: {
        caseType,
        area: normalizedArea,
        year,
        last: candidateNumber,
      },
    });
    return;
  }

  if (candidateNumber > existing.last) {
    await tx.caseCounter.update({
      where: {
        caseType_area_year: {
          caseType,
          area: normalizedArea,
          year,
        },
      },
      data: {
        last: candidateNumber,
      },
    });
  }
};

export const syncSheriffCaseCounterToAtLeast = async (
  tx: Prisma.TransactionClient,
  year: number,
  candidateNumber: number,
): Promise<void> => {
  if (!Number.isFinite(candidateNumber) || candidateNumber <= 0) return;

  const existing = await tx.caseCounter.findUnique({
    where: {
      caseType_area_year: {
        caseType: CaseType.SHERRIFF,
        area: "",
        year,
      },
    },
  });

  if (!existing) {
    await tx.caseCounter.create({
      data: {
        caseType: CaseType.SHERRIFF,
        area: "",
        year,
        last: candidateNumber,
      },
    });
    return;
  }

  if (candidateNumber > existing.last) {
    await tx.caseCounter.update({
      where: {
        caseType_area_year: {
          caseType: CaseType.SHERRIFF,
          area: "",
          year,
        },
      },
      data: {
        last: candidateNumber,
      },
    });
  }
};

export const getNextTransmittalCaseNumber = async (
  tx: Prisma.TransactionClient,
  section: TransmittalSection,
  area: string,
  year: number,
): Promise<{
  number: number;
  caseNumber: string;
  area: string;
  year: number;
}> => {
  const normalizedArea = area.toUpperCase();

  const counter = await tx.transmittalCaseCounter.upsert({
    where: {
      section_area_year: {
        section,
        area: normalizedArea,
        year,
      },
    },
    update: {
      last: { increment: 1 },
    },
    create: {
      section,
      area: normalizedArea,
      year,
      last: 1,
    },
  });

  return {
    number: counter.last,
    caseNumber: formatAutoCaseNumber(normalizedArea, counter.last, year),
    area: normalizedArea,
    year,
  };
};

export const getNextSheriffTransmittalCaseNumber = async (
  tx: Prisma.TransactionClient,
  year: number,
): Promise<{
  number: number;
  caseNumber: string;
  year: number;
}> => {
  const counter = await tx.transmittalCaseCounter.upsert({
    where: {
      section_area_year: {
        section: TransmittalSection.SHERIFF,
        area: "",
        year,
      },
    },
    update: {
      last: { increment: 1 },
    },
    create: {
      section: TransmittalSection.SHERIFF,
      area: "",
      year,
      last: 1,
    },
  });

  return {
    number: counter.last,
    caseNumber: formatSheriffCaseNumber(counter.last, year),
    year,
  };
};

export const syncTransmittalCaseCounterToAtLeast = async (
  tx: Prisma.TransactionClient,
  section: TransmittalSection,
  area: string,
  year: number,
  candidateNumber: number,
): Promise<void> => {
  if (!Number.isFinite(candidateNumber) || candidateNumber <= 0) return;

  const normalizedArea = area.toUpperCase();
  const existing = await tx.transmittalCaseCounter.findUnique({
    where: {
      section_area_year: {
        section,
        area: normalizedArea,
        year,
      },
    },
  });

  if (!existing) {
    await tx.transmittalCaseCounter.create({
      data: {
        section,
        area: normalizedArea,
        year,
        last: candidateNumber,
      },
    });
    return;
  }

  if (candidateNumber > existing.last) {
    await tx.transmittalCaseCounter.update({
      where: {
        section_area_year: {
          section,
          area: normalizedArea,
          year,
        },
      },
      data: {
        last: candidateNumber,
      },
    });
  }
};

export const syncSheriffTransmittalCaseCounterToAtLeast = async (
  tx: Prisma.TransactionClient,
  year: number,
  candidateNumber: number,
): Promise<void> => {
  if (!Number.isFinite(candidateNumber) || candidateNumber <= 0) return;

  const existing = await tx.transmittalCaseCounter.findUnique({
    where: {
      section_area_year: {
        section: TransmittalSection.SHERIFF,
        area: "",
        year,
      },
    },
  });

  if (!existing) {
    await tx.transmittalCaseCounter.create({
      data: {
        section: TransmittalSection.SHERIFF,
        area: "",
        year,
        last: candidateNumber,
      },
    });
    return;
  }

  if (candidateNumber > existing.last) {
    await tx.transmittalCaseCounter.update({
      where: {
        section_area_year: {
          section: TransmittalSection.SHERIFF,
          area: "",
          year,
        },
      },
      data: {
        last: candidateNumber,
      },
    });
  }
};
