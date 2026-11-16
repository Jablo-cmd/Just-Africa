// Emails the Just Africa team when a contact message is stored.
// Called by the notify_contact_message() database trigger with only the message id.
// The function re-reads the row with the service role, so callers cannot inject email content, and it
// claims the row (notified_at) before sending so each message is emailed at most once.
//
// Required secrets (Supabase dashboard -> Edge Functions -> Secrets; never commit them):
//   SMTP_USER      mailbox that sends the notification (Zoho mailbox login)
//   SMTP_PASSWORD  an app-specific password for that mailbox
//   NOTIFY_TO      inbox that receives the notification
// Optional: SMTP_HOST (default smtp.zoho.com), SMTP_PORT (default 465).
// SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are provided automatically.
import { createClient } from "npm:@supabase/supabase-js@2.49.8";
import { SMTPClient } from "https://deno.land/x/denomailer@1.6.0/mod.ts";

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
const oneLine = (value: string) => value.replace(/[\r\n]+/g, " ").trim();
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

Deno.serve(async (req) => {
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);

  const required = ["SMTP_USER", "SMTP_PASSWORD", "NOTIFY_TO", "SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY"];
  const missing = required.filter((name) => !Deno.env.get(name));
  if (missing.length) return json({ error: "not_configured", missing }, 500);

  let id: unknown;
  try {
    ({ id } = await req.json());
  } catch {
    return json({ error: "invalid_json" }, 400);
  }
  if (typeof id !== "string" || !UUID.test(id)) return json({ error: "invalid_id" }, 400);

  const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, {
    auth: { persistSession: false },
  });

  // Claim the message so concurrent or repeated calls cannot send it twice.
  const { data: msg, error: claimError } = await db
    .from("contact_messages")
    .update({ notified_at: new Date().toISOString() })
    .eq("id", id)
    .is("notified_at", null)
    .select("name,email,topic,message,created_at")
    .maybeSingle();
  if (claimError) return json({ error: "lookup_failed" }, 500);
  if (!msg) return json({ ok: true, skipped: true });

  try {
    const smtp = new SMTPClient({
      connection: {
        hostname: Deno.env.get("SMTP_HOST") || "smtp.zoho.com",
        port: Number(Deno.env.get("SMTP_PORT") || 465),
        tls: true,
        auth: { username: Deno.env.get("SMTP_USER")!, password: Deno.env.get("SMTP_PASSWORD")! },
      },
    });
    await smtp.send({
      from: `Just Africa contact form <${Deno.env.get("SMTP_USER")}>`,
      to: Deno.env.get("NOTIFY_TO")!,
      replyTo: oneLine(msg.email),
      subject: `[Just Africa] New contact message (${msg.topic})`,
      content:
        `From: ${oneLine(msg.name)} <${oneLine(msg.email)}>\n` +
        `Topic: ${msg.topic}\n` +
        `Received: ${msg.created_at}\n\n` +
        `${msg.message}\n\n` +
        `---\nReply to this email to answer the sender. Messages are also in the Just Africa admin dashboard.`,
    });
    await smtp.close();
    return json({ ok: true });
  } catch (_error) {
    // Release the claim so the message can be retried.
    await db.from("contact_messages").update({ notified_at: null }).eq("id", id);
    return json({ error: "send_failed" }, 502);
  }
});
