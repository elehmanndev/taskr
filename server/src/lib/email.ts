import { Resend } from 'resend'

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

const resend = new Resend(process.env.RESEND_API_KEY)

interface SendEmailOptions {
  to: string | string[]
  subject: string
  html: string
  from?: string
}

export async function sendEmail({ to, subject, html, from }: SendEmailOptions) {
  return resend.emails.send({
    from: from || process.env.EMAIL_FROM || 'Taskr <noreply@taskr.app>',
    to: Array.isArray(to) ? to : [to],
    subject,
    html,
  })
}

// ── Email templates ───────────────────────────────────────────────────────────

export function itemAssignedEmail(opts: {
  userName: string
  itemName: string
  boardName: string
  itemUrl: string
}) {
  return `
    <div style="font-family: sans-serif; max-width: 560px; margin: 0 auto;">
      <h2>You've been assigned to an item</h2>
      <p>Hi ${escapeHtml(opts.userName)},</p>
      <p>You've been assigned to <strong>${escapeHtml(opts.itemName)}</strong> on the <strong>${escapeHtml(opts.boardName)}</strong> board.</p>
      <a href="${escapeHtml(opts.itemUrl)}" style="
        display: inline-block;
        padding: 12px 24px;
        background: #0073EA;
        color: white;
        text-decoration: none;
        border-radius: 6px;
        margin-top: 16px;
      ">View Item</a>
    </div>
  `
}

export function dueDateEmail(opts: {
  userName: string
  itemName: string
  dueDate: string
  itemUrl: string
}) {
  return `
    <div style="font-family: sans-serif; max-width: 560px; margin: 0 auto;">
      <h2>⏰ Item due soon</h2>
      <p>Hi ${escapeHtml(opts.userName)},</p>
      <p><strong>${escapeHtml(opts.itemName)}</strong> is due on <strong>${escapeHtml(opts.dueDate)}</strong>.</p>
      <a href="${escapeHtml(opts.itemUrl)}" style="
        display: inline-block;
        padding: 12px 24px;
        background: #FDAB3D;
        color: white;
        text-decoration: none;
        border-radius: 6px;
        margin-top: 16px;
      ">View Item</a>
    </div>
  `
}
