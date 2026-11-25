import { Toaster as SonnerToaster } from "sonner";
import { useUiStore } from "../../store/uiStore";

export function Toaster() {
  const theme = useUiStore((s) => s.resolvedTheme);

  return (
    <SonnerToaster
      theme={theme}
      position="top-right"
      richColors
      closeButton
      toastOptions={{
        classNames: {
          toast: "font-body",
        },
      }}
    />
  );
}
