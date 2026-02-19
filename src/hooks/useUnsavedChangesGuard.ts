import { useEffect, useMemo } from "react";
import { useSurveyStore } from "@/src/store/useSurveyStore";

const WARNING_MESSAGE = "You have unsaved changes. Are you sure you want to leave?";

export function useUnsavedChangesGuard() {
  const { saveStatus, autosaveInFlight, autosavePending } = useSurveyStore();

  const shouldBlockNavigation = useMemo(
    () =>
      saveStatus === "unsaved" ||
      saveStatus === "saving" ||
      autosaveInFlight ||
      autosavePending,
    [saveStatus, autosaveInFlight, autosavePending]
  );

  useEffect(() => {
    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      if (!shouldBlockNavigation) return;
      event.preventDefault();
      event.returnValue = WARNING_MESSAGE;
    };

    const handleDocumentClick = (event: MouseEvent) => {
      if (!shouldBlockNavigation) return;

      const target = event.target as HTMLElement | null;
      const anchor = target?.closest("a[href]") as HTMLAnchorElement | null;
      if (!anchor) return;
      if (anchor.target === "_blank" || anchor.hasAttribute("download")) return;

      const href = anchor.getAttribute("href");
      if (!href || href.startsWith("#") || href.startsWith("mailto:") || href.startsWith("tel:")) return;

      const nextUrl = new URL(anchor.href, window.location.origin);
      const currentUrl = new URL(window.location.href);
      if (nextUrl.href === currentUrl.href) return;

      const confirmed = window.confirm(WARNING_MESSAGE);
      if (!confirmed) {
        event.preventDefault();
        event.stopPropagation();
      }
    };

    window.addEventListener("beforeunload", handleBeforeUnload);
    document.addEventListener("click", handleDocumentClick, true);

    return () => {
      window.removeEventListener("beforeunload", handleBeforeUnload);
      document.removeEventListener("click", handleDocumentClick, true);
    };
  }, [shouldBlockNavigation]);

  const confirmNavigation = () => {
    if (!shouldBlockNavigation) return true;
    return window.confirm(WARNING_MESSAGE);
  };

  return {
    shouldBlockNavigation,
    confirmNavigation,
  };
}
