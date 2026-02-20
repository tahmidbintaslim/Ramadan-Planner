"use client";

import {
  createContext,
  useContext,
  type ReactNode,
} from "react";
import { useUser } from "@clerk/nextjs";

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
  const { isLoaded, isSignedIn, user } = useUser();
  const authUser = isSignedIn && user
    ? {
        id: user.id,
        email: user.primaryEmailAddress?.emailAddress ?? null,
      }
    : null;

  return (
    <AuthContext.Provider value={{ user: authUser, loading: !isLoaded, isGuest: !isSignedIn }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
