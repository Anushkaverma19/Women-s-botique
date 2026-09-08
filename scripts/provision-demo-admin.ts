import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SECRET_KEY;
const demoEmail = process.env.DEMO_ADMIN_EMAIL;
const demoPassword = process.env.DEMO_ADMIN_PASSWORD;

if (!supabaseUrl || !serviceRoleKey) {
  throw new Error(
    "Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SECRET_KEY."
  );
}

if (!demoEmail || !demoPassword) {
  throw new Error(
    "Missing DEMO_ADMIN_EMAIL or DEMO_ADMIN_PASSWORD."
  );
}

if (demoPassword.length < 8) {
  throw new Error("DEMO_ADMIN_PASSWORD must be at least 8 characters.");
}

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

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

async function main() {
  console.log("Provisioning MEHRAÉ demo admin...");

let user = await findUserByEmail(demoEmail!);

  if (!user) {
    console.log("Demo admin does not exist. Creating Auth user...");

    const { data, error } = await supabase.auth.admin.createUser({
      email: demoEmail,
      password: demoPassword,
      email_confirm: true,
      user_metadata: {
        full_name: "MEHRAÉ Demo Admin",
      },
    });

    if (error) {
      throw new Error(`Unable to create demo admin: ${error.message}`);
    }

    user = data.user;

    if (!user) {
      throw new Error("Supabase did not return the created user.");
    }

    console.log("Auth user created.");
  } else {
    console.log("Demo admin already exists. Reusing existing Auth user.");

    // Keep the configured demo password in sync without printing it.
    const { error } = await supabase.auth.admin.updateUserById(user.id, {
      password: demoPassword,
      email_confirm: true,
    });

    if (error) {
      throw new Error(`Unable to update demo admin: ${error.message}`);
    }
  }

  const { error: profileError } = await supabase
    .from("profiles")
    .upsert(
      {
        id: user.id,
        email: demoEmail,
        full_name: "MEHRAÉ Demo Admin",
        role: "admin",
      },
      {
        onConflict: "id",
      }
    );

  if (profileError) {
    throw new Error(
      `Unable to provision admin profile: ${profileError.message}`
    );
  }

  console.log("");
  console.log("✓ Demo admin provisioned successfully.");
  console.log(`✓ Login email: ${demoEmail}`);
  console.log("✓ Password: configured from DEMO_ADMIN_PASSWORD");
  console.log("✓ Role: admin");
  console.log("");
  console.log("Recruiter flow:");
  console.log("1. Open /login");
  console.log("2. Sign in with the configured demo admin credentials");
  console.log("3. Open /admin");
}

main().catch((error) => {
  console.error("");
  console.error("Demo admin provisioning failed.");
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});