// =========================================================================
// 🚀 SETUP.GS — ตั้งค่าระบบฐานข้อมูล Supabase (กดครั้งเดียวจบ!)
// =========================================================================
// ระบบสร้างเกียรติบัตรอัตโนมัติ v2.0 (KRUSB92)
// Architecture: Netlify (Frontend) + Supabase (Database) + Google Drive (Files)
//
// 📌 วิธีใช้ (ง่ายมาก!):
//   1. เปิด Script Editor (Apps Script) ที่ผูกกับ Google Sheet เดิม
//   2. วาง Setup.gs นี้ทั้งหมด
//   3. กลับไปที่หน้า Google Sheet → คลิกเมนู "🚀 ตั้งค่าระบบ" → "🚀 Initial Setup"
//   4. กรอก Config ในฟอร์มที่ปรากฏ (เพียง 3 ช่องหลัก!)
//   5. กด "🚀 เริ่ม Setup" → ✅ เสร็จ!
//
//   ⚠️ ถ้ายังไม่เห็นเมนู → รีโหลดหน้า Google Sheet (เมนูจะสร้างอัตโนมัติ)
//
// 📌 ข้อมูลที่ต้องเตรียม (จาก Supabase Dashboard):
//   - SUPABASE_URL        → Settings → API → Project URL
//   - SUPABASE_SERVICE_KEY → Settings → API → service_role secret
//   - DB_PASSWORD          → รหัสที่ตั้งตอนสร้าง Supabase Project
//
// ═══════════════════════════════════════════════════════════════════════════


// =========================================================================
// 🎯 MAIN FUNCTIONS — ฟังก์ชันหลักที่ผู้ใช้เรียกได้
// =========================================================================

/**
 * 📌 onOpen() — สร้างเมนูอัตโนมัติใน Google Sheet
 * ทำงานทันทีที่เปิด Spreadsheet — ไม่ต้องเรียกเอง
 */
function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu('🚀 ตั้งค่าระบบ')
    .addItem('🚀 Initial Setup (กดครั้งเดียวจบ!)', 'initialSetup')
    .addItem('🔍 ทดสอบ Connection', 'testConnection')
    .addItem('📊 ดูสถานะ Setup', 'viewSetupStatus')
    .addSeparator()
    .addItem('⚙️ ตั้งค่า Config', 'setupConfig')
    .addItem('🗑️ Reset (อันตราย!)', 'resetSetup')
    .addToUi();
}

/**
 * 🚀 initialSetup() — กดครั้งเดียวจบ!
 * 
 * สร้างทุกอย่างที่ต้องการ:
 *   ✅ 6 ตาราง + 12 Indexes
 *   ✅ 11 Database Functions + 5 Triggers
 *   ✅ 17 RLS Policies + Grants
 *   ✅ Seed Data (14 Settings)
 *   ✅ Admin User (Supabase Auth)
 *   ✅ Google Drive Folders (5 โฟลเดอร์)
 *   ✅ บันทึก Drive Folder IDs กลับ Supabase
 */
function initialSetup() {
  // ── 0. โหลด Config (ถ้ายังไม่มี → เปิดฟอร์มให้กรอก) ──
  var config = _getConfig();
  if (!config) {
    _showConfigDialog();
    return; // Dialog จะเรียก _saveConfigAndSetup() เมื่อกรอกเสร็จ
  }

  _runSetup(config);
}


/**
 * 🚀 _runSetup() — ฟังก์ชันหลักที่ทำงานจริง (เรียกจาก initialSetup หรือ dialog)
 */
function _runSetup(config) {
  var startTime = Date.now();
  _log('🚀 ═══════════════════════════════════════════════');
  _log('🚀 เริ่ม Setup — ระบบสร้างเกียรติบัตร v2.0');
  _log('🚀 ═══════════════════════════════════════════════');

  // ── 1. ทดสอบ + สร้าง Connection ──
  _log('');
  _log('📡 Step 1/6: เชื่อมต่อฐานข้อมูล...');
  var conn = _getJdbcConnection(config);

  // ── Guard: ตรวจว่าเคย Setup แล้วหรือยัง ──
  if (_isAlreadySetup(conn)) {
    conn.close();
    _log('');
    _log('⚠️ ═══════════════════════════════════════════════');
    _log('⚠️ ระบบเคยถูก Setup แล้ว!');
    _log('⚠️ ถ้าต้องการ Setup ใหม่ ให้รัน resetSetup() ก่อน');
    _log('⚠️ ═══════════════════════════════════════════════');
    return;
  }

  _log('✅ เชื่อมต่อสำเร็จ!');

  try {
    // ── 2. สร้าง Database Schema ──
    _log('');
    _log('🗄️ Step 2/6: สร้างฐานข้อมูล...');
    _setupDatabase(conn);

    // ── 3. สร้าง Admin User ──
    _log('');
    _log('👤 Step 3/6: สร้าง Admin User...');
    var adminUserId = _createAdminUser(config);

    // ── 4. ตั้ง Admin Role ──
    _log('');
    _log('🔐 Step 4/6: ตั้งสิทธิ์ Admin...');
    if (adminUserId) {
      _setAdminRole(conn, adminUserId, config);
    }

    // ── 5. สร้าง Google Drive Folders ──
    _log('');
    _log('📁 Step 5/6: สร้าง Google Drive Folders...');
    var folders = _setupDriveFolders();

    // ── 6. บันทึก Drive Config กลับ Supabase ──
    _log('');
    _log('💾 Step 6/6: บันทึก Config...');
    _saveDriveConfig(conn, folders);

  } catch (e) {
    _log('');
    _log('❌ ═══════════════════════════════════════════════');
    _log('❌ ERROR: ' + e.message);
    _log('❌ ═══════════════════════════════════════════════');
    throw e;
  } finally {
    conn.close();
  }

  // ── สรุป ──
  var elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
  _log('');
  _log('🎉 ═══════════════════════════════════════════════');
  _log('🎉 Setup เสร็จสมบูรณ์! (' + elapsed + ' วินาที)');
  _log('🎉 ═══════════════════════════════════════════════');
  _log('');
  _log('📌 สิ่งที่สร้างแล้ว:');
  _log('   ✅ 6 ตาราง + 12 Indexes');
  _log('   ✅ 11 Functions + 5 Triggers');
  _log('   ✅ 17 RLS Policies + Grants');
  _log('   ✅ 14 Settings (Seed Data)');
  _log('   ✅ 1 View (templates_with_counts)');
  _log('   ✅ Admin User: ' + config.adminEmail);
  _log('   ✅ Google Drive: ' + folders.rootUrl);
  _log('');
  _log('📌 ขั้นตอนถัดไป:');
  _log('   1. คัดลอก SUPABASE_URL + SUPABASE_ANON_KEY');
  _log('   2. นำไปใส่ใน Frontend (js/api.js + health.html)');
  _log('   3. Deploy ไป Netlify');
  _log('   ⚠️  เปลี่ยนรหัสผ่าน Admin ทันทีหลังเข้าสู่ระบบ!');
}


/**
 * 🔍 testConnection() — ทดสอบการเชื่อมต่อ Supabase
 * รันก่อน initialSetup() เพื่อตรวจสอบว่า config ถูกต้อง
 */
function testConnection() {
  _log('🔍 ทดสอบการเชื่อมต่อ Supabase...');
  var config = _getConfig();
  
  // Test JDBC
  try {
    var conn = _getJdbcConnection(config);
    var stmt = conn.createStatement();
    var rs = stmt.executeQuery('SELECT version()');
    if (rs.next()) {
      _log('✅ JDBC: ' + rs.getString(1));
    }
    rs.close();
    stmt.close();
    
    // Test existing tables
    var rs2 = conn.createStatement().executeQuery(
      "SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' ORDER BY table_name"
    );
    var tables = [];
    while (rs2.next()) { tables.push(rs2.getString(1)); }
    rs2.close();
    
    if (tables.length > 0) {
      _log('📊 ตารางที่มีอยู่: ' + tables.join(', '));
    } else {
      _log('📊 ยังไม่มีตารางใน schema public (พร้อม Setup!)');
    }
    
    conn.close();
  } catch (e) {
    _log('❌ JDBC Error: ' + e.message);
    _log('');
    _log('💡 ตรวจสอบ:');
    _log('   - DB_HOST ถูกต้อง? (ต้องเป็น db.xxxxx.supabase.co)');
    _log('   - DB_PASSWORD ถูกต้อง?');
    _log('   - DB_PORT = 5432?');
    return;
  }
  
  // Test REST API
  try {
    var url = config.supabaseUrl + '/rest/v1/';
    var resp = UrlFetchApp.fetch(url, {
      headers: {
        'apikey': config.serviceKey,
        'Authorization': 'Bearer ' + config.serviceKey
      },
      muteHttpExceptions: true
    });
    _log('✅ REST API: HTTP ' + resp.getResponseCode());
  } catch (e) {
    _log('❌ REST API Error: ' + e.message);
  }
  
  _log('');
  _log('🔍 ทดสอบเสร็จสิ้น');
}


