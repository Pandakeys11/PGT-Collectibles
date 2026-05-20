import { NextRequest, NextResponse } from "next/server";
import { Webhook } from "svix";
import { getSupabaseAdmin, isSupabaseConfigured } from "@/lib/supabase/admin";

type ClerkWebhookEvent = {
  type: string;
  data: {
    id?: string;
    email_addresses?: Array<{ email_address?: string; id?: string }>;
    primary_email_address_id?: string;
    first_name?: string | null;
    last_name?: string | null;
    username?: string | null;
    image_url?: string | null;
  };
};

function primaryEmail(data: ClerkWebhookEvent["data"]) {
  const primary = data.email_addresses?.find((email) => email.id === data.primary_email_address_id);
  return primary?.email_address ?? data.email_addresses?.[0]?.email_address ?? null;
}

function displayName(data: ClerkWebhookEvent["data"]) {
  const full = [data.first_name, data.last_name].filter(Boolean).join(" ").trim();
  return full || data.username || null;
}

export async function POST(req: NextRequest) {
  const secret = process.env.CLERK_WEBHOOK_SECRET;
  if (!secret) {
    return NextResponse.json({ error: "CLERK_WEBHOOK_SECRET is not configured" }, { status: 503 });
  }
  if (!isSupabaseConfigured()) {
    return NextResponse.json({ error: "Supabase is not configured" }, { status: 503 });
  }

  const payload = await req.text();
  const headers = {
    "svix-id": req.headers.get("svix-id") ?? "",
    "svix-timestamp": req.headers.get("svix-timestamp") ?? "",
    "svix-signature": req.headers.get("svix-signature") ?? "",
  };

  let event: ClerkWebhookEvent;
  try {
    event = new Webhook(secret).verify(payload, headers) as ClerkWebhookEvent;
  } catch {
    return NextResponse.json({ error: "Invalid webhook signature" }, { status: 400 });
  }

  const clerkUserId = event.data.id;
  if (!clerkUserId) {
    return NextResponse.json({ error: "Missing Clerk user id" }, { status: 400 });
  }

  const supabase = getSupabaseAdmin();

  if (event.type === "user.deleted") {
    const { error } = await supabase.rpc("mark_clerk_user_deleted", {
      p_clerk_user_id: clerkUserId,
    });
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  }

  if (event.type === "user.created" || event.type === "user.updated") {
    const { error } = await supabase.rpc("sync_clerk_user", {
      p_clerk_user_id: clerkUserId,
      p_email: primaryEmail(event.data),
      p_display_name: displayName(event.data),
      p_avatar_url: event.data.image_url ?? null,
    });
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ ok: true, ignored: event.type });
}
