/**
 * Module purpose: Generates text and escaped HTML for account, reminder, and manual emails; protects messages against unintended HTML injection.
 */
import { env } from '../config/env';

export interface EmailContent {
  subject: string;
  html: string;
  text: string;
}

const escape = (s: string) =>
  s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);

function layout(title: string, bodyHtml: string, cta?: { label: string; url: string }): string {
  return `<!doctype html><html><body style="margin:0;background:#F6F7F5;font-family:Arial,Helvetica,sans-serif;color:#14233B">
<table width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:32px 12px">
<table width="560" cellpadding="0" cellspacing="0" style="background:#ffffff;border:1px solid #DDE2DC;border-radius:8px">
<tr><td style="padding:20px 28px;border-bottom:3px solid #1E6B4A;font-weight:bold;font-size:18px">${escape(env.APP_NAME)}</td></tr>
<tr><td style="padding:28px">
<h1 style="font-size:20px;margin:0 0 16px">${escape(title)}</h1>
<div style="font-size:15px;line-height:1.6">${bodyHtml}</div>
${cta ? `<p style="margin:28px 0 8px"><a href="${cta.url}" style="background:#1E6B4A;color:#ffffff;padding:12px 20px;border-radius:6px;text-decoration:none;font-weight:bold">${escape(cta.label)}</a></p>` : ''}
</td></tr>
<tr><td style="padding:16px 28px;font-size:12px;color:#5B6676;border-top:1px solid #DDE2DC">
SME Comply tracks deadlines and records filings. It does not submit filings to government agencies and is not legal advice.
</td></tr></table></td></tr></table></body></html>`;
}

function build(title: string, paragraphs: string[], cta?: { label: string; url: string }): EmailContent {
  const html = layout(title, paragraphs.map((p) => `<p style="margin:0 0 12px">${escape(p)}</p>`).join(''), cta);
  const text = [title, '', ...paragraphs, cta ? `\n${cta.label}: ${cta.url}` : ''].join('\n');
  return { subject: title, html, text };
}

const url = (path: string) => `${env.CLIENT_URL}${path}`;

export const emailTemplates = {
  welcome: (name: string) =>
    build(`Welcome to SME Comply, ${name}`, [
      'Your account is ready. Add your business to see which filings apply to you and when they are due.',
    ], { label: 'Add your business', url: url('/app/businesses/new') }),

  verifyEmail: (name: string, token: string) =>
    build('Confirm your email address', [
      `Hi ${name}, confirm your email so we can send your compliance reminders.`,
      'This link expires in 24 hours.',
    ], { label: 'Confirm email', url: url(`/verify-email?token=${token}`) }),

  passwordReset: (name: string, token: string) =>
    build('Reset your password', [
      `Hi ${name}, we received a request to reset your password.`,
      'This link expires in 1 hour. If you did not ask for this, you can ignore this email.',
    ], { label: 'Reset password', url: url(`/reset-password?token=${token}`) }),

  reminder: (p: { name: string; business: string; task: string; dueDate: string; daysLeft: number; taskId: string }) =>
    build(`${p.task} is due in ${p.daysLeft} day${p.daysLeft === 1 ? '' : 's'}`, [
      `Hi ${p.name}, ${p.business} has a filing due on ${p.dueDate}.`,
      'Open the task to see what is required and record the filing once it is done.',
    ], { label: 'Open task', url: url(`/app/tasks/${p.taskId}`) }),

  dueToday: (p: { name: string; business: string; task: string; taskId: string }) =>
    build(`${p.task} is due today`, [
      `Hi ${p.name}, today is the deadline for ${p.task} for ${p.business}.`,
    ], { label: 'Open task', url: url(`/app/tasks/${p.taskId}`) }),

  overdue: (p: { name: string; business: string; task: string; dueDate: string; daysOverdue: number; taskId: string }) =>
    build(`${p.task} is ${p.daysOverdue} day${p.daysOverdue === 1 ? '' : 's'} overdue`, [
      `Hi ${p.name}, ${p.task} for ${p.business} was due on ${p.dueDate} and has not been marked complete.`,
      'Late filings can attract penalties. If it has been filed, record the filing so your records are up to date.',
    ], { label: 'Record the filing', url: url(`/app/tasks/${p.taskId}`) }),

  taskCompleted: (p: { name: string; business: string; task: string; completedBy: string; taskId: string }) =>
    build(`${p.task} marked complete`, [`Hi ${p.name}, ${p.completedBy} marked ${p.task} complete for ${p.business}.`], {
      label: 'View task',
      url: url(`/app/tasks/${p.taskId}`),
    }),

  invitation: (p: { business: string; inviter: string; role: string; token?: string }) =>
    build(`You've been added to ${p.business}`, [
      `${p.inviter} added you to ${p.business} on SME Comply as ${p.role.replace('_', ' ').toLowerCase()}.`,
      p.token ? 'Create your account with this email address to get access.' : 'Sign in to see the business.',
    ], p.token ? { label: 'Accept invitation', url: url(`/register?invite=${p.token}`) } : { label: 'Sign in', url: url('/login') }),
};


// Manual messages use escaped text, with an optional small Markdown subset
// rendered to safe HTML (not arbitrary HTML supplied by an administrator).
const richLine = (line: string) => {
  const escaped = escape(line);
  return escaped
    .replace(/\[([^\]\n]{1,100})\]\((https?:\/\/[^\s<>&"']{1,500})\)/g,
      (_match, label: string, href: string) => `<a href="${href}" rel="noopener noreferrer">${label}</a>`)
    .replace(/\*\*([^*\n]+)\*\*/g, '<strong>$1</strong>')
    .replace(/\*([^*\n]+)\*/g, '<em>$1</em>');
};

/**
 * Builds a safe text/HTML message from an editable draft and optionally includes the selected compliance obligation.
 */
export function manualEmailTemplate(payload: {
  subject: string;
  message: string;
  format: 'TEXT' | 'RICH_TEXT';
  obligation?: { name: string; business: string; dueDate: string; details: string; taskId: string };
}): EmailContent {
  const htmlMessage = payload.message.split(/\r?\n/).map((line) =>
    payload.format === 'RICH_TEXT' ? richLine(line) : escape(line),
  ).join('<br>');
  const details = payload.obligation;
  const header = details
    ? `<div style="padding:14px;background:#F6F7F5;border-left:3px solid #1E6B4A;margin:0 0 20px">
       <strong>Compliance obligation:</strong> ${escape(details.name)}<br>
       <strong>Business:</strong> ${escape(details.business)}<br>
       <strong>Due date:</strong> ${escape(details.dueDate)}<br>
       <strong>Details:</strong> ${escape(details.details)}</div>`
    : '';
  const taskUrl = details ? url(`/app/tasks/${details.taskId}`) : undefined;
  const html = layout(payload.subject, `${header}<div style="white-space:normal">${htmlMessage}</div>`,
    taskUrl ? { label: 'View obligation', url: taskUrl } : undefined);
  const text = [
    payload.subject,
    ...(details ? ['', `Obligation: ${details.name}`, `Business: ${details.business}`,
      `Due date: ${details.dueDate}`, `Details: ${details.details}`] : []),
    '', payload.message,
    ...(taskUrl ? ['', `View obligation: ${taskUrl}`] : []),
  ].join('\n');
  return { subject: payload.subject, html, text };
}
