/**
 * =========================================================================
 * CONFIG.JS — Supabase Configuration
 * =========================================================================
 * ⚠️ ใส่ค่าจริงจาก Supabase Dashboard → Settings → API
 *    - SUPABASE_URL: Project URL
 *    - SUPABASE_ANON_KEY: anon (public) key — ปลอดภัยที่จะเปิดเผย
 *
 * 📌 GAS_API_URL: URL ของ GAS Web App สำหรับ Drive operations
 *    (ยังใช้ GAS สำหรับ upload/download ไฟล์ Google Drive)
 * =========================================================================
 */

var APP_CONFIG = {
  // ── Supabase (เปลี่ยนค่านี้!) ──
  SUPABASE_URL: 'https://YOUR_PROJECT_REF.supabase.co',
  SUPABASE_ANON_KEY: 'YOUR_ANON_KEY_HERE',

  // ── GAS Web App Proxy (สำหรับ Google Drive operations) ──
  // ใช้ผ่าน Netlify Proxy เพื่อแก้ปัญหา CORS
  GAS_API_URL: '/gas-api',

  // ── App Settings ──
  APP_NAME: 'ระบบสร้างเกียรติบัตรอัตโนมัติ',
  APP_VERSION: '2.0',
  SESSION_KEY: 'cert_session',
  USER_DATA_KEY: 'cert_user'
};
