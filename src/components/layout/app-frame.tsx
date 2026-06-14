import { Suspense } from "react";

import { getCurrentProfileOrRedirect } from "@/lib/auth/session";
import { DesktopNavigation, MobileNavigation } from "@/components/layout/navigation";
import { SignOutButton } from "@/components/layout/sign-out-button";
import pkg from "../../../package.json";

type AppFrameProps = {
  children: React.ReactNode;
};

async function ProfileHeader() {
  const profile = await getCurrentProfileOrRedirect();
  const profileName = profile.name ?? profile.email.split("@")[0] ?? "there";
  const todayLabel = new Intl.DateTimeFormat("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
  }).format(new Date());

  return (
    <header className="mb-5 flex items-center justify-between gap-3 rounded-[16px] border border-border bg-white px-5 py-3.5 shadow-[var(--shadow-card)]">
      <div className="min-w-0">
        <p className="truncate text-base font-semibold tracking-[-0.02em]">{profileName}</p>
        <p className="text-[12px] text-muted">{todayLabel} · {profile.timezone.replaceAll("_", " ")}</p>
      </div>
      <SignOutButton />
    </header>
  );
}

function ProfileHeaderFallback() {
  return (
    <header className="mb-5 flex items-center justify-between gap-3 rounded-[16px] border border-border bg-white px-5 py-3.5 shadow-[var(--shadow-card)]">
      <div className="min-w-0 flex-1 animate-pulse">
        <div className="h-5 w-36 rounded-full bg-slate-200" />
        <div className="mt-2 h-3 w-56 max-w-full rounded-full bg-slate-100" />
      </div>
      <SignOutButton />
    </header>
  );
}

export function AppFrame({ children }: AppFrameProps) {
  return (
    <div className="app-shell min-h-screen px-3 py-3 md:px-5 md:py-5 relative">
      <div className="mx-auto grid min-h-[calc(100vh-2.5rem)] max-w-[1440px] gap-4 md:grid-cols-[240px_1fr]">
        <DesktopNavigation />

        <div className="flex min-w-0 flex-col pb-24 md:pb-0">
          <Suspense fallback={<ProfileHeaderFallback />}>
            <ProfileHeader />
          </Suspense>

          <main className="page-grid flex-1">{children}</main>
        </div>
      </div>
      <MobileNavigation />

      {/* Floating App Version Badge */}
      <div className="fixed bottom-[84px] right-4 md:bottom-6 md:right-6 z-50">
        <div className="flex items-center gap-2 rounded-xl border border-border bg-white/80 backdrop-blur-md px-4 py-2.5 shadow-lg select-none hover:scale-105 transition-transform duration-200 cursor-default">
          <span className="relative flex size-2">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-accent opacity-75"></span>
            <span className="relative inline-flex size-2 rounded-full bg-accent"></span>
          </span>
          <span className="text-[14px] font-extrabold tracking-tight text-foreground">
            v{pkg.version}
          </span>
        </div>
      </div>
    </div>
  );
}
