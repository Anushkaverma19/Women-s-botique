import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey =
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY;

if (!supabaseUrl || !serviceRoleKey) {
  throw new Error(
    "Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY/SUPABASE_SECRET_KEY."
  );
}

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

interface DemoAccount {
  email: string;
  password: string;
  fullName: string;
  role: "admin" | "customer";
}

const DEMO_ACCOUNTS: DemoAccount[] = [
  {
    email: process.env.DEMO_ADMIN_EMAIL || "demo@mehrae.com",
    password: process.env.DEMO_ADMIN_PASSWORD || "MehraeDemo@2026",
    fullName: "MEHRAÉ Demo Admin",
    role: "admin",
  },
  {
    email: "admin@mehrae.com",
    password: "Admin@123",
    fullName: "MEHRAÉ Administrator",
    role: "admin",
  },
  {
    email: "customer@mehrae.com",
    password: "Customer@123",
    fullName: "MEHRAÉ Demo Customer",
    role: "customer",
  },
];

async function findUserByEmail(email: string) {
  let page = 1;

  while (true) {
    const { data, error } = await supabase.auth.admin.listUsers({
      page,
      perPage: 100,
    });

    if (error) {
      throw new Error(`Unable to list Supabase users: ${error.message}`);
    }

    const user = data.users.find(
      (candidate) => candidate.email?.toLowerCase() === email.toLowerCase()
    );

    if (user) return user;
    if (data.users.length < 100) return null;
    page += 1;
  }
}

async function provisionAccount(account: DemoAccount) {
  console.log(`Provisioning ${account.email} (${account.role})...`);
  let user = await findUserByEmail(account.email);

  if (!user) {
    const { data, error } = await supabase.auth.admin.createUser({
      email: account.email,
      password: account.password,
      email_confirm: true,
      user_metadata: {
        full_name: account.fullName,
      },
    });

    if (error) {
      throw new Error(`Unable to create user ${account.email}: ${error.message}`);
    }

    user = data.user;
    if (!user) {
      throw new Error("Supabase did not return the created user.");
    }
    console.log(`  ✓ Auth user created for ${account.email}`);
  } else {
    const { error } = await supabase.auth.admin.updateUserById(user.id, {
      password: account.password,
      email_confirm: true,
    });

    if (error) {
      throw new Error(`Unable to update user ${account.email}: ${error.message}`);
    }
    console.log(`  ✓ Password refreshed for ${account.email}`);
  }

  const { error: profileError } = await supabase.from("profiles").upsert(
    {
      id: user.id,
      email: account.email,
      full_name: account.fullName,
      role: account.role,
    },
    {
      onConflict: "id",
    }
  );

  if (profileError) {
    throw new Error(`Unable to update profile for ${account.email}: ${profileError.message}`);
  }

  console.log(`  ✓ Profile row confirmed with role '${account.role}'`);
}

async function main() {
  console.log("Starting MEHRAÉ demo accounts provisioning...\n");

  for (const account of DEMO_ACCOUNTS) {
    await provisionAccount(account);
  }

  console.log("\n==========================================");
  console.log("✓ All demo accounts provisioned successfully!");
  console.log("==========================================");
  for (const acc of DEMO_ACCOUNTS) {
    console.log(`- ${acc.email} | Password: ${acc.password} | Role: ${acc.role}`);
  }
  console.log("");
}

main().catch((error) => {
  console.error("\nDemo accounts provisioning failed.");
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});