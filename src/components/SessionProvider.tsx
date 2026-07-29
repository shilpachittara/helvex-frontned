"use client";

import { SessionProvider } from "next-auth/react";
import type { Session } from "next-auth";
import type { ReactNode } from "react";

export function AuthSessionProvider({
  children,
  session,
}: {
  children: ReactNode;
  session: Session | null;
}) {
  // Passing the server session keeps the first client render aligned with SSR
  // (avoids next-auth status flipping from loading → authenticated mid-hydrate).
  return <SessionProvider session={session}>{children}</SessionProvider>;
}
