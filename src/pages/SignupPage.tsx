import { SignupForm } from "../features/auth/components/SignupForm";

export function SignupPage() {
  return (
    <div className="flex flex-col gap-6">
      <div className="text-center">
        <h1 className="font-display text-2xl font-bold tracking-tight">Create your account</h1>
        <p className="mt-1 text-sm text-muted-foreground">Start tracking your attendance in seconds.</p>
      </div>
      <SignupForm />
    </div>
  );
}
