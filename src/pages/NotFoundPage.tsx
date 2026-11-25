import { Link } from "react-router-dom";
import { CalendarX } from "lucide-react";
import { buttonVariants } from "../components/ui/button";
import { ROUTES } from "../constants/routes";

export function NotFoundPage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 p-6 text-center">
      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted text-muted-foreground">
        <CalendarX className="h-6 w-6" />
      </div>
      <h1 className="font-display text-2xl font-bold">Page not found</h1>
      <p className="max-w-sm text-sm text-muted-foreground">
        There's no record at this address. Let's get you back to your dashboard.
      </p>
      <Link to={ROUTES.dashboard} className={buttonVariants({ variant: "default" })}>
        Back to Dashboard
      </Link>
    </div>
  );
}