/**
 * 📊 viewSetupStatus() — ดูสถานะ Setup ปัจจุบัน
 */
function viewSetupStatus() {
  _log('📊 ตรวจสอบสถานะ Setup...');
  var config = _getConfig();
  var conn;

  try {
    conn = _getJdbcConnection(config);
  } catch (e) {
    _log('❌ ไม่สามารถเชื่อมต่อได้: ' + e.message);
    return;
  }

  try {
    // Check tables
    var rs = conn.createStatement().executeQuery(
      "SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' ORDER BY table_name"
    );
    var tables = [];
    while (rs.next()) { tables.push(rs.getString(1)); }
    rs.close();
    _log('📊 ตาราง (' + tables.length + '): ' + (tables.join(', ') || 'ไม่มี'));

    // Check row counts
    var expected = ['user_profiles', 'templates', 'records', 'settings', 'export_logs', 'login_logs'];
    expected.forEach(function(tbl) {
      if (tables.indexOf(tbl) !== -1) {
        var rs2 = conn.createStatement().executeQuery('SELECT COUNT(*) FROM ' + tbl);
        rs2.next();
        _log('   - ' + tbl + ': ' + rs2.getInt(1) + ' rows');
        rs2.close();
      }
    });

    // Check settings
    if (tables.indexOf('settings') !== -1) {
      var rs3 = conn.createStatement().executeQuery(
        "SELECT value FROM settings WHERE key = 'version'"
      );
      if (rs3.next()) {
        _log('📊 Version: ' + rs3.getString(1));
      }
      rs3.close();
      
      var rs4 = conn.createStatement().executeQuery(
        "SELECT value FROM settings WHERE key = 'drive_root_folder_id'"
      );
      if (rs4.next() && rs4.getString(1)) {
        _log('📊 Drive Root: ' + rs4.getString(1));
      }
      rs4.close();
    }

  } catch (e) {
    _log('❌ Error: ' + e.message);
  } finally {
    conn.close();
  }
}


/**
 * 🗑️ resetSetup() — ลบทุกอย่างแล้วเริ่มใหม่
 * ⚠️ อันตราย! ข้อมูลทั้งหมดจะหายไป!
 */
function resetSetup() {
  var ui = SpreadsheetApp.getUi();
  var result = ui.alert(
    '⚠️ คำเตือน — ลบทุกอย่าง!',
    'การดำเนินการนี้จะ:\n' +
    '• ลบตาราง 6 ตาราง + ข้อมูลทั้งหมด\n' +
    '• ลบ Functions, Triggers, RLS Policies\n' +
    '• ลบ Views\n\n' +
    'ข้อมูลทั้งหมดจะหายไปอย่างถาวร!\n\n' +
    'ต้องการดำเนินการต่อหรือไม่?',
    ui.ButtonSet.YES_NO
  );

  if (result !== ui.Button.YES) {
    _log('❌ ยกเลิก resetSetup()');
    return;
  }

  _log('🗑️ กำลัง Reset...');
  var config = _getConfig();
  var conn = _getJdbcConnection(config);

  try {
    var dropStatements = [
      // Drop views
      'DROP VIEW IF EXISTS templates_with_counts CASCADE',
      // Drop triggers
      "DROP TRIGGER IF EXISTS set_updated_at_user_profiles ON user_profiles",
      "DROP TRIGGER IF EXISTS set_updated_at_templates ON templates",
      "DROP TRIGGER IF EXISTS set_updated_at_records ON records",
      "DROP TRIGGER IF EXISTS set_updated_at_settings ON settings",
      "DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users",
      // Drop tables (reverse order)
      'DROP TABLE IF EXISTS login_logs CASCADE',
      'DROP TABLE IF EXISTS export_logs CASCADE',
      'DROP TABLE IF EXISTS settings CASCADE',
      'DROP TABLE IF EXISTS records CASCADE',
      'DROP TABLE IF EXISTS templates CASCADE',
      'DROP TABLE IF EXISTS user_profiles CASCADE',
      // Drop functions
      'DROP FUNCTION IF EXISTS trigger_set_updated_at CASCADE',
      'DROP FUNCTION IF EXISTS handle_new_user CASCADE',
      'DROP FUNCTION IF EXISTS auth_user_role CASCADE',
      'DROP FUNCTION IF EXISTS get_next_cert_number CASCADE',
      'DROP FUNCTION IF EXISTS batch_generate_cert_numbers CASCADE',
      'DROP FUNCTION IF EXISTS get_dashboard_stats CASCADE',
      'DROP FUNCTION IF EXISTS switch_template_context CASCADE',
      'DROP FUNCTION IF EXISTS guest_search_certificates CASCADE',
      'DROP FUNCTION IF EXISTS log_activity CASCADE',
      'DROP FUNCTION IF EXISTS health_check CASCADE',
      'DROP FUNCTION IF EXISTS batch_update_cert_status CASCADE',
      'DROP FUNCTION IF EXISTS get_public_template_list CASCADE'
    ];

    _executeSql(conn, dropStatements, 'Reset Database');
    _log('✅ Reset เสร็จสมบูรณ์ — พร้อม initialSetup() ใหม่');

  } catch (e) {
    _log('❌ Reset Error: ' + e.message);
  } finally {
    conn.close();
  }
}


// =========================================================================
// 🔧 INTERNAL FUNCTIONS
// =========================================================================

/**
 * โหลด Config จาก Script Properties
 * คืนค่า null ถ้ายังไม่ได้ตั้งค่า (จะเปิด dialog แทน)
 */
function _getConfig() {
  var props = PropertiesService.getScriptProperties();
  var config = {
    supabaseUrl:   props.getProperty('SUPABASE_URL') || '',
    serviceKey:    props.getProperty('SUPABASE_SERVICE_KEY') || '',
    dbHost:        props.getProperty('DB_HOST') || '',
    dbPort:        props.getProperty('DB_PORT') || '5432',
    dbPassword:    props.getProperty('DB_PASSWORD') || '',
    adminEmail:    props.getProperty('ADMIN_EMAIL') || 'admin@cert.local',
    adminPassword: props.getProperty('ADMIN_PASSWORD') || 'Admin1234!',
    adminDisplay:  props.getProperty('ADMIN_DISPLAY_NAME') || 'ผู้ดูแลระบบ'
  };

  // ถ้ายังไม่มี config หลัก → return null (ให้เปิด dialog)
  if (!config.supabaseUrl || !config.serviceKey || !config.dbPassword) {
    return null;
  }

  // Auto-derive DB_HOST จาก SUPABASE_URL ถ้ายังไม่ได้ตั้ง
  if (!config.dbHost && config.supabaseUrl) {
    var ref = config.supabaseUrl.replace('https://', '').replace('.supabase.co', '').replace('/', '');
    config.dbHost = 'db.' + ref + '.supabase.co';
  }

  return config;
}


/**
 * ⚙️ setupConfig() — เปิดฟอร์มตั้งค่า Config
 * ผู้ใช้สามารถเรียกโดยตรงได้ หรือ initialSetup() จะเรียกให้อัตโนมัติ
 */
function setupConfig() {
  _showConfigDialog();
}


/**
 * แสดง HTML Dialog สำหรับกรอก Config
 */
