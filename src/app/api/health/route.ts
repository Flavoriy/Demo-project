import { NextResponse } from "next/server";

import { getSupabaseConfig } from "@/lib/supabase/env";

const requiredEnv = [
  "NEXT_PUBLIC_APP_URL",
  "NEXT_PUBLIC_SUPABASE_URL",
  "DATABASE_URL",
  "TOKEN_ENCRYPTION_KEY",
] as const;

const optionalProviderEnv = [
  "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY",
  "NEXT_PUBLIC_SUPABASE_ANON_KEY",
  "GOOGLE_CLIENT_ID",
  "GOOGLE_CLIENT_SECRET",
  "QSTASH_TOKEN",
  "QSTASH_CURRENT_SIGNING_KEY",
  "QSTASH_NEXT_SIGNING_KEY",
] as const;

function envStatus(names: readonly string[]) {
  return Object.fromEntries(
    names.map((name) => [
      name,
      {
        configured: Boolean(process.env[name]),
      },
    ]),
  );
}

function trimBase64Padding(str: string): string {
  return str.endsWith("==") ? str.slice(0, -2) : str.endsWith("=") ? str.slice(0, -1) : str;
}

function encryptionKeyStatus() {
  const raw = process.env.TOKEN_ENCRYPTION_KEY;
  if (!raw) {
    return { configured: false, validBase64: false, byteLength: 0, validLength: false };
  }

  try {
    const bytes = Buffer.from(raw, "base64");
    return {
      configured: true,
      validBase64: trimBase64Padding(bytes.toString("base64")) === trimBase64Padding(raw),
      byteLength: bytes.length,
      validLength: bytes.length === 32,
    };
  } catch {
    return { configured: true, validBase64: false, byteLength: 0, validLength: false };
  }
}

function databaseUrlStatus() {
  const raw = process.env.DATABASE_URL;
  if (!raw) {
    return {
      configured: false,
      validUrl: false,
      hostKind: null,
      port: null,
      recommendation: "Set DATABASE_URL.",
    };
  }

  try {
    const url = new URL(raw);
    const host = url.hostname;
    const isDirectSupabaseHost = host.startsWith("db.") && host.endsWith(".supabase.co");
    const isSupabasePooler = host.endsWith(".pooler.supabase.com");

    return {
      configured: true,
      validUrl: true,
      hostKind: isDirectSupabaseHost ? "supabase-direct" : isSupabasePooler ? "supabase-pooler" : "custom",
      port: url.port || null,
      recommendation: isDirectSupabaseHost
        ? "Vercel may not reach Supabase direct database hosts because they require IPv6. Use the Supabase Connection Pooler/Supavisor DATABASE_URL instead."
        : null,
    };
  } catch {
    return {
      configured: true,
      validUrl: false,
      hostKind: null,
      port: null,
      recommendation: "DATABASE_URL is not a valid URL.",
    };
  }
}

function sanitizeError(error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  const valuesToRedact = [
    process.env.DATABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    process.env.TOKEN_ENCRYPTION_KEY,
  ].filter(Boolean) as string[];

  return valuesToRedact.reduce(
    (safeMessage, value) => safeMessage.replaceAll(value, "[redacted]"),
    message,
  );
}

async function checkDatabase() {
  if (!process.env.DATABASE_URL) {
    return {
      ok: false,
      error: "DATABASE_URL is missing.",
    };
  }

  try {
    const { prisma } = await import("@/lib/db/prisma");
    const [ping, profileTable] = await Promise.all([
      prisma.$queryRaw`select 1 as ok`,
      prisma.$queryRaw<Array<{ exists: string | null }>>`select to_regclass('public.profiles')::text as exists`,
    ]);

    return {
      ok: true,
      ping: Array.isArray(ping),
      profilesTable: profileTable[0]?.exists ?? null,
    };
  } catch (error) {
    return {
      ok: false,
      error: sanitizeError(error),
    };
  }
}

export async function GET() {
  const env = envStatus(requiredEnv);
  const providers = envStatus(optionalProviderEnv);
  const supabase = getSupabaseConfig();
  const databaseUrl = databaseUrlStatus();
  const database = await checkDatabase();
  const requiredEnvReady = Object.values(env).every((status) => status.configured);
  const supabasePublicKeyReady = Boolean(supabase.publishableKey);
  const encryption = encryptionKeyStatus();

  return NextResponse.json({
    ok: requiredEnvReady && supabasePublicKeyReady && encryption.validLength && database.ok,
    checkedAt: new Date().toISOString(),
    env,
    supabase: {
      publicKeyConfigured: supabasePublicKeyReady,
      keySource: process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
        ? "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY"
        : process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
          ? "NEXT_PUBLIC_SUPABASE_ANON_KEY"
          : null,
    },
    providers,
    encryption,
    databaseUrl,
    database,
  });
}
