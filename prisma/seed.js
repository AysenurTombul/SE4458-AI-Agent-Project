"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const client_1 = require("@prisma/client");
const password_1 = require("../src/utils/password");
const roles_1 = require("../src/types/roles");
const bookingStatus_1 = require("../src/types/bookingStatus");
const prisma = new client_1.PrismaClient();
async function main() {
    await prisma.review.deleteMany();
    await prisma.booking.deleteMany();
    await prisma.listing.deleteMany();
    await prisma.user.deleteMany();
    const admin = await prisma.user.create({
        data: {
            email: "admin@shortstay.dev",
            fullName: "Admin User",
            password: await (0, password_1.hashPassword)("Password123!"),
            role: roles_1.Roles.ADMIN
        }
    });
    const host = await prisma.user.create({
        data: {
            email: "host@shortstay.dev",
            fullName: "Primary Host",
            password: await (0, password_1.hashPassword)("Password123!"),
            role: roles_1.Roles.HOST
        }
    });
    const guest = await prisma.user.create({
        data: {
            email: "guest@shortstay.dev",
            fullName: "Sample Guest",
            password: await (0, password_1.hashPassword)("Password123!"),
            role: roles_1.Roles.GUEST
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
            amenities: JSON.stringify(["wifi", "kitchen", "workspace"]),
            hostId: host.id
        }
    });
    await prisma.booking.create({
        data: {
            listingId: listing.id,
            guestId: guest.id,
            startDate: new Date("2024-01-01"),
            endDate: new Date("2024-01-05"),
            occupantNames: JSON.stringify(["Sample Guest"]),
            status: bookingStatus_1.BookingStatuses.CONFIRMED
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
