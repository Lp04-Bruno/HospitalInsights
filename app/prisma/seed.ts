import bcrypt from "bcrypt";
import { PrismaClient, Role } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
    const email = "admin@hospitalinsights.local";
    const password = "admin1234";

    const hash = await bcrypt.hash(password, 12);

    await prisma.user.upsert({
        where: { email },
        update: {},
        create: {
            email,
            name: "Admin",
            password: hash,
            role: Role.ADMIN,
        },
    });

    console.log("Seeded admin:", { email, password });
}

main()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => prisma.$disconnect());