function _showConfigDialog() {
  try {
    var html = HtmlService.createHtmlOutput(_getConfigDialogHtml())
      .setWidth(520)
      .setHeight(620);
    SpreadsheetApp.getUi().showModalDialog(html, '🚀 ตั้งค่า Supabase — ระบบสร้างเกียรติบัตร');
    _log('');
    _log('📌 ═══════════════════════════════════════════════');
    _log('📌 ฟอร์มตั้งค่าถูกเปิดแล้ว!');
    _log('📌 กรุณาสลับไปที่หน้า Google Sheet เพื่อกรอกข้อมูล');
    _log('📌 ═══════════════════════════════════════════════');
  } catch (e) {
    // Fallback: ถ้าเปิด dialog ไม่ได้ → ใช้ prompt ถามทีละช่อง
    _log('⚠️ Dialog ไม่สามารถเปิดได้ — ใช้การถามทีละช่องแทน');
    _setupConfigViaPrompts();
  }
}


/**
 * Fallback: ถามทีละช่องผ่าน prompt() — ใช้เมื่อ dialog เปิดไม่ได้
 * (เช่น รันจาก Script Editor โดยตรง)
 */
function _setupConfigViaPrompts() {
  var ui = SpreadsheetApp.getUi();

  _log('');
  _log('📝 กรอกข้อมูล Supabase (3 ช่อง):');

  // 1. SUPABASE_URL
  var r1 = ui.prompt(
    '🔑 Supabase URL',
    'วาง Project URL จาก Dashboard → Settings → API\n\nตัวอย่าง: https://abcdefg.supabase.co',
    ui.ButtonSet.OK_CANCEL
  );
  if (r1.getSelectedButton() !== ui.Button.OK || !r1.getResponseText().trim()) {
    _log('❌ ยกเลิก'); return;
  }
  var supabaseUrl = r1.getResponseText().trim().replace(/\/+$/, '');

  // 2. SERVICE_KEY
  var r2 = ui.prompt(
    '🔑 Service Role Key',
    'วาง service_role secret จาก Dashboard → Settings → API\n\n⚠️ ห้ามเผยแพร่ key นี้!',
    ui.ButtonSet.OK_CANCEL
  );
  if (r2.getSelectedButton() !== ui.Button.OK || !r2.getResponseText().trim()) {
    _log('❌ ยกเลิก'); return;
  }
  var serviceKey = r2.getResponseText().trim();

  // 3. DB_PASSWORD
  var r3 = ui.prompt(
    '🔑 Database Password',
    'รหัสที่ตั้งตอนสร้าง Supabase Project\n\n(Settings → Database → Reset password ถ้าลืม)',
    ui.ButtonSet.OK_CANCEL
  );
  if (r3.getSelectedButton() !== ui.Button.OK || !r3.getResponseText().trim()) {
    _log('❌ ยกเลิก'); return;
  }
  var dbPassword = r3.getResponseText().trim();

  // Validate URL
  if (!supabaseUrl.startsWith('https://') || !supabaseUrl.includes('supabase.co')) {
    _log('❌ URL ไม่ถูกต้อง — ต้องเป็น https://xxxxx.supabase.co');
    ui.alert('❌ URL ไม่ถูกต้อง', 'ต้องเป็น https://xxxxx.supabase.co', ui.ButtonSet.OK);
    return;
  }

  // บันทึกแล้วรัน setup
  _saveConfigAndSetup({
    supabaseUrl: supabaseUrl,
    serviceKey: serviceKey,
    dbPassword: dbPassword,
    dbPort: '5432',
    adminEmail: 'admin@cert.local',
    adminPassword: 'Admin1234!',
    adminDisplay: 'ผู้ดูแลระบบ'
  });
}


/**
 * บันทึก Config จาก Dialog แล้วรัน Setup
 * (เรียกจาก google.script.run ใน Dialog)
 */
function _saveConfigAndSetup(formData) {
  var props = PropertiesService.getScriptProperties();

  // Auto-derive DB_HOST จาก URL
  var ref = formData.supabaseUrl.replace('https://', '').replace('.supabase.co', '').replace('/', '');
  var dbHost = 'db.' + ref + '.supabase.co';

  // บันทึกลง Script Properties
  props.setProperties({
    'SUPABASE_URL': formData.supabaseUrl.replace(/\/+$/, ''),
    'SUPABASE_SERVICE_KEY': formData.serviceKey,
    'DB_HOST': dbHost,
    'DB_PORT': formData.dbPort || '5432',
    'DB_PASSWORD': formData.dbPassword,
    'ADMIN_EMAIL': formData.adminEmail || 'admin@cert.local',
    'ADMIN_PASSWORD': formData.adminPassword || 'Admin1234!',
    'ADMIN_DISPLAY_NAME': formData.adminDisplay || 'ผู้ดูแลระบบ'
  });

  _log('✅ บันทึก Config สำเร็จ');
  _log('   SUPABASE_URL: ' + formData.supabaseUrl);
  _log('   DB_HOST: ' + dbHost);
  _log('   ADMIN_EMAIL: ' + (formData.adminEmail || 'admin@cert.local'));

  // โหลด config ใหม่แล้วรัน setup
  var config = _getConfig();
  if (config) {
    _runSetup(config);
  }
}


/**
 * HTML สำหรับ Config Dialog
 * เพียง 3 ช่องหลัก! (URL, Service Key, DB Password)
 * ที่เหลือ auto-derive หรือใช้ค่า default
 */
