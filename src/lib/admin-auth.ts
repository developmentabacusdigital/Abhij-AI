/**
 * Admin Passcode Verification Helper
 */
export function checkAdminPasscode(providedKey: string): boolean {
  const envPass = (process.env.ADMIN_PASSWORD || 'admin123').trim();
  const key = (providedKey || '').trim();

  if (!key) return false;
  if (key === envPass) return true;

  // Tolerant match for default credentials (admin123 / Admin@123)
  if (
    (envPass === 'admin123' || envPass === 'Admin@123') &&
    (key === 'admin123' || key === 'Admin@123')
  ) {
    return true;
  }

  return false;
}
