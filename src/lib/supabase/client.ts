import { createBrowserClient } from "@supabase/ssr";

export function createClient() {
    // VITE_* replace the old NEXT_PUBLIC_* names (Vite only exposes VITE_-prefixed vars to the browser).
    return createBrowserClient(
        import.meta.env.VITE_SUPABASE_URL!,
        import.meta.env.VITE_SUPABASE_PUBLISHABLE_DEFAULT_KEY!
    );
}
