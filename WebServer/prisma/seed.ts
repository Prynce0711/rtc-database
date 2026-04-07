import { Status } from "@/app/generated/prisma/enums";
import { auth } from "@/app/lib/auth";
import { prisma } from "@/app/lib/prisma";

// #TODO: disable signup route after seeding

async function main() {
  // Create admin user
  try {
    const adminResult = await auth.api.signUpEmail({
      body: {
        email: "admin@admin.com",
        password: "admin12345",
        name: "Admin",
      },
    });

    if (adminResult) {
      console.log("Created admin user successfully");
    }
  } catch (error: any) {
    console.error(`Failed to create admin user: ${error.message}`);
  }

  await prisma.user.update({
    where: { email: "admin@admin.com" },
    data: { role: "admin", status: Status.ACTIVE },
  });

  // Create atty user
  try {
    const attyResult = await auth.api.signUpEmail({
      body: {
        email: "atty@atty.com",
        password: "atty12345",
        name: "Attorney",
      },
    });

    if (attyResult) {
      console.log("Created attorney user successfully");
    }
  } catch (error: any) {
    console.error(`Failed to create attorney user: ${error.message}`);
  }

  await prisma.user.update({
    where: { email: "atty@atty.com" },
    data: { role: "atty", status: Status.ACTIVE },
  });

  // Create Statistics Account
  try {
    const statsResult = await auth.api.signUpEmail({
      body: {
        email: "stats@stats.com",
        password: "stats12345",
        name: "Statistics",
      },
    });

    if (statsResult) {
      console.log("Created statistics user successfully");
    }
  } catch (error: any) {
    console.error(`Failed to create statistics user: ${error.message}`);
  }

  await prisma.user.update({
    where: { email: "stats@stats.com" },
    data: { role: "statistics", status: Status.ACTIVE },
  });

  // Create Notarial Account
  try {
    const notarialResult = await auth.api.signUpEmail({
      body: {
        email: "notarial@notarial.com",
        password: "notarial12345",
        name: "Notarial",
      },
    });

    if (notarialResult) {
      console.log("Created notarial user successfully");
    }
  } catch (error: any) {
    console.error(`Failed to create notarial user: ${error.message}`);
  }

  await prisma.user.update({
    where: { email: "notarial@notarial.com" },
    data: { role: "notarial", status: Status.ACTIVE },
  });

  // Create Archive Account
  try {
    const archiveResult = await auth.api.signUpEmail({
      body: {
        email: "archive@archive.com",
        password: "archive12345",
        name: "Archive",
      },
    });

    if (archiveResult) {
      console.log("Created archive user successfully");
    }
  } catch (error: any) {
    console.error(`Failed to create archive user: ${error.message}`);
  }

  await prisma.user.update({
    where: { email: "archive@archive.com" },
    data: { role: "archive", status: Status.ACTIVE },
  });

  // Create staff user
  try {
    const staffResult = await auth.api.signUpEmail({
      body: {
        email: "staff@staff.com",
        password: "staff12345",
        name: "Staff",
      },
    });

    await prisma.user.update({
      where: { email: "staff@staff.com" },
      data: { status: Status.ACTIVE },
    });

    if (staffResult) {
      console.log("Created staff user successfully");
    }
  } catch (error: any) {
    console.error(`Failed to create staff user: ${error.message}`);
  }

  console.log("Seeding completed!");
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
