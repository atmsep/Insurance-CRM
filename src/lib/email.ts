import "server-only";
import { Resend } from "resend";

let client: Resend | null = null;

function getResendClient(): Resend | null {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) return null;
  if (!client) client = new Resend(apiKey);
  return client;
}

function formatDate(value: string) {
  return new Date(value).toLocaleDateString("el-GR");
}

function renewalEmailHtml({
  clientName,
  policyNumber,
  lineName,
  carrierName,
  endDate,
  daysRemaining,
}: {
  clientName: string;
  policyNumber: string;
  lineName: string;
  carrierName: string;
  endDate: string;
  daysRemaining: number;
}) {
  const agencyName = process.env.AGENCY_NAME || "το ασφαλιστικό μας γραφείο";
  return `
    <div style="font-family: Arial, sans-serif; max-width: 560px; margin: 0 auto; color: #1a1a1a;">
      <p>Αγαπητέ/ή ${clientName},</p>
      <p>
        Θα θέλαμε να σας ενημερώσουμε ότι το ασφαλιστήριο συμβόλαιό σας
        <strong>${policyNumber}</strong> (${lineName}, ${carrierName}) λήγει στις
        <strong>${formatDate(endDate)}</strong> (σε ${daysRemaining} ημέρες).
      </p>
      <p>
        Για να διασφαλίσετε τη συνεχή κάλυψή σας, επικοινωνήστε μαζί μας το
        συντομότερο δυνατό για την ανανέωσή του.
      </p>
      <p style="margin-top: 24px;">Με εκτίμηση,<br />${agencyName}</p>
    </div>
  `;
}

export async function sendRenewalReminderEmail({
  to,
  clientName,
  policyNumber,
  lineName,
  carrierName,
  endDate,
  daysRemaining,
}: {
  to: string;
  clientName: string;
  policyNumber: string;
  lineName: string;
  carrierName: string;
  endDate: string;
  daysRemaining: number;
}): Promise<{ ok: boolean; error?: string }> {
  const resend = getResendClient();
  if (!resend) return { ok: false, error: "RESEND_API_KEY not configured" };

  const fromAddress = process.env.RESEND_FROM_EMAIL || "onboarding@resend.dev";

  const { error } = await resend.emails.send({
    from: fromAddress,
    to,
    subject: `Το ασφαλιστήριο σας ${policyNumber} λήγει σε ${daysRemaining} ημέρες`,
    html: renewalEmailHtml({ clientName, policyNumber, lineName, carrierName, endDate, daysRemaining }),
  });

  if (error) return { ok: false, error: error.message };
  return { ok: true };
}
