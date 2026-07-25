/**
 * =========================================================================
 * API.JS — API Layer v2.0: Supabase Backend
 * =========================================================================
 * ✅ Backward Compatible — core.js, canvas.js, export.js ไม่ต้องแก้!
 *    ยังเรียก api.loginUser(), api.getData() ฯลฯ เหมือนเดิม
 *
 * Architecture:
 *   Auth + CRUD → Supabase (supabase-js)
 *   File Upload  → GAS Web App (Google Drive API)
 * =========================================================================
 */

// ── Initialize Supabase Client ──
var _supabase = null;

function _getSupabase() {
  if (!_supabase) {
    if (typeof supabase === 'undefined' || !supabase.createClient) {
      throw new Error('Supabase JS library not loaded. เพิ่ม CDN ใน index.html');
    }
    _supabase = supabase.createClient(APP_CONFIG.SUPABASE_URL, APP_CONFIG.SUPABASE_ANON_KEY);
  }
  return _supabase;
}


// ═══════════════════════════════════════════════════════════════════════
// MAIN API OBJECT — Backward Compatible Interface
// ═══════════════════════════════════════════════════════════════════════

var api = {

  // ═══════════════════════════════════════════════════════════════════════
  // 🔐 AUTHENTICATION — Supabase Auth
  // ═══════════════════════════════════════════════════════════════════════

  /**
   * เข้าสู่ระบบ (รองรับทั้ง email และ username)
   */
  loginUser: function(username, password) {
    var email = username;
    // ถ้าไม่ใช่ email → ต่อ @cert.local
    if (email.indexOf('@') === -1) {
      email = email + '@cert.local';
    }

    return _getSupabase().auth.signInWithPassword({
      email: email,
      password: password
    })
    .then(function(response) {
      if (response.error) {
        return { status: false, message: response.error.message || 'เข้าสู่ระบบไม่สำเร็จ' };
      }

      var user = response.data.user;
      var session = response.data.session;

      // ดึง profile จาก user_profiles
      return _getSupabase()
        .from('user_profiles')
        .select('display_name, role')
        .eq('id', user.id)
        .single()
        .then(function(profileRes) {
          var profile = profileRes.data || {};
          var userData = {
            username: user.email.replace('@cert.local', ''),
            email: user.email,
            displayName: profile.display_name || user.email,
            role: profile.role || 'user',
            userId: user.id
          };

          // Log login
          _logLoginActivity(user.id, userData.username);

          return {
            status: true,
            token: session.access_token,
            userData: userData
          };
        });
    })
    .catch(function(err) {
      return { status: false, message: err.message || 'เกิดข้อผิดพลาด' };
    });
  },

  login: function(username, password) { return api.loginUser(username, password); },

  /**
   * ตรวจสอบ Session
   */
  checkSession: function() {
    return _getSupabase().auth.getSession()
      .then(function(response) {
        if (response.error || !response.data.session) {
          return { status: false };
        }

        var user = response.data.session.user;

        return _getSupabase()
          .from('user_profiles')
          .select('display_name, role')
          .eq('id', user.id)
          .single()
          .then(function(profileRes) {
            var profile = profileRes.data || {};
            return {
              status: true,
              userData: {
                username: user.email.replace('@cert.local', ''),
                email: user.email,
                displayName: profile.display_name || user.email,
                role: profile.role || 'user',
                userId: user.id
              }
            };
          });
      })
      .catch(function() {
        return { status: false };
      });
  },

  /**
   * ออกจากระบบ
   */
  logoutUser: function() {
    return _getSupabase().auth.signOut()
      .then(function() {
        return { status: true };
      })
      .catch(function(err) {
        return { status: false, message: err.message };
      });
  },

  logout: function() { return api.logoutUser(); },

  /**
   * เปลี่ยนรหัสผ่าน
   */
  changePassword: function(oldPassword, newPassword) {
    // Supabase updateUser ไม่ต้องใช้ old password (ใช้ session)
    // แต่เพื่อความปลอดภัย เราจะ verify ก่อน
    return _getSupabase().auth.getUser()
      .then(function(userRes) {
        if (userRes.error) throw userRes.error;
        var email = userRes.data.user.email;

        // Verify old password
        return _getSupabase().auth.signInWithPassword({ email: email, password: oldPassword })
          .then(function(loginRes) {
            if (loginRes.error) {
              return { status: false, message: 'รหัสผ่านเดิมไม่ถูกต้อง' };
            }
            // Update password
            return _getSupabase().auth.updateUser({ password: newPassword })
              .then(function(updateRes) {
                if (updateRes.error) {
                  return { status: false, message: updateRes.error.message };
                }
                return { status: true, message: 'เปลี่ยนรหัสผ่านสำเร็จ' };
              });
          });
      })
      .catch(function(err) {
        return { status: false, message: err.message || 'เกิดข้อผิดพลาด' };
      });
  },


  // ═══════════════════════════════════════════════════════════════════════
  // 📋 DATA CRUD — Supabase PostgREST
  // ═══════════════════════════════════════════════════════════════════════

  /**
   * ดึงข้อมูล records (pagination + sort + search)
   */
  getData: function(options) {
    options = options || {};
    var page = options.page || 1;
    var perPage = options.perPage || 50;
    var sortBy = options.sortBy || 0;
    var sortDir = options.sortDir || 'asc';
    var search = options.search || '';
    var templateId = options.templateId || AppState.activeTemplateId;

    var query = _getSupabase()
      .from('records')
      .select('*', { count: 'exact' });

    // Filter by template
    if (templateId) {
      query = query.eq('template_id', templateId);
    }

    // Search
    if (search) {
      query = query.or(
        'prefix_number.ilike.%' + search + '%,' +
        'full_name.ilike.%' + search + '%,' +
        'school_name.ilike.%' + search + '%,' +
        'cert_number.ilike.%' + search + '%'
      );
    }

    // Sort mapping (column index → column name)
    var sortColumns = ['row_number', 'prefix_number', 'full_name', 'school_name', 'cert_number', 'cert_status', 'created_at'];
    var sortCol = sortColumns[sortBy] || 'row_number';
    query = query.order(sortCol, { ascending: sortDir === 'asc' });

    // Pagination
    var from = (page - 1) * perPage;
    var to = from + perPage - 1;
    query = query.range(from, to);

    return query.then(function(response) {
      if (response.error) {
        return { status: false, message: response.error.message };
      }

      var totalRecords = response.count || 0;
      var totalPages = Math.ceil(totalRecords / perPage);

      // Map to old format
      var records = (response.data || []).map(function(row, idx) {
        return _mapRecordFromDb(row, from + idx);
      });

      return {
        status: true,
        records: records,
        totalRecords: totalRecords,
        totalPages: totalPages,
        currentPage: page
      };
    });
  },

  /**
   * ดึงข้อมูลทั้งหมด (ไม่แบ่งหน้า)
   */
  getAllRecords: function() {
    var templateId = AppState.activeTemplateId;
    var query = _getSupabase()
      .from('records')
      .select('*')
      .order('row_number', { ascending: true });

    if (templateId) {
      query = query.eq('template_id', templateId);
    }

    return query.then(function(response) {
      if (response.error) {
        return { status: false, message: response.error.message, records: [] };
      }

      var records = (response.data || []).map(function(row, idx) {
        return _mapRecordFromDb(row, idx);
      });

      return { status: true, records: records };
    });
  },

  /**
   * เพิ่ม record ใหม่
   */
  addRecord: function(record) {
    var dbRecord = _mapRecordToDb(record);
    dbRecord.template_id = AppState.activeTemplateId;

    return _getSupabase()
      .from('records')
      .insert(dbRecord)
      .select()
      .single()
      .then(function(response) {
        if (response.error) {
          return { status: false, message: response.error.message };
        }
        return { status: true, message: 'เพิ่มข้อมูลสำเร็จ', record: _mapRecordFromDb(response.data) };
      });
  },

  /**
   * แก้ไข record (รองรับทั้ง rowIndex และ id)
   */
  editRecord: function(rowIndex, record) {
    var dbRecord = _mapRecordToDb(record);
    var recordId = record.id || record.recordId;

    var query;
    if (recordId) {
      query = _getSupabase().from('records').update(dbRecord).eq('id', recordId);
    } else {
      // Fallback: ใช้ rowIndex (หา record จาก position)
      query = _getSupabase().from('records').update(dbRecord)
        .eq('template_id', AppState.activeTemplateId)
        .eq('row_number', rowIndex);
    }

    return query.select().single()
      .then(function(response) {
        if (response.error) {
          return { status: false, message: response.error.message };
        }
        return { status: true, message: 'แก้ไขข้อมูลสำเร็จ' };
      });
  },

  /**
   * ลบ records (รองรับ array ของ id หรือ rowIndex)
   */
  deleteRecords: function(rowIndexes) {
    if (!Array.isArray(rowIndexes)) rowIndexes = [rowIndexes];

    // ถ้าเป็น UUID → ลบ by id ตรง, ถ้าเป็นตัวเลข → ลบ by row_number
    var isUuid = rowIndexes[0] && String(rowIndexes[0]).indexOf('-') !== -1;

    var query;
    if (isUuid) {
      query = _getSupabase().from('records').delete().in('id', rowIndexes);
    } else {
      query = _getSupabase().from('records').delete()
        .eq('template_id', AppState.activeTemplateId)
        .in('row_number', rowIndexes);
    }

    return query.then(function(response) {
      if (response.error) {
        return { status: false, message: response.error.message };
      }
      return { status: true, message: 'ลบข้อมูลสำเร็จ ' + rowIndexes.length + ' รายการ' };
    });
  },

  /**
   * นำเข้าข้อมูล
   */
  importData: function(jsonData, mode) {
    var data = typeof jsonData === 'string' ? JSON.parse(jsonData) : jsonData;
    var templateId = AppState.activeTemplateId;

    // mode: 'append' หรือ 'replace'
    var promise = Promise.resolve();

    if (mode === 'replace') {
      // ลบข้อมูลเดิมก่อน
      promise = _getSupabase()
        .from('records')
        .delete()
        .eq('template_id', templateId)
        .then(function() {});
    }

    return promise.then(function() {
      // เตรียมข้อมูลสำหรับ insert
      var records = data.map(function(row, idx) {
        var dbRecord = _mapRecordToDb(row);
        dbRecord.template_id = templateId;
        dbRecord.row_number = idx + 1;
        return dbRecord;
      });

      // Insert ทีละ batch (250 records)
      var batchSize = 250;
      var batches = [];
      for (var i = 0; i < records.length; i += batchSize) {
        batches.push(records.slice(i, i + batchSize));
      }

      return batches.reduce(function(chain, batch) {
        return chain.then(function() {
          return _getSupabase().from('records').insert(batch);
        });
      }, Promise.resolve());
    })
    .then(function() {
      return { status: true, message: 'นำเข้าข้อมูลสำเร็จ ' + data.length + ' รายการ' };
    })
    .catch(function(err) {
      return { status: false, message: err.message || 'เกิดข้อผิดพลาดในการนำเข้า' };
    });
  },

  /**
   * รับเลขที่เกียรติบัตรถัดไป
   */
  getNextCertNumber: function() {
    var templateId = AppState.activeTemplateId;
    return _getSupabase()
      .from('records')
      .select('cert_number')
      .eq('template_id', templateId)
      .not('cert_number', 'is', null)
      .order('cert_number', { ascending: false })
      .limit(1)
      .then(function(response) {
        var lastNumber = 0;
        if (response.data && response.data.length > 0) {
          var match = String(response.data[0].cert_number).match(/(\d+)/);
          if (match) lastNumber = parseInt(match[1]);
        }
        return { status: true, nextNumber: lastNumber + 1 };
      });
  },

  /**
   * อัปเดตสถานะ cert (batch)
   */
  batchUpdateCertStatus: function(results) {
    if (!results || results.length === 0) {
      return Promise.resolve({ status: true });
    }

    // Update ทีละตัว (ใช้ Promise.all สำหรับ parallel)
    var updates = results.map(function(r) {
      var updateData = { cert_status: r.status || 'exported' };
      if (r.driveFileId) updateData.drive_file_id = r.driveFileId;
      if (r.driveUrl) updateData.drive_url = r.driveUrl;

      if (r.id) {
        return _getSupabase().from('records').update(updateData).eq('id', r.id);
      } else if (r.rowIndex !== undefined) {
        return _getSupabase().from('records').update(updateData)
          .eq('template_id', AppState.activeTemplateId)
          .eq('row_number', r.rowIndex);
      }
      return Promise.resolve();
    });

    return Promise.all(updates)
      .then(function() { return { status: true }; })
      .catch(function(err) { return { status: false, message: err.message }; });
  },

  /**
   * อัปเดตสถานะ records
   */
  updateRecordStatuses: function(updates) {
    return api.batchUpdateCertStatus(updates);
  },


  // ═══════════════════════════════════════════════════════════════════════
  // 🎨 TEMPLATE MANAGEMENT — Supabase PostgREST
  // ═══════════════════════════════════════════════════════════════════════

  /**
   * รายการ template
   */
  getTemplateList: function() {
    return _getSupabase()
      .from('templates')
      .select('id, name, prefix, background_url, is_active')
      .order('name')
      .then(function(response) {
        if (response.error) {
          return { status: false, templates: [] };
        }
        var templates = (response.data || []).map(function(t) {
          return {
            id: t.id,
            name: t.name,
            prefix: t.prefix || '',
            backgroundUrl: t.background_url || '',
            isActive: t.is_active
          };
        });
        return { status: true, templates: templates };
      });
  },

  /**
   * รายการ template พร้อมจำนวน records
   */
  getTemplateListWithCounts: function() {
    return _getSupabase()
      .from('templates_with_counts')
      .select('*')
      .order('name')
      .then(function(response) {
        if (response.error) {
          return { status: false, templates: [] };
        }
        var templates = (response.data || []).map(function(t) {
          return {
            id: t.id,
            name: t.name,
            prefix: t.prefix || '',
            recordCount: t.record_count || 0,
            backgroundUrl: t.background_url || '',
            isActive: t.is_active
          };
        });
        return { status: true, templates: templates };
      });
  },

  /**
   * สลับ template context
   */
  switchTemplateContext: function(templateId) {
    return _getSupabase()
      .from('templates')
      .select('*')
      .eq('id', templateId)
      .single()
      .then(function(response) {
        if (response.error) {
          return { status: false, message: 'ไม่พบ template' };
        }
        var t = response.data;
        return {
          status: true,
          template: {
            id: t.id,
            name: t.name,
            prefix: t.prefix || '',
            config: t.config_json || null,
            backgroundUrl: t.background_url || ''
          }
        };
      });
  },

  /**
   * บันทึก Template Config
   */
  saveTemplateConfig: function(config) {
    var templateId = config.id || config.templateId || AppState.activeTemplateId;
    var name = config.name || config.templateName || 'Untitled';
    var prefix = config.prefix || '';

    var dbData = {
      name: name,
      prefix: prefix,
      config_json: config,
      background_url: config.backgroundUrl || config.background_url || ''
    };

    if (templateId && templateId !== 'new') {
      // Update existing
      return _getSupabase()
        .from('templates')
        .update(dbData)
        .eq('id', templateId)
        .select()
        .single()
        .then(function(response) {
          if (response.error) {
            return { status: false, message: response.error.message };
          }
          return { status: true, message: 'บันทึก Template สำเร็จ', templateId: response.data.id };
        });
    } else {
      // Insert new
      dbData.created_by = null;
      return _getSupabase().auth.getUser().then(function(userRes) {
        if (userRes.data && userRes.data.user) {
          dbData.created_by = userRes.data.user.id;
        }
        return _getSupabase()
          .from('templates')
          .insert(dbData)
          .select()
          .single()
          .then(function(response) {
            if (response.error) {
              return { status: false, message: response.error.message };
            }
            return { status: true, message: 'สร้าง Template ใหม่สำเร็จ', templateId: response.data.id };
          });
      });
    }
  },

  /**
   * โหลด Template Config
   */
  loadTemplateConfig: function(templateId) {
    return api.switchTemplateContext(templateId);
  },

  /**
   * เปลี่ยนชื่อ Template
   */
  renameTemplate: function(templateId, newName, newPrefix) {
    return _getSupabase()
      .from('templates')
      .update({ name: newName, prefix: newPrefix || '' })
      .eq('id', templateId)
      .then(function(response) {
        if (response.error) {
          return { status: false, message: response.error.message };
        }
        return { status: true, message: 'เปลี่ยนชื่อสำเร็จ' };
      });
  },

  /**
   * Duplicate Template
   */
  duplicateTemplate: function(templateId, newName, newPrefix) {
    return _getSupabase()
      .from('templates')
      .select('*')
      .eq('id', templateId)
      .single()
      .then(function(response) {
        if (response.error) {
          return { status: false, message: response.error.message };
        }
        var original = response.data;
        var newTemplate = {
          name: newName,
          prefix: newPrefix || '',
          config_json: original.config_json,
          background_url: original.background_url
        };

        return _getSupabase().auth.getUser().then(function(userRes) {
          if (userRes.data && userRes.data.user) {
            newTemplate.created_by = userRes.data.user.id;
          }
          return _getSupabase()
            .from('templates')
            .insert(newTemplate)
            .select()
            .single()
            .then(function(insertRes) {
              if (insertRes.error) {
                return { status: false, message: insertRes.error.message };
              }
              return { status: true, message: 'Duplicate สำเร็จ', templateId: insertRes.data.id };
            });
        });
      });
  },

  /**
   * ลบ Template
   */
  deleteTemplate: function(templateId) {
    return _getSupabase()
      .from('templates')
      .delete()
      .eq('id', templateId)
      .then(function(response) {
        if (response.error) {
          return { status: false, message: response.error.message };
        }
        return { status: true, message: 'ลบ Template สำเร็จ' };
      });
  },

  /**
   * จำนวน records ของ template
   */
  getTemplateNameCount: function(templateId) {
    return _getSupabase()
      .from('records')
      .select('id', { count: 'exact', head: true })
      .eq('template_id', templateId)
      .then(function(response) {
        return { status: true, count: response.count || 0 };
      });
  },


  // ═══════════════════════════════════════════════════════════════════════
  // 📤 EXPORT & DRIVE — GAS Web App (Google Drive)
  // ═══════════════════════════════════════════════════════════════════════

  /**
   * Helper: เรียก GAS Web App สำหรับ Drive operations
   */
  _callGAS: function(action, params) {
    params = params || {};
    var body = { action: action };
    for (var key in params) {
      if (params.hasOwnProperty(key)) body[key] = params[key];
    }

    // ใส่ Supabase token ให้ GAS ตรวจสอบ
    return _getSupabase().auth.getSession().then(function(sessionRes) {
      if (sessionRes.data && sessionRes.data.session) {
        body.token = sessionRes.data.session.access_token;
      }

      return fetch(APP_CONFIG.GAS_API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain' },
        body: JSON.stringify(body)
      })
      .then(function(response) {
        if (!response.ok) throw new Error('HTTP Error ' + response.status);
        return response.json();
      });
    });
  },

  saveCertificateImage: function(base64Data, filename, rowIndex, templateName) {
    return api._callGAS('saveCertificateImage', {
      base64Data: base64Data, filename: filename,
      rowIndex: rowIndex, templateName: templateName
    });
  },

  saveZipFile: function(base64Data, filename) {
    return api._callGAS('saveZipFile', { base64Data: base64Data, filename: filename });
  },

  uploadTemplateImage: function(base64Data, filename) {
    return api._callGAS('uploadTemplateImage', { base64Data: base64Data, filename: filename });
  },

  uploadElementImage: function(base64Data, filename) {
    return api._callGAS('uploadElementImage', { base64Data: base64Data, filename: filename });
  },

  getImageBase64: function(fileId) {
    return api._callGAS('getImageBase64', { fileId: fileId });
  },

  getImagePublicUrl: function(fileId) {
    // Direct URL — ไม่ต้องเรียก GAS
    return Promise.resolve({
      status: true,
      url: 'https://drive.google.com/uc?export=view&id=' + fileId
    });
  },

  getUploadConfig: function(templateName) {
    // ดึง Drive folder IDs จาก settings
    return _getSupabase()
      .from('settings')
      .select('key, value')
      .in('key', ['drive_root_folder_id', 'drive_templates_folder_id', 'drive_generated_folder_id', 'drive_zip_folder_id'])
      .then(function(response) {
        var config = {};
        (response.data || []).forEach(function(s) {
          config[s.key] = s.value;
        });
        return {
          status: true,
          config: {
            templateName: templateName,
            rootFolderId: config.drive_root_folder_id || '',
            templatesFolderId: config.drive_templates_folder_id || '',
            generatedFolderId: config.drive_generated_folder_id || '',
            zipFolderId: config.drive_zip_folder_id || ''
          }
        };
      });
  },


  // ═══════════════════════════════════════════════════════════════════════
  // 📊 DASHBOARD & SETTINGS — Supabase
  // ═══════════════════════════════════════════════════════════════════════

  /**
   * สถิติ Dashboard
   */
  getStats: function() {
    var templateId = AppState.activeTemplateId;

    return Promise.all([
      // Total records
      _getSupabase().from('records').select('id', { count: 'exact', head: true })
        .eq('template_id', templateId),
      // Exported count
      _getSupabase().from('records').select('id', { count: 'exact', head: true })
        .eq('template_id', templateId).eq('cert_status', 'exported'),
      // Templates count
      _getSupabase().from('templates').select('id', { count: 'exact', head: true })
    ])
    .then(function(results) {
      return {
        status: true,
        stats: {
          totalRecords: results[0].count || 0,
          exportedRecords: results[1].count || 0,
          pendingRecords: (results[0].count || 0) - (results[1].count || 0),
          totalTemplates: results[2].count || 0
        }
      };
    });
  },

  /**
   * กิจกรรมล่าสุด
   */
  getRecentActivity: function() {
    return _getSupabase()
      .from('export_logs')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(20)
      .then(function(response) {
        var activities = (response.data || []).map(function(log) {
          return {
            timestamp: log.created_at,
            action: log.action || 'export',
            description: log.description || '',
            details: log.details || ''
          };
        });
        return { status: true, activities: activities };
      });
  },

  /**
   * ดึง Settings
   */
  getSettings: function() {
    return _getSupabase()
      .from('settings')
      .select('key, value')
      .then(function(response) {
        if (response.error) {
          return { status: false, settings: {} };
        }
        var settings = {};
        (response.data || []).forEach(function(s) {
          settings[s.key] = s.value;
        });
        return { status: true, settings: settings };
      });
  },

  /**
   * อัปเดต Settings
   */
  updateSettings: function(settingsObj) {
    var upserts = Object.keys(settingsObj).map(function(key) {
      return { key: key, value: settingsObj[key] };
    });

    return _getSupabase()
      .from('settings')
      .upsert(upserts, { onConflict: 'key' })
      .then(function(response) {
        if (response.error) {
          return { status: false, message: response.error.message };
        }
        return { status: true, message: 'บันทึกการตั้งค่าสำเร็จ' };
      });
  },

  /**
   * ประวัติ Export
   */
  getExportHistory: function() {
    return _getSupabase()
      .from('export_logs')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(100)
      .then(function(response) {
        return {
          status: true,
          history: (response.data || []).map(function(log) {
            return {
              id: log.id,
              timestamp: log.created_at,
              action: log.action,
              description: log.description,
              templateName: log.template_name,
              totalFiles: log.total_files,
              details: log.details
            };
          })
        };
      });
  },

  /**
   * ล้างประวัติ Export
   */
  clearExportHistory: function() {
    return _getSupabase()
      .from('export_logs')
      .delete()
      .neq('id', '00000000-0000-0000-0000-000000000000') // delete all
      .then(function() {
        return { status: true, message: 'ล้างประวัติสำเร็จ' };
      });
  },


  // ═══════════════════════════════════════════════════════════════════════
  // 🌐 PUBLIC / GUEST — Supabase RPC (anon)
  // ═══════════════════════════════════════════════════════════════════════

  guestSearchCertificates: function(searchName, templateId) {
    return _getSupabase()
      .rpc('guest_search_certificates', {
        search_name: searchName,
        search_template_id: templateId || null
      })
      .then(function(response) {
        if (response.error) {
          return { status: false, results: [], message: response.error.message };
        }
        return { status: true, results: response.data || [] };
      });
  },

  getPublicTemplateList: function() {
    return _getSupabase()
      .rpc('get_public_template_list')
      .then(function(response) {
        if (response.error) {
          return { status: false, templates: [] };
        }
        return { status: true, templates: response.data || [] };
      });
  },


  // ═══════════════════════════════════════════════════════════════════════
  // 🔧 DIAGNOSTIC — Local
  // ═══════════════════════════════════════════════════════════════════════

  diagnoseCertSystem: function() {
    return Promise.all([
      _getSupabase().from('templates').select('id', { count: 'exact', head: true }),
      _getSupabase().from('records').select('id', { count: 'exact', head: true }),
      _getSupabase().from('settings').select('key, value').eq('key', 'version')
    ])
    .then(function(results) {
      var version = results[2].data && results[2].data[0] ? results[2].data[0].value : 'unknown';
      return {
        status: true,
        diagnostics: {
          supabaseConnected: true,
          templatesCount: results[0].count || 0,
          recordsCount: results[1].count || 0,
          version: version,
          timestamp: new Date().toISOString()
        }
      };
    })
    .catch(function(err) {
      return {
        status: false,
        diagnostics: { supabaseConnected: false, error: err.message }
      };
    });
  }
};


