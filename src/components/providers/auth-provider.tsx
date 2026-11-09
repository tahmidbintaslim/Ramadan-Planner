"use client";

import {
  createContext,
  useContext,
  type ReactNode,
} from "react";
import { useAuth as useClerkAuth, useUser } from "@clerk/tanstack-react-start";

interface AuthUser {
  id: string;
  email?: string | null;
}

interface AuthContextValue {
  user: AuthUser | null;
  loading: boolean;
  isGuest: boolean;
}

const AuthContext = createContext<AuthContextValue>({
  user: null,
  loading: true,
  isGuest: true,
});

export function AuthProvider({ children }: { children: ReactNode }) {
  // useAuth reads the session clerkMiddleware resolved on the server, so the server render and hydration already
  // know signed-in vs guest (no guest-then-signed-in flash in the nav). The email needs the client user object.
  const { isLoaded, isSignedIn, userId } = useClerkAuth();
  const { user } = useUser();
  const authUser = isSignedIn && userId ? { id: userId, email: user?.primaryEmailAddress?.emailAddress ?? null } : null;

  return (
    <AuthContext.Provider value={{ user: authUser, loading: !isLoaded, isGuest: !isSignedIn }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
