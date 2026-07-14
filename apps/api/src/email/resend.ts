import { Resend } from "resend";

export function claimEmailHtml(claimUrl: string): string {
  if (!/^https:\/\/[^\s#]+\/claim#p=[A-Za-z0-9_-]+$/.test(claimUrl)) {
    throw new Error("invalid claim URL");
  }
  return `<p>Someone sent you a private USDC payment on Monad.</p>
<p><a href="${claimUrl}">Claim your payment</a></p>
<p>This link is a bearer secret. Do not forward it. Wisp and the email provider can associate this delivery with your email.</p>`;
}

export async function sendClaimEmail(params: {
  apiKey: string;
  from: string;
  to: string;
  claimUrl: string;
}): Promise<{ id: string }> {
  const resend = new Resend(params.apiKey);
  const result = await resend.emails.send({
    from: params.from,
    to: params.to,
    subject: "You received a private payment on Wisp",
    html: claimEmailHtml(params.claimUrl),
  });
  if (result.error) {
    throw new Error(result.error.message);
  }
  return { id: result.data?.id ?? "unknown" };
}
