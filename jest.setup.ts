import '@testing-library/jest-dom';

// Deterministic secrets: unconditionally override so real values from a local
// .env (loaded via next/jest) can never leak into tests and break HMAC helpers
// that sign with the test secret.
process.env.NEXTAUTH_SECRET = 'test-nextauth-secret';
process.env.N8N_INGRESS_SECRET = 'test-ingress-secret-for-hmac-verification';
process.env.N8N_RESUME_SECRET = 'test-resume-secret-for-hmac-verification';
process.env.N8N_BRIDGE_ENCRYPTION_KEY =
  '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';
process.env.CRON_SECRET = 'test-cron-secret';
