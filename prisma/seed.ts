import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import bcrypt from "bcryptjs";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter });

async function main() {
  const email = "doctor@smilepassport.com";
  const passwordHash = await bcrypt.hash("Doctor@Smile123$", 10);

  await prisma.doctor.upsert({
    where: { email },
    update: {},
    create: {
      name: "Dr. Smile Passport",
      email,
      passwordHash,
    },
  });

  console.log(`Seeded doctor account: ${email}`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