function _getConfigDialogHtml() {
  // โหลด config ที่มีอยู่ (ถ้ามี)
  var props = PropertiesService.getScriptProperties();
  var existing = {
    url: props.getProperty('SUPABASE_URL') || '',
    key: props.getProperty('SUPABASE_SERVICE_KEY') || '',
    pass: props.getProperty('DB_PASSWORD') || '',
    email: props.getProperty('ADMIN_EMAIL') || 'admin@cert.local',
    adminPass: props.getProperty('ADMIN_PASSWORD') || 'Admin1234!',
    display: props.getProperty('ADMIN_DISPLAY_NAME') || 'ผู้ดูแลระบบ'
  };

  return '<html><head>' +
    '<style>' +
    '* { margin: 0; padding: 0; box-sizing: border-box; }' +
    'body { font-family: "Google Sans", Roboto, sans-serif; background: #1a1a2e; color: #e8e8e8; padding: 20px; }' +
    '.section { margin-bottom: 16px; }' +
    '.section-title { font-size: 13px; font-weight: 600; color: #3ECF8E; margin-bottom: 8px; display: flex; align-items: center; gap: 6px; }' +
    'label { display: block; font-size: 12px; color: #8892b0; margin-bottom: 4px; }' +
    'input, select { width: 100%; padding: 8px 12px; background: #16213e; border: 1px solid #233554; border-radius: 8px; color: #e8e8e8; font-size: 13px; outline: none; margin-bottom: 10px; font-family: monospace; }' +
    'input:focus { border-color: #3ECF8E; box-shadow: 0 0 0 2px rgba(62,207,142,0.15); }' +
    'input.required { border-left: 3px solid #3ECF8E; }' +
    '.hint { font-size: 11px; color: #556677; margin-top: -6px; margin-bottom: 8px; }' +
    '.toggle-btn { background: none; border: 1px solid #233554; color: #8892b0; padding: 4px 10px; border-radius: 6px; cursor: pointer; font-size: 11px; margin-bottom: 12px; }' +
    '.toggle-btn:hover { border-color: #3ECF8E; color: #3ECF8E; }' +
    '.advanced { display: none; }' +
    '.btn-setup { width: 100%; padding: 12px; background: linear-gradient(135deg, #2B9B6A, #3ECF8E); color: #fff; border: none; border-radius: 10px; font-size: 15px; font-weight: 600; cursor: pointer; margin-top: 8px; }' +
    '.btn-setup:hover { transform: translateY(-1px); box-shadow: 0 4px 16px rgba(62,207,142,0.3); }' +
    '.btn-setup:disabled { opacity: 0.5; cursor: not-allowed; transform: none; }' +
    '.status { text-align: center; padding: 12px; font-size: 13px; display: none; }' +
    '.badge { display: inline-block; background: rgba(62,207,142,0.15); color: #3ECF8E; padding: 2px 8px; border-radius: 4px; font-size: 11px; }' +
    'hr { border: none; border-top: 1px solid #233554; margin: 12px 0; }' +
    '</style>' +
    '</head><body>' +

    '<div class="section">' +
    '  <div class="section-title">🔑 Supabase Credentials <span class="badge">จำเป็น</span></div>' +
    '  <label>Project URL</label>' +
    '  <input type="text" id="supabaseUrl" class="required" placeholder="https://abcdefg.supabase.co" value="' + existing.url + '">' +
    '  <div class="hint">Dashboard → Settings → API → Project URL</div>' +
    '  <label>Service Role Key (secret)</label>' +
    '  <input type="password" id="serviceKey" class="required" placeholder="eyJhbGciOiJIUzI1NiIs..." value="' + existing.key + '">' +
    '  <div class="hint">Dashboard → Settings → API → service_role (⚠️ ห้ามเผยแพร่!)</div>' +
    '  <label>Database Password</label>' +
    '  <input type="password" id="dbPassword" class="required" placeholder="รหัสที่ตั้งตอนสร้าง Project" value="' + existing.pass + '">' +
    '  <div class="hint">ตั้งตอนสร้าง Supabase Project (Settings → Database → Reset password ถ้าลืม)</div>' +
    '</div>' +

    '<hr>' +

    '<button class="toggle-btn" onclick="document.querySelector(\'.advanced\').style.display=document.querySelector(\'.advanced\').style.display===\'none\'?\'block\':\'none\'">⚙️ ตั้งค่าเพิ่มเติม (ไม่จำเป็น)</button>' +

    '<div class="advanced">' +
    '  <div class="section">' +
    '    <div class="section-title">👤 Admin Account</div>' +
    '    <label>Email</label>' +
    '    <input type="email" id="adminEmail" placeholder="admin@cert.local" value="' + existing.email + '">' +
    '    <label>Password</label>' +
    '    <input type="text" id="adminPassword" placeholder="Admin1234!" value="' + existing.adminPass + '">' +
    '    <label>ชื่อที่แสดง</label>' +
    '    <input type="text" id="adminDisplay" placeholder="ผู้ดูแลระบบ" value="' + existing.display + '">' +
    '  </div>' +
    '  <div class="section">' +
    '    <div class="section-title">🗄️ Database (auto-detect)</div>' +
    '    <label>DB Port</label>' +
    '    <input type="text" id="dbPort" placeholder="5432" value="5432">' +
    '    <div class="hint">DB Host จะถูกสร้างอัตโนมัติจาก Project URL</div>' +
    '  </div>' +
    '</div>' +

    '<button class="btn-setup" id="btnSetup" onclick="submitConfig()">🚀 เริ่ม Setup</button>' +
    '<div class="status" id="status">⏳ กำลังตั้งค่า... กรุณารอสักครู่</div>' +

    '<script>' +
    'function submitConfig() {' +
    '  var url = document.getElementById("supabaseUrl").value.trim();' +
    '  var key = document.getElementById("serviceKey").value.trim();' +
    '  var pass = document.getElementById("dbPassword").value.trim();' +
    '  if (!url || !key || !pass) { alert("กรุณากรอกข้อมูล 3 ช่องที่จำเป็น!"); return; }' +
    '  if (!url.startsWith("https://") || !url.includes("supabase.co")) { alert("URL ไม่ถูกต้อง ต้องเป็น https://xxxxx.supabase.co"); return; }' +
    '  document.getElementById("btnSetup").disabled = true;' +
    '  document.getElementById("btnSetup").textContent = "⏳ กำลังทำงาน...";' +
    '  document.getElementById("status").style.display = "block";' +
    '  var formData = {' +
    '    supabaseUrl: url,' +
    '    serviceKey: key,' +
    '    dbPassword: pass,' +
    '    dbPort: document.getElementById("dbPort").value || "5432",' +
    '    adminEmail: document.getElementById("adminEmail").value || "admin@cert.local",' +
    '    adminPassword: document.getElementById("adminPassword").value || "Admin1234!",' +
    '    adminDisplay: document.getElementById("adminDisplay").value || "ผู้ดูแลระบบ"' +
    '  };' +
    '  google.script.run' +
    '    .withSuccessHandler(function() {' +
    '      document.getElementById("status").innerHTML = "✅ Setup เสร็จสมบูรณ์! ปิดหน้าต่างนี้ได้เลย";' +
    '      document.getElementById("status").style.color = "#3ECF8E";' +
    '      document.getElementById("btnSetup").textContent = "✅ เสร็จแล้ว!";' +
    '    })' +
    '    .withFailureHandler(function(err) {' +
    '      document.getElementById("status").innerHTML = "❌ Error: " + err.message;' +
    '      document.getElementById("status").style.color = "#EF4444";' +
    '      document.getElementById("btnSetup").disabled = false;' +
    '      document.getElementById("btnSetup").textContent = "🔄 ลองอีกครั้ง";' +
    '    })' +
    '    ._saveConfigAndSetup(formData);' +
    '}' +
    '</script>' +

    '</body></html>';
}


/**
 * สร้าง JDBC Connection
 */
function _getJdbcConnection(config) {
  var url = 'jdbc:postgresql://' + config.dbHost + ':' + config.dbPort + '/postgres';
  try {
    var conn = Jdbc.getConnection(url, 'postgres', config.dbPassword);
    return conn;
  } catch (e) {
    throw new Error(
      'ไม่สามารถเชื่อมต่อ Supabase ได้!\n' +
      'Host: ' + config.dbHost + ':' + config.dbPort + '\n' +
      'Error: ' + e.message + '\n\n' +
      '💡 ตรวจสอบ: DB_HOST, DB_PORT, DB_PASSWORD ใน Script Properties'
    );
  }
}


/**
 * ตรวจว่าเคย Setup แล้วหรือยัง
 */
function _isAlreadySetup(conn) {
  try {
    var rs = conn.createStatement().executeQuery(
      "SELECT COUNT(*) FROM information_schema.tables " +
      "WHERE table_schema = 'public' AND table_name = 'settings'"
    );
    rs.next();
    var exists = rs.getInt(1) > 0;
    rs.close();

    if (exists) {
      // ตรวจว่ามี version key ด้วย
      var rs2 = conn.createStatement().executeQuery(
        "SELECT value FROM settings WHERE key = 'version'"
      );
      if (rs2.next()) {
        _log('⚠️ พบระบบ version ' + rs2.getString(1) + ' อยู่แล้ว');
        rs2.close();
        return true;
      }
      rs2.close();
    }
    return false;
  } catch (e) {
    return false;
  }
}


/**
 * รัน SQL statements ทีละตัว พร้อม logging
 */
function _executeSql(conn, statements, sectionName) {
  _log('   📌 ' + sectionName + ' (' + statements.length + ' statements)...');
  var stmt = conn.createStatement();

  for (var i = 0; i < statements.length; i++) {
    try {
      stmt.execute(statements[i]);
    } catch (e) {
      // ข้าม error ที่ไม่สำคัญ (เช่น already exists)
      var msg = e.message || '';
      if (msg.indexOf('already exists') !== -1 ||
          msg.indexOf('does not exist') !== -1) {
        // OK — ข้าม
      } else {
        _log('   ❌ Error [' + sectionName + ' #' + (i + 1) + ']: ' + msg);
        _log('   SQL: ' + statements[i].substring(0, 100) + '...');
        throw e;
      }
    }
  }

  stmt.close();
  _log('   ✅ ' + sectionName + ' — สำเร็จ');
}


// =========================================================================
// 🗄️ DATABASE SETUP
// =========================================================================

function _setupDatabase(conn) {
  // Execute in order: Extensions → Tables → Indexes → Functions → Triggers → RLS → Grants → Seed → Views

  _executeSql(conn, _SQL_EXTENSIONS(), 'Extensions');
  _executeSql(conn, _SQL_TABLES(), 'Tables (6)');
  _executeSql(conn, _SQL_INDEXES(), 'Indexes (12)');
  _executeSql(conn, _SQL_FUNCTIONS(), 'Functions (11)');
  _executeSql(conn, _SQL_TRIGGERS(), 'Triggers (5)');
  _executeSql(conn, _SQL_RLS(), 'RLS Policies (17)');
  _executeSql(conn, _SQL_GRANTS(), 'Grants');
  _executeSql(conn, _SQL_SEED(), 'Seed Data');
  _executeSql(conn, _SQL_VIEWS(), 'Views (1)');

  _log('   🗄️ Database Setup — เสร็จสมบูรณ์!');
}