// ═══════════════════════════════════════════════════════════════════════
// HELPER FUNCTIONS — Data Mapping
// ═══════════════════════════════════════════════════════════════════════

/**
 * Map DB record → old format (ที่ core.js/export.js คาดหวัง)
 */
function _mapRecordFromDb(row, idx) {
  return {
    rowIndex: idx !== undefined ? idx : row.row_number,
    id: row.id,
    recordId: row.id,
    prefixNumber: row.prefix_number || '',
    name: row.full_name || '',
    fullName: row.full_name || '',
    school: row.school_name || '',
    schoolName: row.school_name || '',
    certNumber: row.cert_number || '',
    certStatus: row.cert_status || '',
    driveFileId: row.drive_file_id || '',
    driveUrl: row.drive_url || '',
    extra1: row.extra_field_1 || '',
    extra2: row.extra_field_2 || '',
    extra3: row.extra_field_3 || '',
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

/**
 * Map old format → DB record
 */
function _mapRecordToDb(record) {
  var db = {};
  if (record.prefixNumber !== undefined) db.prefix_number = record.prefixNumber;
  if (record.name !== undefined) db.full_name = record.name;
  if (record.fullName !== undefined) db.full_name = record.fullName;
  if (record.school !== undefined) db.school_name = record.school;
  if (record.schoolName !== undefined) db.school_name = record.schoolName;
  if (record.certNumber !== undefined) db.cert_number = record.certNumber;
  if (record.certStatus !== undefined) db.cert_status = record.certStatus;
  if (record.driveFileId !== undefined) db.drive_file_id = record.driveFileId;
  if (record.driveUrl !== undefined) db.drive_url = record.driveUrl;
  if (record.extra1 !== undefined) db.extra_field_1 = record.extra1;
  if (record.extra2 !== undefined) db.extra_field_2 = record.extra2;
  if (record.extra3 !== undefined) db.extra_field_3 = record.extra3;
  if (record.rowNumber !== undefined) db.row_number = record.rowNumber;
  return db;
}

/**
 * Log login activity
 */
function _logLoginActivity(userId, username) {
  _getSupabase()
    .from('login_logs')
    .insert({
      user_id: userId,
      action: 'login',
      ip_address: null,
      user_agent: navigator.userAgent.substring(0, 255)
    })
    .then(function() {})
    .catch(function() {}); // Silent — don't block login
}


// ═══════════════════════════════════════════════════════════════════════
// DYNAMIC FALLBACK — ป้องกัน "is not a function" error
// ═══════════════════════════════════════════════════════════════════════
if (typeof Proxy !== 'undefined') {
  api = new Proxy(api, {
    get: function(target, prop) {
      if (prop in target) return target[prop];
      // Dynamic method: ถ้ายังไม่มี → ลอง GAS
      return function() {
        var args = Array.prototype.slice.call(arguments);
        console.warn('api.' + prop + '() — ไม่มีใน Supabase, fallback to GAS');
        return target._callGAS(prop, { _args: args });
      };
    }
  });
}
