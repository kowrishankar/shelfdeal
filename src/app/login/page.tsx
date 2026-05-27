import { AppShell } from "@/components/AppShell";
import { AuthForm } from "@/components/auth/AuthForm";

export const metadata = {
  title: "Sign in | Bargain Goods",
};

export default function LoginPage() {
  return (
    <AppShell minimal title="Sign in" subtitle="Access your search history">
      <div className="mx-auto max-w-lg px-4 py-6">
        <h1 className="text-2xl font-bold text-[var(--text-primary)]">Sign in</h1>
        <p className="mt-1 text-sm text-[var(--text-secondary)]">
          Welcome back — pick up where you left off.
        </p>
        <div className="mt-6 surface-card p-5">
          <AuthForm mode="login" />
        </div>
      </div>
    </AppShell>
  );
}
