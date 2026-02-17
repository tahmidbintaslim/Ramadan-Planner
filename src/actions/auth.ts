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

export async function logoutAction(): Promise<void> {
    const supabase = await createClient();
    await supabase.auth.signOut();
}
