import { config as loadEnv } from 'dotenv';
loadEnv();

import { PrismaClient } from './generated/client';
import bcrypt from 'bcrypt';
import { PERMISSION_CATALOG, DEFAULT_ROLE_PERMISSIONS, SYSTEM_ROLES } from '../src/permissions';

/**
 * Seed rulat cu un client Prisma conectat direct (superuser în dev), deci
 * RLS e bypass-uit automat — nu e nevoie de `app.current_company_id`.
 * În producție, seed-ul de date demo NU trebuie rulat; doar catalogul
 * global de permisiuni + planurile de abonament sunt idempotente și sigure
 * de rulat oricând (folosesc `upsert`).
 */
const prisma = new PrismaClient();

async function seedPermissionCatalog() {
  for (const permission of PERMISSION_CATALOG) {
    await prisma.permission.upsert({
      where: { resource_action: { resource: permission.resource, action: permission.action } },
      update: { description: permission.description },
      create: permission,
    });
  }
  console.log(`Permisiuni: ${PERMISSION_CATALOG.length} sincronizate.`);
}

async function seedSubscriptionPlans() {
  const plans = [
    {
      slug: 'trial',
      name: 'Trial',
      priceMonthlyCents: 0,
      priceYearlyCents: 0,
      maxEmployees: 10,
      features: { modules: ['hr', 'crm', 'projects'], aiCreditsPerMonth: 100 },
    },
    {
      slug: 'basic',
      name: 'Basic',
      priceMonthlyCents: 14900,
      priceYearlyCents: 149000,
      maxEmployees: 25,
      features: { modules: ['hr', 'crm', 'projects', 'inventory'], aiCreditsPerMonth: 500 },
    },
    {
      slug: 'pro',
      name: 'Pro',
      priceMonthlyCents: 34900,
      priceYearlyCents: 349000,
      maxEmployees: 100,
      features: {
        modules: ['hr', 'crm', 'projects', 'inventory', 'chat', 'ai_assistant'],
        aiCreditsPerMonth: 2000,
      },
    },
  ];

  for (const plan of plans) {
    await prisma.subscriptionPlan.upsert({
      where: { slug: plan.slug },
      update: plan,
      create: plan,
    });
  }
  console.log(`Planuri de abonament: ${plans.length} sincronizate.`);
}

async function seedDemoCompany() {
  const existing = await prisma.company.findUnique({ where: { slug: 'demo' } });
  if (existing) {
    console.log('Compania demo există deja — sar peste crearea de date demo.');
    return;
  }

  const company = await prisma.company.create({
    data: {
      slug: 'demo',
      name: 'Acme Demo SRL',
      cui: 'RO12345678',
      vatPayer: true,
      email: 'contact@acme-demo.ro',
      address: 'Str. Exemplu nr. 1, București',
      trialEndsAt: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
    },
  });

  const trialPlan = await prisma.subscriptionPlan.findUniqueOrThrow({ where: { slug: 'trial' } });
  await prisma.subscription.create({
    data: {
      companyId: company.id,
      planId: trialPlan.id,
      status: 'TRIALING',
      billingCycle: 'MONTHLY',
      currentPeriodStart: new Date(),
      currentPeriodEnd: company.trialEndsAt!,
    },
  });

  const allPermissions = await prisma.permission.findMany();
  const permissionByKey = new Map(allPermissions.map((p) => [`${p.resource}:${p.action}`, p.id]));

  const roleByKey = new Map<string, string>();
  for (const systemKey of SYSTEM_ROLES) {
    const role = await prisma.role.create({
      data: {
        companyId: company.id,
        name: systemKey.charAt(0) + systemKey.slice(1).toLowerCase(),
        systemKey,
        isSystem: true,
      },
    });
    roleByKey.set(systemKey, role.id);

    const permissionKeys = DEFAULT_ROLE_PERMISSIONS[systemKey];
    await prisma.rolePermission.createMany({
      data: permissionKeys
        .map((key) => permissionByKey.get(key))
        .filter((id): id is string => Boolean(id))
        .map((permissionId) => ({ roleId: role.id, permissionId })),
    });
  }

  const department = await prisma.department.create({
    data: { companyId: company.id, name: 'Management', description: 'Conducerea companiei' },
  });

  const leaveTypes = await Promise.all(
    [
      { name: 'Concediu de odihnă', colorHex: '#22c55e', isPaid: true, defaultDaysPerYear: 21 },
      { name: 'Concediu medical', colorHex: '#f59e0b', isPaid: true, defaultDaysPerYear: null },
      { name: 'Fără plată', colorHex: '#6b7280', isPaid: false, defaultDaysPerYear: null },
    ].map((lt) => prisma.leaveType.create({ data: { companyId: company.id, ...lt } })),
  );

  const passwordHash = await bcrypt.hash(process.env.SEED_ADMIN_PASSWORD ?? 'Demo1234!', 12);
  const adminUser = await prisma.user.create({
    data: {
      companyId: company.id,
      email: 'admin@acme-demo.ro',
      passwordHash,
      firstName: 'Andrei',
      lastName: 'Popescu',
      roleId: roleByKey.get('ADMIN')!,
      status: 'ACTIVE',
    },
  });

  const employee = await prisma.employee.create({
    data: {
      companyId: company.id,
      userId: adminUser.id,
      employeeCode: 'EMP-0001',
      departmentId: department.id,
      position: 'Director General',
      contractType: 'FULL_TIME',
      hireDate: new Date('2022-01-10'),
      annualLeaveDays: 21,
    },
  });

  await prisma.leaveBalance.create({
    data: {
      companyId: company.id,
      employeeId: employee.id,
      leaveTypeId: leaveTypes[0]!.id,
      year: new Date().getFullYear(),
      totalDays: 21,
      usedDays: 0,
    },
  });

  console.log('Companie demo creată:');
  console.log('  slug: demo');
  console.log('  email: admin@acme-demo.ro');
  console.log(`  parolă: ${process.env.SEED_ADMIN_PASSWORD ?? 'Demo1234!'} (schimbă în producție)`);
}

async function main() {
  await seedPermissionCatalog();
  await seedSubscriptionPlans();
  await seedDemoCompany();
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
