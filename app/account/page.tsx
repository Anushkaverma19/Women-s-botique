import Link from "next/link";
import { redirect } from "next/navigation";
import { Container } from "@/components/ui/primitives";
import { getCurrentProfile, getSessionUser } from "@/lib/supabase/auth";
import { LogoutButton } from "@/components/layout/LogoutButton";

export const metadata = { title: "My Account" };

export default async function AccountPage() {
  const user = await getSessionUser();
  if (!user) redirect("/login?redirectTo=/account");

  const profile = await getCurrentProfile();
  if (!profile) {
    return (
      <Container className="py-12 max-w-2xl">
        <h1 className="font-display text-4xl mb-4">Account Profile</h1>
        <div className="border border-charcoal/15 p-6 mb-8 space-y-3 text-sm">
          <div className="flex justify-between">
            <span className="text-charcoal/60">Email</span>
            <span>{user.email}</span>
          </div>
          <p className="text-charcoal/60 text-xs mt-4">
            Your profile details could not be loaded at this time. Please contact support if this continues.
          </p>
        </div>
        <div className="flex flex-wrap gap-4 items-center">
          <Link href="/orders" className="eyebrow underline underline-offset-4">
            View Order History
          </Link>
          <div className="ml-auto">
            <LogoutButton />
          </div>
        </div>
      </Container>
    );
  }

  return (
    <Container className="py-12 max-w-2xl">
      <h1 className="font-display text-4xl mb-10">My Account</h1>
      <div className="border border-charcoal/15 p-6 mb-8 space-y-3 text-sm">
        <div className="flex justify-between">
          <span className="text-charcoal/60">Name</span>
          <span>{profile.full_name || "—"}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-charcoal/60">Email</span>
          <span>{profile.email}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-charcoal/60">Role</span>
          <span className="capitalize">{profile.role}</span>
        </div>
      </div>
      <div className="flex flex-wrap gap-4 items-center">
        <Link href="/orders" className="eyebrow underline underline-offset-4">
          View Order History
        </Link>
        {profile.role === "admin" ? (
          <Link href="/admin" className="eyebrow underline underline-offset-4">
            Admin Dashboard
          </Link>
        ) : null}
        <div className="ml-auto">
          <LogoutButton />
        </div>
      </div>
    </Container>
  );
}