// =========================================================================
// 👤 ADMIN USER (Supabase Auth REST API)
// =========================================================================

function _createAdminUser(config) {
  var url = config.supabaseUrl + '/auth/v1/admin/users';

  var payload = {
    email: config.adminEmail,
    password: config.adminPassword,
    email_confirm: true,
    user_metadata: {
      username: config.adminEmail.split('@')[0],
      display_name: config.adminDisplay,
      role: 'admin'
    }
  };

  try {
    var resp = UrlFetchApp.fetch(url, {
      method: 'post',
      headers: {
        'apikey': config.serviceKey,
        'Authorization': 'Bearer ' + config.serviceKey,
        'Content-Type': 'application/json'
      },
      payload: JSON.stringify(payload),
      muteHttpExceptions: true
    });

    var code = resp.getResponseCode();
    var body = JSON.parse(resp.getContentText());

    if (code === 200 || code === 201) {
      _log('   ✅ สร้าง Admin User สำเร็จ: ' + config.adminEmail);
      _log('   🔑 User ID: ' + body.id);
      return body.id;
    } else if (body.msg && body.msg.indexOf('already') !== -1) {
      _log('   ⚠️ Admin User มีอยู่แล้ว — ข้าม');
      // ดึง user id ที่มีอยู่
      return _getExistingUserId(config);
    } else {
      _log('   ❌ สร้าง Admin User ล้มเหลว: ' + JSON.stringify(body));
      return null;
    }
  } catch (e) {
    _log('   ❌ Auth API Error: ' + e.message);
    return null;
  }
}


function _getExistingUserId(config) {
  try {
    var url = config.supabaseUrl + '/auth/v1/admin/users?page=1&per_page=50';
    var resp = UrlFetchApp.fetch(url, {
      headers: {
        'apikey': config.serviceKey,
        'Authorization': 'Bearer ' + config.serviceKey
      },
      muteHttpExceptions: true
    });

    var body = JSON.parse(resp.getContentText());
    var users = body.users || body || [];

    for (var i = 0; i < users.length; i++) {
      if (users[i].email === config.adminEmail) {
        _log('   📌 พบ Admin User ID: ' + users[i].id);
        return users[i].id;
      }
    }
  } catch (e) {
    _log('   ⚠️ ไม่สามารถดึง User ID ได้: ' + e.message);
  }
  return null;
}


function _setAdminRole(conn, userId, config) {
  try {
    var stmt = conn.prepareStatement(
      "UPDATE user_profiles SET role = 'admin', display_name = ? WHERE id = ?::uuid"
    );
    stmt.setString(1, config.adminDisplay);
    stmt.setString(2, userId);
    var updated = stmt.executeUpdate();
    stmt.close();

    if (updated > 0) {
      _log('   ✅ ตั้ง role = admin สำเร็จ');
    } else {
      _log('   ⚠️ ไม่พบ user_profiles record (trigger อาจยังไม่สร้าง — ลองสร้าง manual)');
      // Fallback: Insert directly
      var stmt2 = conn.prepareStatement(
        "INSERT INTO user_profiles (id, username, display_name, role, is_active) " +
        "VALUES (?::uuid, ?, ?, 'admin', true) ON CONFLICT (id) DO UPDATE SET role = 'admin', display_name = EXCLUDED.display_name"
      );
      stmt2.setString(1, userId);
      stmt2.setString(2, config.adminEmail.split('@')[0]);
      stmt2.setString(3, config.adminDisplay);
      stmt2.executeUpdate();
      stmt2.close();
      _log('   ✅ สร้าง admin profile สำเร็จ (fallback)');
    }
  } catch (e) {
    _log('   ❌ Set Admin Role Error: ' + e.message);
  }
}


// =========================================================================
// 📁 GOOGLE DRIVE FOLDERS
// =========================================================================

function _setupDriveFolders() {
  var rootName = 'ระบบเกียรติบัตร-Supabase';
  var subFolders = [
    { key: 'templates', name: 'Templates' },
    { key: 'generated', name: 'Generated' },
    { key: 'zip', name: 'Exports_ZIP' },
    { key: 'temp', name: 'Temp' }
  ];

  // สร้าง Root Folder
  var rootFolder;
  var existing = DriveApp.getFoldersByName(rootName);
  if (existing.hasNext()) {
    rootFolder = existing.next();
    _log('   📁 ใช้ Root Folder ที่มีอยู่: ' + rootName);
  } else {
    rootFolder = DriveApp.createFolder(rootName);
    _log('   📁 สร้าง Root Folder: ' + rootName);
  }

  var result = {
    rootId: rootFolder.getId(),
    rootUrl: rootFolder.getUrl()
  };

  // สร้าง Sub Folders
  subFolders.forEach(function(sf) {
    var subExisting = rootFolder.getFoldersByName(sf.name);
    var folder;
    if (subExisting.hasNext()) {
      folder = subExisting.next();
    } else {
      folder = rootFolder.createFolder(sf.name);
    }

    // ตั้ง sharing สำหรับ Generated folder (ให้ Guest ดูได้)
    if (sf.key === 'generated') {
      folder.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
    }

    result[sf.key + 'Id'] = folder.getId();
    _log('   📁 ' + sf.name + ': ' + folder.getId());
  });

  _log('   ✅ Google Drive Folders — สำเร็จ');
  return result;
}


function _saveDriveConfig(conn, folders) {
  var updates = [
    { key: 'drive_root_folder_id', value: folders.rootId },
    { key: 'drive_template_folder', value: folders.templatesId },
    { key: 'drive_generated_folder', value: folders.generatedId },
    { key: 'drive_zip_folder', value: folders.zipId },
    { key: 'drive_temp_folder', value: folders.tempId }
  ];

  var stmt = conn.prepareStatement(
    "UPDATE settings SET value = ? WHERE key = ?"
  );

  updates.forEach(function(u) {
    stmt.setString(1, u.value);
    stmt.setString(2, u.key);
    stmt.executeUpdate();
  });

  stmt.close();
  _log('   ✅ บันทึก Drive Config — สำเร็จ');
}


// =========================================================================
// 📝 LOGGING
// =========================================================================

function _log(message) {
  Logger.log(message);
}


// =========================================================================
// =========================================================================
// 📦 SQL DEFINITIONS — ทั้งหมดอยู่ด้านล่าง
// =========================================================================
// =========================================================================


// ─── Extensions ───
function _SQL_EXTENSIONS() {
  return [
    'CREATE EXTENSION IF NOT EXISTS "uuid-ossp"',
    'CREATE EXTENSION IF NOT EXISTS "pg_trgm"'
  ];
}


