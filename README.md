# Doctors Query FMGE Academy — V18 SECURE DATABASE

This is the next step after V17 Secure Test.

## What changed
- Enrollment records are stored in SQLite (`data/fmge.db`) instead of `enrollments.json`.
- Payment signature is verified server-side.
- Order/payment amount and currency are checked server-side.
- Payment/order IDs are checked for consistency.
- Repeated verification of the same order is idempotent.
- Razorpay webhook endpoint is included for production deployment.
- The Key Secret remains server-side only.

## Local Test Mode
1. Install Node.js 22+.
2. Copy `.env.example` to `.env`.
3. Put your Razorpay Test Key ID and Test Key Secret in `.env`. Never send the Secret in chat or put it in the HTML.
4. Run `npm install`.
5. Run `npm start`.
6. Open `http://localhost:3000/`.
7. Complete the ₹999 Test payment.
8. The enrollment will be stored in `data/fmge.db`.
9. Health check: `http://localhost:3000/api/health`.

## Important
This is a secure database stage, not the final public production deployment. Before accepting real payments we still need a hosted database/server, HTTPS, exact production CORS, Razorpay Live keys, webhook configuration, backups, admin access controls, student authentication, and the student dashboard/content-delivery system.


## Admin Enrollment Dashboard
After adding `ADMIN_USER` and a strong private `ADMIN_PASSWORD` to `.env`, start the server and open `http://localhost:3000/admin`. The browser will ask for the admin username/password. The dashboard reads enrollment data from SQLite and includes search, status filters, summary counts, and CSV export. Never share the admin password or Razorpay Key Secret.
