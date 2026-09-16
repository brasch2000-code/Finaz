import { PrismaClient, FlowType, FrequencyType } from "@prisma/client";

const prisma = new PrismaClient();

const DEFAULT_CATEGORIES = [
  // Ingresos
  { name: "Mesada", flowType: FlowType.INCOME, defaultFrequency: FrequencyType.FIJO, colorHex: "#10b981", icon: "Wallet" },
  { name: "Ayudantia", flowType: FlowType.INCOME, defaultFrequency: FrequencyType.RECURRENTE, colorHex: "#34d399", icon: "GraduationCap" },
  { name: "Salario", flowType: FlowType.INCOME, defaultFrequency: FrequencyType.FIJO, colorHex: "#059669", icon: "Briefcase" },
  { name: "Pago deuda", flowType: FlowType.INCOME, defaultFrequency: FrequencyType.ESPORADICO, colorHex: "#6ee7b7", icon: "Receipt" },
  { name: "Otros Ingresos", flowType: FlowType.INCOME, defaultFrequency: FrequencyType.ESPORADICO, colorHex: "#a7f3d0", icon: "Coins" },

  // Gastos
  { name: "Cargar Pase", flowType: FlowType.EXPENSE, defaultFrequency: FrequencyType.FIJO, colorHex: "#6366f1", icon: "Train" },
  { name: "Alimentacion", flowType: FlowType.EXPENSE, defaultFrequency: FrequencyType.RECURRENTE, colorHex: "#3b82f6", icon: "ShoppingCart" },
  { name: "Comer mal", flowType: FlowType.EXPENSE, defaultFrequency: FrequencyType.RECURRENTE, colorHex: "#f97316", icon: "UtensilsCrossed" },
  { name: "Otros salida a comer", flowType: FlowType.EXPENSE, defaultFrequency: FrequencyType.ESPORADICO, colorHex: "#fb923c", icon: "Coffee" },
  { name: "Arriendo", flowType: FlowType.EXPENSE, defaultFrequency: FrequencyType.FIJO, colorHex: "#4338ca", icon: "Home" },
  { name: "Servicios Básicos", flowType: FlowType.EXPENSE, defaultFrequency: FrequencyType.FIJO, colorHex: "#0ea5e9", icon: "Zap" },
  { name: "Salud y Farmacia", flowType: FlowType.EXPENSE, defaultFrequency: FrequencyType.ESPORADICO, colorHex: "#ef4444", icon: "HeartPulse" },
  { name: "Ocio y Discrecional", flowType: FlowType.EXPENSE, defaultFrequency: FrequencyType.ESPORADICO, colorHex: "#ec4899", icon: "Gamepad2" },
  { name: "Suscripciones", flowType: FlowType.EXPENSE, defaultFrequency: FrequencyType.RECURRENTE, colorHex: "#8b5cf6", icon: "Tv" },
  { name: "Otros Gastos", flowType: FlowType.EXPENSE, defaultFrequency: FrequencyType.ESPORADICO, colorHex: "#94a3b8", icon: "Tag" },
];

async function main() {
  console.log("Seeding default taxonomy categories...");

  for (const cat of DEFAULT_CATEGORIES) {
    await prisma.category.upsert({
      where: {
        name_flowType: {
          name: cat.name,
          flowType: cat.flowType,
        },
      },
      update: {
        defaultFrequency: cat.defaultFrequency,
        colorHex: cat.colorHex,
        icon: cat.icon,
        isSystem: true,
      },
      create: {
        name: cat.name,
        flowType: cat.flowType,
        defaultFrequency: cat.defaultFrequency,
        colorHex: cat.colorHex,
        icon: cat.icon,
        isSystem: true,
      },
    });
  }

  console.log("Database taxonomy seeded successfully.");
}

main()
  .catch((e) => {
    console.error("Seeding error:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
