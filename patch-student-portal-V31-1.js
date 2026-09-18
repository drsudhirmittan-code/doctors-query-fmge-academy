const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const ROOT = __dirname;
const V31_PATCH = path.join(ROOT, 'patch-student-portal-V31-CORRECTED 2.js');

if (fs.existsSync(V31_PATCH)) require(V31_PATCH);

// V32-A is cumulative: apply it only after the V31.1/V31 server has been generated.
const V32_PATCH = path.join(ROOT, 'patch-student-portal-V32-A.js');
if (fs.existsSync(V32_PATCH)) require(V32_PATCH);

 // Email OTP registration flow was intentionally removed. Registration returns
 // to the original details -> payment flow; V32-A secure student passwords remain active.

const V32_A2_PASSWORD_READY_EMAIL_PATCH = path.join(ROOT, 'patch-student-portal-V32-A.2-Password-Ready-Email.js');
if (fs.existsSync(V32_A2_PASSWORD_READY_EMAIL_PATCH)) require(V32_A2_PASSWORD_READY_EMAIL_PATCH);


const serverFile = path.join(ROOT, 'server.js');
if (!fs.existsSync(serverFile)) process.exit(0);

let server = fs.readFileSync(serverFile, 'utf8');

if (!server.includes('DQ_STUDENT_PORTAL_V31_1')) {
  const marker = '// DQ_STUDENT_PORTAL_V31_1\n';

  const provisionCode = `
${marker}
async function provisionConfirmedStudentAccounts() {
  const rows = (await pool.query(
    "SELECT enrollment_id FROM enrollments WHERE status='confirmed' ORDER BY created_at ASC"
  )).rows;

  const output = [];

  for (const item of rows) {
    const enrollmentId = item.enrollment_id;
    const existing = (await pool.query(
      'SELECT * FROM student_accounts WHERE enrollment_id=$1 LIMIT 1',
      [enrollmentId]
    )).rows[0];

    if (!existing) {
      const created = await createStudentAccountForEnrollment(enrollmentId);
      if (created?.account) {
        output.push({
          enrollment_id: enrollmentId,
          student_id: created.account.student_id,
          name: created.account.name,
          email: created.account.email,
          status: 'created',
          temporary_password: created.temporaryPassword || null,
          access_expires_at: created.account.access_expires_at
        });
      }
      continue;
    }

    // Existing accounts get a fresh one-time temporary password so an admin
    // can recover access without requiring another payment.
    const temporaryPassword = randomTempPassword();
    const hp = await hashStudentPassword(temporaryPassword);
    await pool.query(
      'UPDATE student_accounts SET password_hash=$1,password_salt=$2,status=$3 WHERE student_id=$4',
      [hp.hash, hp.salt, 'active', existing.student_id]
    );

    const activationToken = crypto.randomBytes(32).toString('hex');
    await pool.query(
      'INSERT INTO student_activation_tokens (token_hash,student_id,temporary_password,expires_at) VALUES ($1,$2,$3,$4)',
      [
        hashSessionToken(activationToken),
        existing.student_id,
        temporaryPassword,
        new Date(Date.now() + 30 * 60 * 1000).toISOString()
      ]
    );

    output.push({
      enrollment_id: enrollmentId,
      student_id: existing.student_id,
      name: existing.name,
      email: existing.email,
      status: 'reset',
      temporary_password: temporaryPassword,
      access_expires_at: existing.access_expires_at
    });
  }

  return output;
}

app.get('/api/admin/provision-student-accounts', adminAuth, async (req, res) => {
  try {
    const accounts = await provisionConfirmedStudentAccounts();
    res.json({
      ok: true,
      message: 'Confirmed enrollments have been provisioned for Student Portal access.',
      accounts
    });
  } catch (e) {
    console.error('Student provisioning error:', e.message);
    res.status(500).json({ error: 'Unable to provision student accounts.' });
  }
});
`;

  const anchor = "app.use(express.static(__dirname));";
  if (server.includes(anchor)) {
    server = server.replace(anchor, provisionCode + "\n" + anchor);
  }

  fs.writeFileSync(serverFile, server, 'utf8');
  console.log('Applied Doctors Query FMGE Academy Student Portal V31.1 provisioning patch.');
}
