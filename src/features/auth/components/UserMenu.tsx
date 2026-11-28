import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { LogOut } from "lucide-react";
import { toast } from "sonner";
import { Button } from "../../../components/ui/button";
import { useSession } from "../hooks/useSession";
import { signOut } from "../api/signOut";
import { ROUTES } from "../../../constants/routes";

/** Signed-in user + sign out. `compact` (rail / phone bar): avatar initial and
 * an icon button, the email in the tooltip. */
export function UserMenu({ compact = false }: { compact?: boolean }) {
  const { user } = useSession();
  const navigate = useNavigate();
  const [signingOut, setSigningOut] = useState(false);

  if (!user) return null;

  const handleSignOut = async () => {
    setSigningOut(true);
    try {
      await signOut();
      navigate(ROUTES.login, { replace: true });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not sign out.");
    } finally {
      setSigningOut(false);
    }
  };

  const initial = (user.email ?? "?").charAt(0).toUpperCase();
  const signOutButton = (
    <Button
      variant="ghost"
      size="icon"
      aria-label="Sign out"
      title={user.email ? `Sign out (${user.email})` : "Sign out"}
      onClick={handleSignOut}
      disabled={signingOut}
    >
      <LogOut />
    </Button>
  );

  if (compact) {
    return (
      <div className="flex items-center gap-1 md:flex-col">
        <span
          title={user.email ?? undefined}
          className="hidden h-8 w-8 items-center justify-center rounded-full bg-primary-soft text-[13px] font-semibold text-primary-ink md:flex"
        >
          {initial}
        </span>
        {signOutButton}
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <span className="hidden max-w-[12rem] truncate text-sm text-muted-foreground sm:inline">
        {user.email}
      </span>
      {signOutButton}
    </div>
  );
}
