"use client";

/**
 * Supabase browser client.
 *
 * Google sign-in runs entirely through Supabase Auth: the browser redirects to
 * Supabase, Supabase talks to Google, and the /oauth/callback page exchanges
 * the returned code for a Driftwatch session cookie via /api/auth/oauth/session.
 * No Google client secret ever touches this codebase.
 *
 * The demo console still works without Supabase configured — the email and
 * password flow is local — so every Supabase call here is guarded and the UI
 * degrades to a labelled "not configured" state instead of throwing.
 */

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

export const supabaseConfigured = Boolean(url && anonKey);

let client: SupabaseClient | null = null;

export function getSupabase(): SupabaseClient | null {
  if (!supabaseConfigured) return null;
  if (!client) {
    client = createClient(url as string, anonKey as string, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        // The /oauth/callback page runs the PKCE exchange itself; letting the
        // client auto-detect the code here too would race it and burn the
        // one-time code.
        detectSessionInUrl: false,
      },
    });
  }
  return client;
}

/**
 * Start the Google OAuth flow. Returns the authorization URL for the caller to
 * redirect to, or an error string instead of throwing so the button can show a
 * useful message when OAuth is not yet enabled for the project (missing provider
 * credentials, redirect URL not allowlisted, etc).
 */
export async function startGoogleSignIn(
  redirectTo: string,
): Promise<{ url?: string; error?: string }> {
  const supabase = getSupabase();
  if (!supabase) {
    return {
      error:
        "Google sign-in is not configured. Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY, then enable the Google provider in Supabase.",
    };
  }

  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: { redirectTo, skipBrowserRedirect: true },
  });

  if (error || !data.url) {
    const raw = error?.message ?? "";
    // Supabase answers with a raw JSON blob when the provider is off:
    // {"code":400,"error_code":"validation_failed","msg":"Unsupported provider..."}
    if (/provider is not enabled|Unsupported provider/i.test(raw)) {
      return {
        error:
          "Google sign-in isn't enabled on this Supabase project yet. In Supabase → Authentication → Providers → Google, add your Google OAuth client ID and secret.",
      };
    }
    return { error: raw || "Google sign-in failed to start." };
  }
  return { url: data.url };
}