// ─── Tables (6 ตาราง) ───
function _SQL_TABLES() {
  return [
    // 1. user_profiles
    'CREATE TABLE IF NOT EXISTS user_profiles (' +
    '  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,' +
    '  username TEXT UNIQUE,' +
    '  display_name TEXT DEFAULT \'\',' +
    '  role TEXT DEFAULT \'viewer\' CHECK (role IN (\'admin\', \'editor\', \'viewer\')),' +
    '  is_active BOOLEAN DEFAULT true,' +
    '  failed_attempts INT DEFAULT 0,' +
    '  last_login TIMESTAMPTZ,' +
    '  created_at TIMESTAMPTZ DEFAULT now(),' +
    '  updated_at TIMESTAMPTZ DEFAULT now()' +
    ')',

    // 2. templates
    'CREATE TABLE IF NOT EXISTS templates (' +
    '  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,' +
    '  name TEXT NOT NULL DEFAULT \'Template ไม่มีชื่อ\',' +
    '  drive_file_id TEXT DEFAULT \'\',' +
    '  elements JSONB DEFAULT \'[]\'::jsonb,' +
    '  canvas_width INT DEFAULT 3508,' +
    '  canvas_height INT DEFAULT 2480,' +
    '  number_prefix TEXT DEFAULT \'\',' +
    '  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,' +
    '  created_at TIMESTAMPTZ DEFAULT now(),' +
    '  updated_at TIMESTAMPTZ DEFAULT now()' +
    ')',

    // 3. records
    'CREATE TABLE IF NOT EXISTS records (' +
    '  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,' +
    '  template_id UUID NOT NULL REFERENCES templates(id) ON DELETE CASCADE,' +
    '  name TEXT NOT NULL,' +
    '  school TEXT DEFAULT \'\',' +
    '  cert_number TEXT DEFAULT \'\',' +
    '  cert_date TEXT DEFAULT \'\',' +
    '  signer TEXT DEFAULT \'\',' +
    '  position TEXT DEFAULT \'\',' +
    '  extra1 TEXT DEFAULT \'\',' +
    '  extra2 TEXT DEFAULT \'\',' +
    '  extra3 TEXT DEFAULT \'\',' +
    '  extra4 TEXT DEFAULT \'\',' +
    '  extra5 TEXT DEFAULT \'\',' +
    '  status TEXT DEFAULT \'pending\' CHECK (status IN (\'pending\', \'generated\', \'exported\')),' +
    '  drive_file_url TEXT DEFAULT \'\',' +
    '  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,' +
    '  created_at TIMESTAMPTZ DEFAULT now(),' +
    '  updated_at TIMESTAMPTZ DEFAULT now()' +
    ')',

    // 4. settings
    'CREATE TABLE IF NOT EXISTS settings (' +
    '  key TEXT PRIMARY KEY,' +
    '  value TEXT DEFAULT \'\',' +
    '  description TEXT DEFAULT \'\',' +
    '  updated_at TIMESTAMPTZ DEFAULT now()' +
    ')',

    // 5. export_logs
    'CREATE TABLE IF NOT EXISTS export_logs (' +
    '  id BIGSERIAL PRIMARY KEY,' +
    '  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,' +
    '  username TEXT DEFAULT \'\',' +
    '  action TEXT DEFAULT \'\',' +
    '  record_count INT DEFAULT 0,' +
    '  status TEXT DEFAULT \'\',' +
    '  note TEXT DEFAULT \'\',' +
    '  created_at TIMESTAMPTZ DEFAULT now()' +
    ')',

    // 6. login_logs
    'CREATE TABLE IF NOT EXISTS login_logs (' +
    '  id BIGSERIAL PRIMARY KEY,' +
    '  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,' +
    '  username TEXT DEFAULT \'\',' +
    '  action TEXT DEFAULT \'\',' +
    '  status TEXT DEFAULT \'\',' +
    '  note TEXT DEFAULT \'\',' +
    '  ip_address TEXT DEFAULT \'\',' +
    '  created_at TIMESTAMPTZ DEFAULT now()' +
    ')'
  ];
}


// ─── Indexes (12) ───
function _SQL_INDEXES() {
  return [
    'CREATE INDEX IF NOT EXISTS idx_records_template_id ON records(template_id)',
    'CREATE INDEX IF NOT EXISTS idx_records_status ON records(status)',
    'CREATE INDEX IF NOT EXISTS idx_records_cert_number ON records(cert_number)',
    'CREATE INDEX IF NOT EXISTS idx_records_created_at ON records(created_at DESC)',
    'CREATE INDEX IF NOT EXISTS idx_records_name_trgm ON records USING gin(name gin_trgm_ops)',
    'CREATE INDEX IF NOT EXISTS idx_records_school ON records(school)',
    'CREATE INDEX IF NOT EXISTS idx_templates_created_by ON templates(created_by)',
    'CREATE INDEX IF NOT EXISTS idx_templates_created_at ON templates(created_at DESC)',
    'CREATE INDEX IF NOT EXISTS idx_user_profiles_role ON user_profiles(role)',
    'CREATE INDEX IF NOT EXISTS idx_user_profiles_username ON user_profiles(username)',
    'CREATE INDEX IF NOT EXISTS idx_export_logs_created_at ON export_logs(created_at DESC)',
    'CREATE INDEX IF NOT EXISTS idx_login_logs_created_at ON login_logs(created_at DESC)'
  ];
}


