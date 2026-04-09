import { PrismaClient } from "@prisma/client";
import { hashPassword } from "../src/utils/password";

const prisma = new PrismaClient();

async function main() {
  await prisma.review.deleteMany();
  await prisma.booking.deleteMany();
  await prisma.listing.deleteMany();
  await prisma.user.deleteMany();

  const admin = await prisma.user.create({
    data: {
      email: "admin@shortstay.dev",
      fullName: "Admin User",
      password: await hashPassword("Password123!"),
      role: "ADMIN"
    }
  });

  const host = await prisma.user.create({
    data: {
      email: "host@shortstay.dev",
      fullName: "Primary Host",
      password: await hashPassword("Password123!"),
      role: "HOST"
    }
  });

  const guest = await prisma.user.create({
    data: {
      email: "guest@shortstay.dev",
      fullName: "Sample Guest",
      password: await hashPassword("Password123!"),
      role: "GUEST"
    }
  });

  const listing = await prisma.listing.create({
    data: {
      title: "Central Loft",
      description: "Cozy loft for city explorers",
      capacity: 4,
      country: "Turkey",
      city: "Istanbul",
      price: 120,
      amenities: ["wifi", "kitchen", "workspace"],
      hostId: host.id
    }
  });

  await prisma.booking.create({
    data: {
      listingId: listing.id,
      guestId: guest.id,
      startDate: new Date("2024-01-01"),
      endDate: new Date("2024-01-05"),
      occupantNames: ["Sample Guest"],
      status: "CONFIRMED"
    }
  });

  console.log({ admin: admin.email, host: host.email, guest: guest.email });
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
