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
  SUPABASE_URL: 'https://sbqhuwedqnvsirazpanz.supabase.co',
  SUPABASE_ANON_KEY: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNicWh1d2VkcW52c2lyYXpwYW56Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODQ5MjMzMjMsImV4cCI6MjEwMDQ5OTMyM30.rpdSfS7ce44lgQhae_LgV9aKD-gDYkzR1C-ajPcN82c',

  // ── GAS Web App Proxy (สำหรับ Google Drive operations) ──
  // ใช้ผ่าน Netlify Proxy เพื่อแก้ปัญหา CORS
  GAS_API_URL: '/gas-api',

  // ── App Settings ──
  APP_NAME: 'ระบบสร้างเกียรติบัตรอัตโนมัติ',
  APP_VERSION: '2.0',
  SESSION_KEY: 'cert_session',
  USER_DATA_KEY: 'cert_user'
};