// ─── Functions (11) ───
function _SQL_FUNCTIONS() {
  return [
    // 1. trigger_set_updated_at
    'CREATE OR REPLACE FUNCTION trigger_set_updated_at() ' +
    'RETURNS TRIGGER AS $$ ' +
    'BEGIN NEW.updated_at = now(); RETURN NEW; END; ' +
    '$$ LANGUAGE plpgsql',

    // 2. handle_new_user (auto-create profile on signup)
    'CREATE OR REPLACE FUNCTION handle_new_user() ' +
    'RETURNS TRIGGER AS $$ ' +
    'BEGIN ' +
    '  INSERT INTO public.user_profiles (id, username, display_name, role, is_active) ' +
    '  VALUES (' +
    '    NEW.id,' +
    '    COALESCE(NEW.raw_user_meta_data->>\'username\', split_part(NEW.email, \'@\', 1)),' +
    '    COALESCE(NEW.raw_user_meta_data->>\'display_name\', split_part(NEW.email, \'@\', 1)),' +
    '    COALESCE(NEW.raw_user_meta_data->>\'role\', \'viewer\'),' +
    '    true' +
    '  ); ' +
    '  RETURN NEW; ' +
    'END; ' +
    '$$ LANGUAGE plpgsql SECURITY DEFINER',

    // 3. auth_user_role (helper for RLS)
    'CREATE OR REPLACE FUNCTION auth_user_role() ' +
    'RETURNS TEXT AS $$ ' +
    '  SELECT role FROM public.user_profiles WHERE id = auth.uid(); ' +
    '$$ LANGUAGE sql STABLE SECURITY DEFINER',

    // 4. get_next_cert_number
    'CREATE OR REPLACE FUNCTION get_next_cert_number(' +
    '  p_template_id UUID, p_prefix TEXT DEFAULT \'\', p_format_length INT DEFAULT 4' +
    ') RETURNS TEXT AS $$ ' +
    'DECLARE max_num INT := 0; next_num INT; cert_val TEXT; num_part TEXT; ' +
    'BEGIN ' +
    '  FOR cert_val IN SELECT cert_number FROM records ' +
    '    WHERE template_id = p_template_id AND cert_number IS NOT NULL AND cert_number != \'\' ' +
    '  LOOP ' +
    '    num_part := regexp_replace(cert_val, \'[^0-9]\', \'\', \'g\'); ' +
    '    IF num_part != \'\' AND num_part::INT > max_num THEN max_num := num_part::INT; END IF; ' +
    '  END LOOP; ' +
    '  next_num := max_num + 1; ' +
    '  RETURN p_prefix || lpad(next_num::TEXT, p_format_length, \'0\'); ' +
    'END; ' +
    '$$ LANGUAGE plpgsql',

    // 5. batch_generate_cert_numbers
    'CREATE OR REPLACE FUNCTION batch_generate_cert_numbers(' +
    '  p_template_id UUID, p_prefix TEXT DEFAULT \'\', p_format_length INT DEFAULT 4, p_count INT DEFAULT 1' +
    ') RETURNS TEXT[] AS $$ ' +
    'DECLARE max_num INT := 0; result TEXT[]; cert_val TEXT; num_part TEXT; i INT; ' +
    'BEGIN ' +
    '  FOR cert_val IN SELECT cert_number FROM records ' +
    '    WHERE template_id = p_template_id AND cert_number IS NOT NULL AND cert_number != \'\' ' +
    '  LOOP ' +
    '    num_part := regexp_replace(cert_val, \'[^0-9]\', \'\', \'g\'); ' +
    '    IF num_part != \'\' AND num_part::INT > max_num THEN max_num := num_part::INT; END IF; ' +
    '  END LOOP; ' +
    '  FOR i IN 1..p_count LOOP ' +
    '    result := array_append(result, p_prefix || lpad((max_num + i)::TEXT, p_format_length, \'0\')); ' +
    '  END LOOP; ' +
    '  RETURN result; ' +
    'END; ' +
    '$$ LANGUAGE plpgsql',

    // 6. get_dashboard_stats
    'CREATE OR REPLACE FUNCTION get_dashboard_stats(p_template_id UUID DEFAULT NULL) ' +
    'RETURNS JSON AS $$ ' +
    'DECLARE result JSON; ' +
    'BEGIN ' +
    '  SELECT json_build_object(' +
    '    \'total\', COUNT(*) FILTER (WHERE (p_template_id IS NULL OR template_id = p_template_id)),' +
    '    \'pending\', COUNT(*) FILTER (WHERE status = \'pending\' AND (p_template_id IS NULL OR template_id = p_template_id)),' +
    '    \'generated\', COUNT(*) FILTER (WHERE status = \'generated\' AND (p_template_id IS NULL OR template_id = p_template_id)),' +
    '    \'exported\', COUNT(*) FILTER (WHERE status = \'exported\' AND (p_template_id IS NULL OR template_id = p_template_id)),' +
    '    \'templates\', (SELECT COUNT(*) FROM templates)' +
    '  ) INTO result FROM records; ' +
    '  RETURN result; ' +
    'END; ' +
    '$$ LANGUAGE plpgsql STABLE',

    // 7. switch_template_context
    'CREATE OR REPLACE FUNCTION switch_template_context(p_template_id UUID) ' +
    'RETURNS JSON AS $$ ' +
    'DECLARE template_config JSON; stats JSON; page_data JSON; schools JSON; ' +
    'BEGIN ' +
    '  SELECT row_to_json(t) INTO template_config FROM (' +
    '    SELECT id, name, drive_file_id, elements, canvas_width, canvas_height, number_prefix, created_at, updated_at ' +
    '    FROM templates WHERE id = p_template_id' +
    '  ) t; ' +
    '  SELECT get_dashboard_stats(p_template_id) INTO stats; ' +
    '  SELECT json_agg(r) INTO page_data FROM (' +
    '    SELECT id, template_id, name, school, cert_number, cert_date, signer, position, ' +
    '      extra1, extra2, extra3, extra4, extra5, status, drive_file_url, created_at, updated_at ' +
    '    FROM records WHERE template_id = p_template_id ORDER BY created_at DESC LIMIT 50' +
    '  ) r; ' +
    '  SELECT json_agg(DISTINCT school) INTO schools FROM records WHERE template_id = p_template_id AND school != \'\'; ' +
    '  RETURN json_build_object(' +
    '    \'config\', template_config,' +
    '    \'stats\', stats,' +
    '    \'data\', COALESCE(page_data, \'[]\'::json),' +
    '    \'schools\', COALESCE(schools, \'[]\'::json),' +
    '    \'total\', (SELECT COUNT(*) FROM records WHERE template_id = p_template_id)' +
    '  ); ' +
    'END; ' +
    '$$ LANGUAGE plpgsql STABLE',

    // 8. guest_search_certificates
    'CREATE OR REPLACE FUNCTION guest_search_certificates(' +
    '  p_search_name TEXT, p_template_id UUID DEFAULT NULL' +
    ') RETURNS JSON AS $$ ' +
    'DECLARE results JSON; search_term TEXT; ' +
    'BEGIN ' +
    '  search_term := trim(p_search_name); ' +
    '  IF length(search_term) < 2 THEN ' +
    '    RETURN json_build_object(\'status\', false, \'message\', \'กรุณาพิมพ์ชื่ออย่างน้อย 2 ตัวอักษร\'); ' +
    '  END IF; ' +
    '  SELECT json_agg(r) INTO results FROM (' +
    '    SELECT rec.name, rec.school, rec.cert_number AS "certNumber", rec.cert_date AS "certDate", ' +
    '      rec.drive_file_url AS "driveUrl", tpl.name AS "templateName" ' +
    '    FROM records rec LEFT JOIN templates tpl ON tpl.id = rec.template_id ' +
    '    WHERE rec.status IN (\'generated\', \'exported\') ' +
    '      AND rec.drive_file_url IS NOT NULL AND rec.drive_file_url != \'\' ' +
    '      AND rec.name ILIKE \'%\' || search_term || \'%\' ' +
    '      AND (p_template_id IS NULL OR rec.template_id = p_template_id) ' +
    '    ORDER BY rec.name LIMIT 50' +
    '  ) r; ' +
    '  RETURN json_build_object(\'status\', true, \'results\', COALESCE(results, \'[]\'::json), \'total\', COALESCE(json_array_length(results), 0)); ' +
    'END; ' +
    '$$ LANGUAGE plpgsql STABLE SECURITY DEFINER',

    // 9. log_activity
    'CREATE OR REPLACE FUNCTION log_activity(' +
    '  p_user_id UUID DEFAULT NULL, p_username TEXT DEFAULT \'\', p_action TEXT DEFAULT \'\', ' +
    '  p_record_count INT DEFAULT 0, p_status TEXT DEFAULT \'success\', p_note TEXT DEFAULT \'\'' +
    ') RETURNS VOID AS $$ ' +
    'BEGIN ' +
    '  INSERT INTO export_logs (user_id, username, action, record_count, status, note) ' +
    '  VALUES (p_user_id, p_username, p_action, p_record_count, p_status, p_note); ' +
    'END; ' +
    '$$ LANGUAGE plpgsql',

    // 10. health_check (Keep-Alive)
    'CREATE OR REPLACE FUNCTION health_check() ' +
    'RETURNS JSON AS $$ ' +
    'BEGIN ' +
    '  RETURN json_build_object(' +
    '    \'status\', \'ok\',' +
    '    \'timestamp\', now(),' +
    '    \'version\', \'2.0.0\',' +
    '    \'tables\', json_build_object(' +
    '      \'records\', (SELECT COUNT(*) FROM records),' +
    '      \'templates\', (SELECT COUNT(*) FROM templates),' +
    '      \'users\', (SELECT COUNT(*) FROM user_profiles)' +
    '    )' +
    '  ); ' +
    'END; ' +
    '$$ LANGUAGE plpgsql STABLE',

    // 11. batch_update_cert_status
    'CREATE OR REPLACE FUNCTION batch_update_cert_status(p_updates JSONB) ' +
    'RETURNS JSON AS $$ ' +
    'DECLARE item JSONB; updated_count INT := 0; ' +
    'BEGIN ' +
    '  FOR item IN SELECT * FROM jsonb_array_elements(p_updates) LOOP ' +
    '    UPDATE records SET ' +
    '      status = COALESCE(item->>\'status\', \'generated\'), ' +
    '      drive_file_url = COALESCE(item->>\'driveUrl\', drive_file_url), ' +
    '      updated_at = now() ' +
    '    WHERE id = (item->>\'id\')::UUID; ' +
    '    IF FOUND THEN updated_count := updated_count + 1; END IF; ' +
    '  END LOOP; ' +
    '  RETURN json_build_object(\'status\', true, \'count\', updated_count, \'message\', \'อัปเดต \' || updated_count || \' รายการ\'); ' +
    'END; ' +
    '$$ LANGUAGE plpgsql',

    // 12. get_public_template_list (bonus)
    'CREATE OR REPLACE FUNCTION get_public_template_list() ' +
    'RETURNS JSON AS $$ ' +
    'DECLARE result JSON; ' +
    'BEGIN ' +
    '  SELECT json_agg(t) INTO result FROM (SELECT id, name FROM templates ORDER BY name) t; ' +
    '  RETURN json_build_object(\'status\', true, \'templates\', COALESCE(result, \'[]\'::json)); ' +
    'END; ' +
    '$$ LANGUAGE plpgsql STABLE SECURITY DEFINER'
  ];
}


// ─── Triggers (5) ───
function _SQL_TRIGGERS() {
  return [
    'CREATE OR REPLACE TRIGGER set_updated_at_user_profiles BEFORE UPDATE ON user_profiles FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at()',
    'CREATE OR REPLACE TRIGGER set_updated_at_templates BEFORE UPDATE ON templates FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at()',
    'CREATE OR REPLACE TRIGGER set_updated_at_records BEFORE UPDATE ON records FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at()',
    'CREATE OR REPLACE TRIGGER set_updated_at_settings BEFORE UPDATE ON settings FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at()',
    'CREATE OR REPLACE TRIGGER on_auth_user_created AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION handle_new_user()'
  ];
}


