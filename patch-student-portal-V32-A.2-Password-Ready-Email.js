const fs = require('fs');
const path = require('path');

const ROOT = __dirname;
const SERVER = path.join(ROOT, 'server.js');

if (!fs.existsSync(SERVER)) process.exit(0);

let server = fs.readFileSync(SERVER, 'utf8');

if (!server.includes('DQ_V32_A2_PASSWORD_READY_EMAIL')) {
  const marker = '// DQ_V32_A2_PASSWORD_READY_EMAIL';
  const helper = `
${marker}
async function v32A2SendPasswordReadyEmail(account) {
  if (!V32_RESEND_API_KEY || !V32_PASSWORD_EMAIL_FROM) {
    throw new Error('Password email delivery is not configured.');
  }

  const loginUrl = V32_PASSWORD_APP_URL.replace(/\\/$/, '') + '/student-login';
  const text = [
    'Doctors Query FMGE Academy',
    '',
    'Your password has been successfully created.',
    '',
    'Student ID: ' + account.student_id,
    '',
    'You can now log in to the Student Portal using your Student ID and the password you just created.',
    '',
    'Student Portal Login:',
    loginUrl,
    '',
    'Please keep your Student ID and password secure.',
    'If you did not make this password change, please contact Doctors Query FMGE Academy.'
  ].join('\\n');

  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Authorization': 'Bearer ' + V32_RESEND_API_KEY,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      from: V32_PASSWORD_EMAIL_FROM,
      to: [account.email],
      subject: 'Your FMGE Academy password is ready',
      text
    })
  });

  if (!response.ok) {
    const body = await response.text().catch(() => '');
    throw new Error('Password ready email delivery failed: ' + response.status + ' ' + body.slice(0, 300));
  }
}
`;

  const anchor = "app.post('/api/student/setup-password', v32PasswordCorsGuard, async (req, res) => {";
  if (!server.includes(anchor)) {
    console.error('V32-A.2 could not find setup-password route.');
    process.exit(1);
  }
  server = server.replace(anchor, helper + '\\n' + anchor);
}

if (!server.includes('DQ_V32_A2_SETUP_EMAIL_ATTACHED')) {
  const old = "    res.json({ ok: true, message: 'Password set successfully. Please sign in with your new password.' });";
  const replacement = `    try {
      await v32A2SendPasswordReadyEmail(account);
    } catch (emailError) {
      console.error('V32-A.2 password ready email warning:', emailError.message);
    }
    res.json({ ok: true, message: 'Password set successfully. A confirmation email with your Student ID and Student Portal login link has been sent.' });
    // DQ_V32_A2_SETUP_EMAIL_ATTACHED`;
  if (!server.includes(old)) {
    console.error('V32-A.2 could not find setup-password success response.');
    process.exit(1);
  }
  server = server.replace(old, replacement);
}

if (!server.includes('DQ_V32_A2_RESET_EMAIL_ATTACHED')) {
  const old = "    res.json({ ok: true, message: 'Password reset successfully. Please sign in with your new password.' });";
  const replacement = `    try {
      await v32A2SendPasswordReadyEmail(account);
    } catch (emailError) {
      console.error('V32-A.2 password reset email warning:', emailError.message);
    }
    res.json({ ok: true, message: 'Password reset successfully. A confirmation email with your Student ID and Student Portal login link has been sent.' });
    // DQ_V32_A2_RESET_EMAIL_ATTACHED`;
  if (!server.includes(old)) {
    console.error('V32-A.2 could not find reset-password success response.');
    process.exit(1);
  }
  server = server.replace(old, replacement);
}

if (!server.includes('DQ_V32_A2_CHANGE_EMAIL_ATTACHED')) {
  const old = `    res.clearCookie('dq_student_session', { httpOnly: true, secure: true, sameSite: 'lax', path: '/' });
    res.json({ ok: true, message: 'Password changed successfully. Please sign in again.' });`;
  const replacement = [
    "    res.clearCookie('dq_student_session', { httpOnly: true, secure: true, sameSite: 'lax', path: '/' });",
    "    try {",
    "      await v32A2SendPasswordReadyEmail(account);",
    "    } catch (emailError) {",
    "      console.error('V32-A.2 password change email warning:', emailError.message);",
    "    }",
    "    res.json({ ok: true, message: 'Password changed successfully. A confirmation email with your Student ID and Student Portal login link has been sent. Please sign in again.' });",
    "    // DQ_V32_A2_CHANGE_EMAIL_ATTACHED"
  ].join('\\n');
  if (!server.includes(old)) {
    console.error('V32-A.2 could not find change-password success response.');
    process.exit(1);
  }
  server = server.replace(old, replacement);
}

fs.writeFileSync(SERVER, server, 'utf8');
console.log('Applied Doctors Query FMGE Academy V32-A.2 password-ready confirmation email patch.');
