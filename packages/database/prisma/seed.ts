import { PrismaClient } from "../generated/client";
import bcrypt from "bcrypt";

const prisma = new PrismaClient();

async function main() {
  console.log("Seeding TradPath demo data...");

  const passwordHash = await bcrypt.hash("Password123!", 12);

  const org = await prisma.organization.upsert({
    where: { slug: "demo-hvac" },
    update: {},
    create: {
      name: "Demo HVAC Co.",
      slug: "demo-hvac",
      email: "hello@demohvac.com",
      phone: "555-010-1000",
      website: "https://demohvac.com",
      address: "123 Main St",
      city: "Austin",
      state: "TX",
      zip: "78701",
      timezone: "America/Chicago",
      subscriptionPlan: "GROWTH",
      subscriptionStatus: "TRIALING",
      trialEndsAt: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
      bookingEnabled: true,
      bookingSlug: "demo-hvac",
      bookingPageTitle: "Book a Service — Demo HVAC Co.",
      bookingPageDescription: "Schedule HVAC service online in minutes.",
      bookingPageColor: "#1B2A4A",
      morningBriefingEnabled: true,
      defaultTaxRate: 8.25,
      defaultInvoiceDueDays: 30,
    },
  });

  const owner = await prisma.user.upsert({
    where: { email: "owner@demohvac.com" },
    update: {},
    create: {
      email: "owner@demohvac.com",
      passwordHash,
      firstName: "Dana",
      lastName: "Owens",
      role: "OWNER",
      organizationId: org.id,
      emailVerified: true,
    },
  });

  const tech1 = await prisma.user.upsert({
    where: { email: "tech1@demohvac.com" },
    update: {},
    create: {
      email: "tech1@demohvac.com",
      passwordHash,
      firstName: "Marco",
      lastName: "Diaz",
      role: "TECHNICIAN",
      organizationId: org.id,
      emailVerified: true,
    },
  });

  const tech2 = await prisma.user.upsert({
    where: { email: "tech2@demohvac.com" },
    update: {},
    create: {
      email: "tech2@demohvac.com",
      passwordHash,
      firstName: "Priya",
      lastName: "Nair",
      role: "TECHNICIAN",
      organizationId: org.id,
      emailVerified: true,
    },
  });

  const customerData = [
    {
      firstName: "John",
      lastName: "Carter",
      email: "john.carter@example.com",
      phone: "555-020-1001",
      serviceAddress: "45 Oak Ave",
      city: "Austin",
      state: "TX",
      zip: "78702",
      propertyType: "RESIDENTIAL" as const,
    },
    {
      firstName: "Linda",
      lastName: "Nguyen",
      email: "linda.nguyen@example.com",
      phone: "555-020-1002",
      serviceAddress: "78 Pine Rd",
      city: "Austin",
      state: "TX",
      zip: "78703",
      propertyType: "RESIDENTIAL" as const,
    },
    {
      firstName: "Robert",
      lastName: "Kim",
      company: "Kim Retail Group",
      email: "robert.kim@example.com",
      phone: "555-020-1003",
      serviceAddress: "900 Commerce Blvd",
      city: "Austin",
      state: "TX",
      zip: "78704",
      propertyType: "COMMERCIAL" as const,
    },
  ];

  const customers = [];
  for (const c of customerData) {
    const customer = await prisma.customer.create({
      data: { ...c, organizationId: org.id },
    });
    customers.push(customer);

    await prisma.customerEquipment.create({
      data: {
        organizationId: org.id,
        customerId: customer.id,
        name: "Central AC Unit",
        type: "HVAC",
        make: "Carrier",
        model: "24ABC6",
        serialNumber: `SN-${customer.id.slice(-6)}`,
        installDate: new Date("2021-05-15"),
        warrantyExpiry: new Date("2026-05-15"),
        lastServiceDate: new Date("2025-11-01"),
        nextServiceDate: new Date("2026-05-01"),
      },
    });
  }

  const categoryHvac = await prisma.serviceCategory.create({
    data: {
      organizationId: org.id,
      name: "HVAC",
      description: "Heating, ventilation, and air conditioning",
      sortOrder: 0,
    },
  });

  const categoryMaintenance = await prisma.serviceCategory.create({
    data: {
      organizationId: org.id,
      name: "Maintenance Plans",
      description: "Recurring seasonal tune-ups",
      sortOrder: 1,
    },
  });

  const offerings = await Promise.all([
    prisma.serviceOffering.create({
      data: {
        organizationId: org.id,
        categoryId: categoryHvac.id,
        name: "AC Repair",
        description: "Diagnose and repair AC system issues",
        duration: 90,
        price: 150,
        priceType: "STARTING_AT",
        isBookable: true,
        sortOrder: 0,
      },
    }),
    prisma.serviceOffering.create({
      data: {
        organizationId: org.id,
        categoryId: categoryHvac.id,
        name: "Furnace Tune-Up",
        description: "Seasonal furnace inspection and tune-up",
        duration: 60,
        price: 120,
        priceType: "FIXED",
        isBookable: true,
        sortOrder: 1,
      },
    }),
    prisma.serviceOffering.create({
      data: {
        organizationId: org.id,
        categoryId: categoryMaintenance.id,
        name: "New System Estimate",
        description: "Free estimate for full HVAC replacement",
        duration: 45,
        priceType: "FREE_ESTIMATE",
        isBookable: true,
        sortOrder: 2,
      },
    }),
  ]);

  await prisma.priceBook.createMany({
    data: [
      { organizationId: org.id, name: "Standard Labor Hour", category: "LABOR", unitPrice: 95, unit: "hour", sortOrder: 0 },
      { organizationId: org.id, name: "Refrigerant (R-410A) per lb", category: "MATERIAL", unitPrice: 45, unit: "lb", sortOrder: 1 },
      { organizationId: org.id, name: "Capacitor Replacement", category: "MATERIAL", unitPrice: 65, unit: "each", sortOrder: 2 },
      { organizationId: org.id, name: "Air Filter (16x25x1)", category: "MATERIAL", unitPrice: 18, unit: "each", sortOrder: 3 },
      { organizationId: org.id, name: "Diagnostic Fee", category: "SERVICE", unitPrice: 89, unit: "flat", sortOrder: 4 },
    ],
  });

  for (let day = 1; day <= 5; day++) {
    await prisma.bookingAvailability.create({
      data: {
        organizationId: org.id,
        dayOfWeek: day,
        startTime: "08:00",
        endTime: "17:00",
        isActive: true,
      },
    });
  }

  const job1 = await prisma.job.create({
    data: {
      organizationId: org.id,
      customerId: customers[0].id,
      jobNumber: "1001",
      title: "AC not cooling",
      description: "Customer reports warm air from vents.",
      status: "SCHEDULED",
      priority: "HIGH",
      type: "ONE_TIME",
      serviceAddress: customers[0].serviceAddress,
      city: customers[0].city,
      state: customers[0].state,
      zip: customers[0].zip,
      scheduledStart: new Date(Date.now() + 24 * 60 * 60 * 1000),
      scheduledEnd: new Date(Date.now() + 24 * 60 * 60 * 1000 + 90 * 60 * 1000),
      assignedUserIds: [tech1.id],
      createdBy: owner.id,
    },
  });

  await prisma.job.create({
    data: {
      organizationId: org.id,
      customerId: customers[1].id,
      jobNumber: "1002",
      title: "Furnace seasonal tune-up",
      status: "COMPLETED",
      priority: "NORMAL",
      type: "ONE_TIME",
      serviceAddress: customers[1].serviceAddress,
      city: customers[1].city,
      state: customers[1].state,
      zip: customers[1].zip,
      scheduledStart: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000),
      scheduledEnd: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000 + 60 * 60 * 1000),
      actualStart: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000),
      actualEnd: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000 + 55 * 60 * 1000),
      assignedUserIds: [tech2.id],
      totalRevenue: 120,
      laborCost: 40,
      profit: 80,
      createdBy: owner.id,
    },
  });

  await prisma.servicePlan.create({
    data: {
      organizationId: org.id,
      customerId: customers[2].id,
      name: "Commercial HVAC Care Plan",
      description: "Bi-annual inspection and priority service",
      status: "ACTIVE",
      billingCycle: "ANNUAL",
      price: 399,
      serviceFrequency: "BIANNUAL",
      serviceDescription: "Full system inspection, filter replacement, coil cleaning",
      isPublic: true,
      publicName: "Commercial Care Plan",
      publicDescription: "Keep your commercial HVAC running year-round.",
      createdBy: owner.id,
    },
  });

  console.log("Seed complete:", {
    org: org.slug,
    users: [owner.email, tech1.email, tech2.email],
    customers: customers.length,
    offerings: offerings.length,
    job1: job1.jobNumber,
  });
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