// ─── RLS Policies (17) ───
function _SQL_RLS() {
  return [
    // Enable RLS on all tables
    'ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY',
    'ALTER TABLE templates ENABLE ROW LEVEL SECURITY',
    'ALTER TABLE records ENABLE ROW LEVEL SECURITY',
    'ALTER TABLE settings ENABLE ROW LEVEL SECURITY',
    'ALTER TABLE export_logs ENABLE ROW LEVEL SECURITY',
    'ALTER TABLE login_logs ENABLE ROW LEVEL SECURITY',

    // ── user_profiles (4 policies) ──
    'CREATE POLICY "users_read_own_profile" ON user_profiles FOR SELECT USING (auth.uid() = id)',
    'CREATE POLICY "admin_read_all_profiles" ON user_profiles FOR SELECT USING (auth_user_role() = \'admin\')',
    'CREATE POLICY "admin_manage_profiles" ON user_profiles FOR ALL USING (auth_user_role() = \'admin\')',
    'CREATE POLICY "users_update_own_display_name" ON user_profiles FOR UPDATE USING (auth.uid() = id) WITH CHECK (auth.uid() = id)',

    // ── templates (4 policies) ──
    'CREATE POLICY "authenticated_read_templates" ON templates FOR SELECT USING (auth.role() = \'authenticated\')',
    'CREATE POLICY "admin_editor_insert_templates" ON templates FOR INSERT WITH CHECK (auth_user_role() IN (\'admin\', \'editor\'))',
    'CREATE POLICY "admin_editor_update_templates" ON templates FOR UPDATE USING (auth_user_role() IN (\'admin\', \'editor\'))',
    'CREATE POLICY "admin_editor_delete_templates" ON templates FOR DELETE USING (auth_user_role() IN (\'admin\', \'editor\'))',
    'CREATE POLICY "anon_read_template_names" ON templates FOR SELECT USING (auth.role() = \'anon\')',

    // ── records (6 policies) ──
    'CREATE POLICY "admin_editor_read_records" ON records FOR SELECT USING (auth_user_role() IN (\'admin\', \'editor\'))',
    'CREATE POLICY "admin_editor_insert_records" ON records FOR INSERT WITH CHECK (auth_user_role() IN (\'admin\', \'editor\'))',
    'CREATE POLICY "admin_editor_update_records" ON records FOR UPDATE USING (auth_user_role() IN (\'admin\', \'editor\'))',
    'CREATE POLICY "admin_delete_records" ON records FOR DELETE USING (auth_user_role() = \'admin\')',
    'CREATE POLICY "editor_delete_records" ON records FOR DELETE USING (auth_user_role() = \'editor\')',
    'CREATE POLICY "viewer_read_records" ON records FOR SELECT USING (auth_user_role() = \'viewer\')',
    'CREATE POLICY "anon_read_generated_records" ON records FOR SELECT USING (auth.role() = \'anon\' AND status IN (\'generated\', \'exported\') AND drive_file_url IS NOT NULL AND drive_file_url != \'\')',

    // ── settings (2 policies) ──
    'CREATE POLICY "authenticated_read_settings" ON settings FOR SELECT USING (auth.role() = \'authenticated\')',
    'CREATE POLICY "admin_manage_settings" ON settings FOR ALL USING (auth_user_role() = \'admin\')',

    // ── export_logs (3 policies) ──
    'CREATE POLICY "authenticated_read_export_logs" ON export_logs FOR SELECT USING (auth.role() = \'authenticated\')',
    'CREATE POLICY "authenticated_insert_export_logs" ON export_logs FOR INSERT WITH CHECK (auth.role() = \'authenticated\')',
    'CREATE POLICY "admin_delete_export_logs" ON export_logs FOR DELETE USING (auth_user_role() = \'admin\')',

    // ── login_logs (2 policies) ──
    'CREATE POLICY "admin_read_login_logs" ON login_logs FOR SELECT USING (auth_user_role() = \'admin\')',
    'CREATE POLICY "authenticated_insert_login_logs" ON login_logs FOR INSERT WITH CHECK (auth.role() = \'authenticated\')'
  ];
}


// ─── Grants ───
function _SQL_GRANTS() {
  return [
    // anon (Guest)
    'GRANT SELECT ON templates TO anon',
    'GRANT SELECT ON records TO anon',
    'GRANT EXECUTE ON FUNCTION guest_search_certificates TO anon',
    'GRANT EXECUTE ON FUNCTION get_public_template_list TO anon',
    'GRANT EXECUTE ON FUNCTION health_check TO anon',

    // authenticated
    'GRANT ALL ON records TO authenticated',
    'GRANT ALL ON templates TO authenticated',
    'GRANT ALL ON settings TO authenticated',
    'GRANT ALL ON export_logs TO authenticated',
    'GRANT ALL ON login_logs TO authenticated',
    'GRANT ALL ON user_profiles TO authenticated',
    'GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO authenticated',
    'GRANT EXECUTE ON FUNCTION get_next_cert_number TO authenticated',
    'GRANT EXECUTE ON FUNCTION batch_generate_cert_numbers TO authenticated',
    'GRANT EXECUTE ON FUNCTION get_dashboard_stats TO authenticated',
    'GRANT EXECUTE ON FUNCTION switch_template_context TO authenticated',
    'GRANT EXECUTE ON FUNCTION log_activity TO authenticated',
    'GRANT EXECUTE ON FUNCTION batch_update_cert_status TO authenticated',
    'GRANT EXECUTE ON FUNCTION health_check TO authenticated'
  ];
}


// ─── Seed Data (14 Settings) ───
function _SQL_SEED() {
  var now = new Date().toISOString();
  return [
    "INSERT INTO settings (key, value, description) VALUES " +
    "('active_template_id', '', 'ID ของ Template ที่ใช้งานอยู่'), " +
    "('default_font', 'TH Sarabun New', 'Font เริ่มต้นบน Canvas'), " +
    "('auto_numbering', 'TRUE', 'สร้างเลขที่อัตโนมัติ'), " +
    "('number_prefix', 'กบ.', 'คำนำหน้าเลขที่เกียรติบัตร'), " +
    "('number_format', '0000', 'รูปแบบตัวเลข'), " +
    "('session_expire_hours', '24', 'Session หมดอายุกี่ชั่วโมง'), " +
    "('app_name', 'ระบบสร้างเกียรติบัตร', 'ชื่อแอปที่แสดงบน UI'), " +
    "('version', '2.0.0', 'เวอร์ชันระบบ (Supabase Edition)'), " +
    "('setup_date', '" + now + "', 'วันที่ติดตั้ง'), " +
    "('drive_root_folder_id', '', 'Google Drive Root Folder ID'), " +
    "('drive_template_folder', '', 'Folder สำหรับ Template Images'), " +
    "('drive_generated_folder', '', 'Folder สำหรับ Generated Certificates'), " +
    "('drive_zip_folder', '', 'Folder สำหรับ ZIP'), " +
    "('drive_temp_folder', '', 'Folder สำหรับไฟล์ชั่วคราว') " +
    "ON CONFLICT (key) DO NOTHING"
  ];
}


// ─── Views (1) ───
function _SQL_VIEWS() {
  return [
    'CREATE OR REPLACE VIEW templates_with_counts AS ' +
    'SELECT t.id, t.name, t.drive_file_id, t.canvas_width, t.canvas_height, t.number_prefix, ' +
    '  t.created_at, t.updated_at, ' +
    '  COUNT(r.id) AS record_count, ' +
    '  COUNT(r.id) FILTER (WHERE r.status = \'pending\') AS pending_count, ' +
    '  COUNT(r.id) FILTER (WHERE r.status = \'generated\') AS generated_count, ' +
    '  COUNT(r.id) FILTER (WHERE r.status = \'exported\') AS exported_count ' +
    'FROM templates t LEFT JOIN records r ON r.template_id = t.id GROUP BY t.id',
    'GRANT SELECT ON templates_with_counts TO authenticated'
  ];
}
