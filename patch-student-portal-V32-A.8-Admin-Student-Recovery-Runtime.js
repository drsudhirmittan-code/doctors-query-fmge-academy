module.exports = function applyV32A8({ app, pool, adminAuth }) {
  if (!app || !pool || !adminAuth) {
    throw new Error('V32-A.8 runtime dependencies are missing.');
  }

  if (!app._dqV32A8AdminStudentAccounts) {
    app.get('/api/admin/student-accounts', adminAuth, async (req, res) => {
      try {
        const result = await pool.query(
          'SELECT student_id,name,university,status,access_expires_at,must_change_password,password_changed_at,created_at FROM student_accounts ORDER BY id DESC'
        );
        res.json({ accounts: result.rows });
      } catch (e) {
        console.error('Admin student accounts error:', e.message);
        res.status(500).json({ error: 'Unable to load student accounts.' });
      }
    });
    app._dqV32A8AdminStudentAccounts = true;
  }

  console.log('Applied Doctors Query FMGE Academy V32-A.8 admin student account recovery runtime patch.');
};
