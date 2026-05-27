import { AppShell } from "@/components/AppShell";
import { AuthForm } from "@/components/auth/AuthForm";

export const metadata = {
  title: "Sign up | Bargain Goods",
};

export default function SignupPage() {
  return (
    <AppShell minimal title="Create account" subtitle="Save history & track prices">
      <div className="mx-auto max-w-lg px-4 py-6">
        <h1 className="text-2xl font-bold text-[var(--text-primary)]">Create account</h1>
        <p className="mt-1 text-sm text-[var(--text-secondary)]">
          Your searches are saved to History. Track prices on the Insights page.
        </p>
        <div className="surface-card mt-6 p-5">
          <AuthForm mode="signup" />
        </div>
      </div>
    </AppShell>
  );
}
