import path from "path";
import { prisma } from "../WebServer/app/lib/prisma";

async function main() {
  try {
    const rows = await prisma.monthlyStatistics.findMany({ select: { month: true }, orderBy: [{ month: 'desc' }] });
    const years = Array.from(new Set(rows.map(r => String(r.month).slice(0,4))))
      .filter(Boolean)
      .sort((a,b)=>Number(b)-Number(a));
    console.log('found months:', rows.length);
    console.log('years:', years);
  } catch (err) {
    console.error('error querying monthly years', err);
  } finally {
    await prisma.$disconnect();
  }
}

main();
