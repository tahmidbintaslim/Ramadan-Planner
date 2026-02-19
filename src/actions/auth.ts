"use server";

import { createClient } from "@/lib/supabase/server";
import { z } from "zod";

const loginSchema = z.object({
    email: z.string().email(),
    password: z.string().min(6),
});

const signupSchema = z.object({
    email: z.string().email(),
    password: z.string().min(6),
    confirmPassword: z.string().min(6),
});

export async function loginAction(
    formData: FormData
): Promise<{ error?: string } | undefined> {
    const parsed = loginSchema.safeParse({
        email: formData.get("email"),
        password: formData.get("password"),
    });

    if (!parsed.success) {
        return { error: "Invalid email or password format" };
    }

    const supabase = await createClient();
    const { error } = await supabase.auth.signInWithPassword({
        email: parsed.data.email,
        password: parsed.data.password,
    });

    if (error) {
        return { error: error.message };
    }

    return undefined;
}

export async function signupAction(
    formData: FormData
): Promise<{ error?: string } | undefined> {
    const parsed = signupSchema.safeParse({
        email: formData.get("email"),
        password: formData.get("password"),
        confirmPassword: formData.get("confirmPassword"),
    });

    if (!parsed.success) {
        return { error: "Invalid input" };
    }

    if (parsed.data.password !== parsed.data.confirmPassword) {
        return { error: "Passwords do not match" };
    }

    const supabase = await createClient();
    const { error } = await supabase.auth.signUp({
        email: parsed.data.email,
        password: parsed.data.password,
    });

    if (error) {
        return { error: error.message };
    }

    return undefined;
}

const forgotSchema = z.object({
    email: z.string().email(),
});

export async function forgotPasswordAction(
    formData: FormData
): Promise<{ error?: string } | { ok: true }> {
    const parsed = forgotSchema.safeParse({
        email: formData.get("email"),
    });

    if (!parsed.success) {
        return { error: "Invalid email" };
    }

    const supabase = await createClient();
    const { error } = await supabase.auth.resetPasswordForEmail(parsed.data.email, {
        redirectTo: process.env.NEXT_PUBLIC_SITE_URL
            ? `${process.env.NEXT_PUBLIC_SITE_URL.replace(/\/$/, "")}/auth/reset`
            : undefined,
    });

    if (error) return { error: error.message };
    return { ok: true };
}

export async function logoutAction(): Promise<void> {
    const supabase = await createClient();
    await supabase.auth.signOut();
}
