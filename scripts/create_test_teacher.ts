import { prisma } from "../src/lib/prisma";

async function main() {
  try {
    // Find any existing school
    const school = await prisma.school.findFirst();
    
    if (!school) {
      console.log("No school found in the database. Please seed the DB first.");
      return;
    }

    const email = "teacher@school360.com";
    const phone = "9800000000";
    
    // Upsert the teacher user
    const teacher = await prisma.user.upsert({
      where: { email },
      update: {},
      create: {
        fullName: "Test Teacher",
        email: email,
        phone: phone,
        password: "password123", // The login API supports plaintext fallback for testing
        role: "TEACHER",
        schoolId: school.id,
      }
    });

    console.log("Teacher created successfully!");
    console.log("--------------------------------------------------");
    console.log("Login Credentials:");
    console.log(`Email:    ${email}`);
    console.log(`Phone:    ${phone}`);
    console.log(`Password: password123`);
    console.log("--------------------------------------------------");
    console.log(`Assigned School: ${school.name}`);
    
  } catch (error) {
    console.error("Error creating teacher:", error);
  } finally {
    await prisma.$disconnect();
  }
}

main();
