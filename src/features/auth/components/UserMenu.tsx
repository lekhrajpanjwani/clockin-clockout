import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { LogOut } from "lucide-react";
import { toast } from "sonner";
import { Button } from "../../../components/ui/button";
import { useSession } from "../hooks/useSession";
import { signOut } from "../api/signOut";
import { ROUTES } from "../../../constants/routes";

export function UserMenu() {
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

  return (
    <div className="flex items-center gap-2">
      <span className="hidden max-w-[12rem] truncate text-sm text-muted-foreground sm:inline">
        {user.email}
      </span>
      <Button
        variant="ghost"
        size="icon"
        aria-label="Sign out"
        title="Sign out"
        onClick={handleSignOut}
        disabled={signingOut}
      >
        <LogOut />
      </Button>
    </div>
  );
}
