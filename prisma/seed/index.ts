import { prismaClient } from "../../src/lib/prismaClient";
import { seedPermissions } from "./seedPermissions";
import { seedPricing } from "./seedPricing";

const prisma = prismaClient;

async function main() {
  console.log("🌱 Starting database seeding...\n");

  try {
    // Run all seed functions in order
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    await seedPermissions();
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");

    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    await seedPricing();
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");

    // Add more seed functions here as needed
    // await seedOtherData();

    console.log("✅ All seeds completed successfully!");
  } catch (error) {
    console.error("❌ Seeding failed:", error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();
