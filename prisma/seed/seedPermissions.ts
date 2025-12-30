import { prismaClient } from "../../src/lib/prismaClient";

const prisma = prismaClient;

async function seedRolesModulesPermissions() {
  console.log("Seeding roles, modules, and permissions...");

  const roles = ["admin", "moderator", "user"];
  for (const roleName of roles) {
    await prisma.role.upsert({
      where: { name: roleName },
      update: {},
      create: { name: roleName },
    });
  }

  const modules = [
    "Dashboard",
    "Projects",
    "Keyword_research",
    "Domain_Metrics",
    "Serp_analyzer",
    "Opportunity_finder",
    "Billing",
    "Admin_panel",
    "User_management",
  ];
  for (const moduleName of modules) {
    await prisma.module.upsert({
      where: { name: moduleName },
      update: {},
      create: { name: moduleName },
    });
  }

  const allRoles = await prisma.role.findMany();
  const allModules = await prisma.module.findMany();

  for (const role of allRoles) {
    for (const module of allModules) {
      const permission = await prisma.permission.findFirst({
        where: { roleId: role.id, moduleId: module.id },
      });

      if (!permission) {
        await prisma.permission.create({
          data: {
            roleId: role.id,
            moduleId: module.id,
            canReadList: role.name !== "user",
            canReadSingle: role.name !== "user",
            canCreate: role.name === "admin" || role.name === "moderator",
            canUpdate: role.name === "admin" || role.name === "moderator",
            canDelete: role.name === "admin",
          },
        });
      }
    }
  }

  console.log("Roles, modules, and permissions seeded successfully!");
}

async function main() {
  try {
    await seedRolesModulesPermissions();
  } catch (err) {
    console.error(err);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();
