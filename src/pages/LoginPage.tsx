import { LoginForm } from "../features/auth/components/LoginForm";

export function LoginPage() {
  return (
    <div className="flex flex-col gap-6">
      <div className="text-center">
        <h1 className="font-display text-2xl font-bold tracking-tight">Welcome back</h1>
        <p className="mt-1 text-sm text-muted-foreground">Sign in to clock in and track your hours.</p>
      </div>
      <LoginForm />
    </div>
  );
}
