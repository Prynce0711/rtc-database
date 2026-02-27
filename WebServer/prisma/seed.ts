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
    data: { role: "admin" },
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
    data: { role: "atty" },
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
