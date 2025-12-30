import { prismaClient } from "../../src/lib/prismaClient";
import { Prisma } from "../generated/prisma/client";

const prisma = prismaClient;

async function seedPlans() {
  console.log("Seeding pricing plans...");

  const plans = [
    {
      name: "Starter",
      description: "Perfect for small teams and startups.",
      price: new Prisma.Decimal(29),
      currency: "USD",
      features: [
        { label: "Up to 5 team members", highlight: true },
        { label: "Basic analytics" },
        { label: "5GB storage" },
        { label: "Email support" },
      ],
    },
    {
      name: "Professional",
      description: "Ideal for growing businesses.",
      price: new Prisma.Decimal(79),
      currency: "USD",
      features: [
        { label: "Up to 20 team members", highlight: true },
        { label: "Advanced analytics", badge: "popular" },
        { label: "25GB storage" },
        { label: "Priority email support" },
        { label: "API access", badge: "new" },
      ],
    },
    {
      name: "Enterprise",
      description: "For large organizations with complex needs.",
      price: new Prisma.Decimal(199),
      currency: "USD",
      features: [
        { label: "Unlimited team members", highlight: true },
        { label: "Custom analytics" },
        { label: "Unlimited storage" },
        { label: "24/7 phone & email support", highlight: true },
        { label: "Advanced API access" },
        { label: "Custom integrations", badge: "enterprise" },
      ],
    },
  ];

  for (const plan of plans) {
    await prisma.plan.upsert({
      where: { name: plan.name },
      update: {
        description: plan.description,
        price: plan.price,
        currency: plan.currency as any,
        features: plan.features,
        isActive: true,
      },
      create: {
        name: plan.name,
        description: plan.description,
        price: plan.price,
        currency: plan.currency as any,
        features: plan.features,
        isActive: true,
      },
    });
  }

  console.log("Pricing plans seeded successfully!");
}

async function main() {
  try {
    await seedPlans();
  } catch (error) {
    console.error(error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();
