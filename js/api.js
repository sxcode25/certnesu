/**
 * =========================================================================
 * API.JS — API Layer v2.0: Supabase Backend
 * =========================================================================
 * ✅ Backward Compatible — core.js, canvas.js, export.js ไม่ต้องแก้!
 *    ยังเรียก api.loginUser(), api.getData() ฯลฯ เหมือนเดิม
 *
 * DB Schema (ตรงกับ Setup.gs):
 *   templates: id, name, drive_file_id, elements, canvas_width, canvas_height, number_prefix
 *   records:   id, template_id, name, school, cert_number, cert_date, signer, position,
 *              extra1-5, status, drive_file_url
 *   settings:  key, value, description
 *   export_logs: id, user_id, username, action, record_count, status, note
 *   login_logs:  id, user_id, action, ip_address, user_agent
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

  loginUser: function(username, password) {
    var email = username;
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

          // Log login (silent)
          _getSupabase().from('login_logs').insert({
            user_id: user.id,
            username: userData.username,
            action: 'login',
            status: 'success',
            note: navigator.userAgent.substring(0, 255)
          }).then(function(){}).catch(function(){});

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

  logoutUser: function() {
    return _getSupabase().auth.signOut()
      .then(function() { return { status: true }; })
      .catch(function(err) { return { status: false, message: err.message }; });
  },

  logout: function() { return api.logoutUser(); },

  changePassword: function(oldPassword, newPassword) {
    return _getSupabase().auth.getUser()
      .then(function(userRes) {
        if (userRes.error) throw userRes.error;
        var email = userRes.data.user.email;

        return _getSupabase().auth.signInWithPassword({ email: email, password: oldPassword })
          .then(function(loginRes) {
            if (loginRes.error) {
              return { status: false, message: 'รหัสผ่านเดิมไม่ถูกต้อง' };
            }
            return _getSupabase().auth.updateUser({ password: newPassword })
              .then(function(updateRes) {
                if (updateRes.error) return { status: false, message: updateRes.error.message };
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
  // DB columns: id, template_id, name, school, cert_number, cert_date,
  //             signer, position, extra1-5, status, drive_file_url
  // ═══════════════════════════════════════════════════════════════════════

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

    if (templateId) {
      query = query.eq('template_id', templateId);
    }

    if (search) {
      query = query.or(
        'name.ilike.%' + search + '%,' +
        'school.ilike.%' + search + '%,' +
        'cert_number.ilike.%' + search + '%'
      );
    }

    // Sort mapping (column index → DB column)
    var sortColumns = ['created_at', 'cert_number', 'name', 'school', 'cert_number', 'status', 'created_at'];
    var sortCol = sortColumns[sortBy] || 'created_at';
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

      // Map DB → frontend format (backward compatible)
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

  getAllRecords: function() {
    var templateId = AppState.activeTemplateId;
    var query = _getSupabase()
      .from('records')
      .select('*')
      .order('created_at', { ascending: true });

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

      return { status: true, records: records, data: records };
    });
  },

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

  editRecord: function(rowIndex, record) {
    var dbRecord = _mapRecordToDb(record);
    var recordId = record.id || record.recordId;

    var query;
    if (recordId) {
      query = _getSupabase().from('records').update(dbRecord).eq('id', recordId);
    } else {
      // Fallback: ใช้ rowIndex → ดึง record จาก offset
      return api.getAllRecords().then(function(res) {
        if (res.records && res.records[rowIndex]) {
          var id = res.records[rowIndex].id;
          return _getSupabase().from('records').update(dbRecord).eq('id', id)
            .then(function(r) {
              if (r.error) return { status: false, message: r.error.message };
              return { status: true, message: 'แก้ไขข้อมูลสำเร็จ' };
            });
        }
        return { status: false, message: 'ไม่พบ record' };
      });
    }

    return query.then(function(response) {
      if (response.error) {
        return { status: false, message: response.error.message };
      }
      return { status: true, message: 'แก้ไขข้อมูลสำเร็จ' };
    });
  },

  deleteRecords: function(rowIndexes) {
    if (!Array.isArray(rowIndexes)) rowIndexes = [rowIndexes];

    // ถ้าเป็น UUID → ลบ by id ตรง
    var isUuid = rowIndexes[0] && String(rowIndexes[0]).indexOf('-') !== -1;

    if (isUuid) {
      return _getSupabase().from('records').delete().in('id', rowIndexes)
        .then(function(response) {
          if (response.error) return { status: false, message: response.error.message };
          return { status: true, message: 'ลบข้อมูลสำเร็จ ' + rowIndexes.length + ' รายการ' };
        });
    }

    // Fallback: rowIndex → ต้องหา id ก่อน
    return api.getAllRecords().then(function(res) {
      var ids = rowIndexes.map(function(idx) {
        return res.records && res.records[idx] ? res.records[idx].id : null;
      }).filter(Boolean);

      if (ids.length === 0) return { status: false, message: 'ไม่พบ record' };

      return _getSupabase().from('records').delete().in('id', ids)
        .then(function(response) {
          if (response.error) return { status: false, message: response.error.message };
          return { status: true, message: 'ลบข้อมูลสำเร็จ ' + ids.length + ' รายการ' };
        });
    });
  },

  importData: function(jsonData, mode) {
    var data = typeof jsonData === 'string' ? JSON.parse(jsonData) : jsonData;
    var templateId = AppState.activeTemplateId;

    var promise = Promise.resolve();
    if (mode === 'replace') {
      promise = _getSupabase().from('records').delete().eq('template_id', templateId)
        .then(function() {});
    }

    return promise.then(function() {
      var records = data.map(function(row) {
        var dbRecord = _mapRecordToDb(row);
        dbRecord.template_id = templateId;
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

  getNextCertNumber: function() {
    var templateId = AppState.activeTemplateId;
    return _getSupabase()
      .from('records')
      .select('cert_number')
      .eq('template_id', templateId)
      .not('cert_number', 'is', null)
      .neq('cert_number', '')
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

  batchUpdateCertStatus: function(results) {
    if (!results || results.length === 0) {
      return Promise.resolve({ status: true });
    }

    var updates = results.map(function(r) {
      var updateData = { status: r.status || 'exported' };
      if (r.driveUrl) updateData.drive_file_url = r.driveUrl;
      if (r.driveFileUrl) updateData.drive_file_url = r.driveFileUrl;

      if (r.id) {
        return _getSupabase().from('records').update(updateData).eq('id', r.id);
      }
      return Promise.resolve();
    });

    return Promise.all(updates)
      .then(function() { return { status: true }; })
      .catch(function(err) { return { status: false, message: err.message }; });
  },

  updateRecordStatuses: function(updates) {
    return api.batchUpdateCertStatus(updates);
  },


  // ═══════════════════════════════════════════════════════════════════════
  // 🎨 TEMPLATE MANAGEMENT — Supabase PostgREST
  // DB columns: id, name, drive_file_id, elements, canvas_width,
  //             canvas_height, number_prefix
  // ═══════════════════════════════════════════════════════════════════════

  getTemplateList: function() {
    return _getSupabase()
      .from('templates')
      .select('id, name, number_prefix, drive_file_id')
      .order('name')
      .then(function(response) {
        if (response.error) {
          return { status: false, templates: [] };
        }
        var templates = (response.data || []).map(function(t) {
          return {
            template_id: t.id,
            id: t.id,
            template_name: t.name,
            name: t.name,
            number_prefix: t.number_prefix || '',
            prefix: t.number_prefix || '',
            drive_file_id: t.drive_file_id || '',
            driveFileId: t.drive_file_id || ''
          };
        });
        return { status: true, templates: templates };
      });
  },

  getTemplateListWithCounts: function() {
    return _getSupabase()
      .from('templates')
      .select('id, name, number_prefix, drive_file_id')
      .order('name')
      .then(function(response) {
        if (response.error) {
          return { status: false, templates: [] };
        }
        var templates = response.data || [];

        // Count records per template
        var countPromises = templates.map(function(t) {
          return _getSupabase()
            .from('records')
            .select('id', { count: 'exact', head: true })
            .eq('template_id', t.id)
            .then(function(r) {
              return {
                template_id: t.id,
                id: t.id,
                template_name: t.name,
                name: t.name,
                number_prefix: t.number_prefix || '',
                prefix: t.number_prefix || '',
                recordCount: r.count || 0,
                drive_file_id: t.drive_file_id || '',
                driveFileId: t.drive_file_id || ''
              };
            });
        });

        return Promise.all(countPromises).then(function(results) {
          return { status: true, templates: results };
        });
      });
  },

  switchTemplateContext: function(templateId) {
    // Use the DB RPC function
    return _getSupabase()
      .rpc('switch_template_context', { p_template_id: templateId })
      .then(function(response) {
        if (response.error) {
          return { status: false, message: response.error.message || 'ไม่พบ template' };
        }
        var data = response.data;
        if (!data || !data.config) {
          return { status: false, message: 'ไม่พบ template' };
        }

        // Map DB field names → core.js expected names
        var cfg = data.config;
        var config = {
          template_id: cfg.id,
          template_name: cfg.name,
          drive_file_id: cfg.drive_file_id || '',
          elements: cfg.elements || [],
          canvas_width: cfg.canvas_width || 3508,
          canvas_height: cfg.canvas_height || 2480,
          number_prefix: cfg.number_prefix || ''
        };

        return {
          status: true,
          config: config,
          stats: data.stats,
          data: null,  // core.js checks result.data.status
          schools: data.schools || [],
          total: data.total || 0
        };
      });
  },

  saveTemplateConfig: function(config) {
    // canvas.js ส่ง: { template_id, template_name, drive_file_id, elements,
    //                  canvas_width, canvas_height, number_prefix }
    var templateId = config.template_id || config.id || config.templateId || AppState.activeTemplateId;
    var name = config.template_name || config.name || config.templateName || 'Template ไม่มีชื่อ';

    var dbData = {
      name: name,
      drive_file_id: config.drive_file_id || config.driveFileId || '',
      elements: config.elements || '[]',
      canvas_width: config.canvas_width || config.canvasWidth || 3508,
      canvas_height: config.canvas_height || config.canvasHeight || 2480,
      number_prefix: config.number_prefix || config.prefix || ''
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
          return { status: true, message: 'บันทึก Template สำเร็จ', template_id: response.data.id, templateId: response.data.id };
        });
    } else {
      // Insert new
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
            return { status: true, message: 'สร้าง Template ใหม่สำเร็จ', template_id: response.data.id, templateId: response.data.id };
          });
      });
    }
  },

  loadTemplateConfig: function(templateId) {
    return api.switchTemplateContext(templateId);
  },

  renameTemplate: function(templateId, newName, newPrefix) {
    return _getSupabase()
      .from('templates')
      .update({ name: newName, number_prefix: newPrefix || '' })
      .eq('id', templateId)
      .then(function(response) {
        if (response.error) return { status: false, message: response.error.message };
        return { status: true, message: 'เปลี่ยนชื่อสำเร็จ' };
      });
  },

  duplicateTemplate: function(templateId, newName, newPrefix) {
    return _getSupabase()
      .from('templates')
      .select('*')
      .eq('id', templateId)
      .single()
      .then(function(response) {
        if (response.error) return { status: false, message: response.error.message };
        var original = response.data;
        var newTpl = {
          name: newName,
          drive_file_id: original.drive_file_id,
          elements: original.elements,
          canvas_width: original.canvas_width,
          canvas_height: original.canvas_height,
          number_prefix: newPrefix || ''
        };

        return _getSupabase().auth.getUser().then(function(userRes) {
          if (userRes.data && userRes.data.user) {
            newTpl.created_by = userRes.data.user.id;
          }
          return _getSupabase()
            .from('templates')
            .insert(newTpl)
            .select()
            .single()
            .then(function(insertRes) {
              if (insertRes.error) return { status: false, message: insertRes.error.message };
              return { status: true, message: 'Duplicate สำเร็จ', templateId: insertRes.data.id };
            });
        });
      });
  },

  deleteTemplate: function(templateId) {
    return _getSupabase()
      .from('templates')
      .delete()
      .eq('id', templateId)
      .then(function(response) {
        if (response.error) return { status: false, message: response.error.message };
        return { status: true, message: 'ลบ Template สำเร็จ' };
      });
  },

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

  _callGAS: function(action, params) {
    params = params || {};
    var body = { action: action };
    for (var key in params) {
      if (params.hasOwnProperty(key)) body[key] = params[key];
    }

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
    return Promise.resolve({
      status: true,
      url: 'https://drive.google.com/uc?export=view&id=' + fileId
    });
  },

  getUploadConfig: function(templateName) {
    return _getSupabase()
      .from('settings')
      .select('key, value')
      .in('key', ['drive_root_folder', 'drive_template_folder', 'drive_export_folder', 'drive_zip_folder'])
      .then(function(response) {
        var config = {};
        (response.data || []).forEach(function(s) {
          config[s.key] = s.value;
        });
        return {
          status: true,
          config: {
            templateName: templateName,
            rootFolderId: config.drive_root_folder || '',
            templatesFolderId: config.drive_template_folder || '',
            generatedFolderId: config.drive_export_folder || '',
            zipFolderId: config.drive_zip_folder || ''
          }
        };
      });
  },


  // ═══════════════════════════════════════════════════════════════════════
  // 📊 DASHBOARD & SETTINGS — Supabase
  // ═══════════════════════════════════════════════════════════════════════

  getStats: function() {
    var templateId = AppState.activeTemplateId;

    return _getSupabase()
      .rpc('get_dashboard_stats', { p_template_id: templateId || null })
      .then(function(response) {
        if (response.error) {
          return { status: true, stats: { totalRecords: 0, exportedRecords: 0, pendingRecords: 0, totalTemplates: 0 } };
        }
        var d = response.data || {};
        return {
          status: true,
          stats: {
            totalRecords: d.total || 0,
            exportedRecords: d.exported || 0,
            pendingRecords: d.pending || 0,
            generatedRecords: d.generated || 0,
            totalTemplates: d.templates || 0
          }
        };
      });
  },

  getRecentActivity: function() {
    return _getSupabase()
      .from('export_logs')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(20)
      .then(function(response) {
        var activities = (response.data || []).map(function(log) {
          return {
            id: log.id,
            timestamp: log.created_at,
            action: log.action || 'export',
            description: log.note || '',
            username: log.username || '',
            recordCount: log.record_count || 0,
            status: log.status || 'success'
          };
        });
        return { status: true, activities: activities };
      });
  },

  getSettings: function() {
    return _getSupabase()
      .from('settings')
      .select('key, value')
      .then(function(response) {
        if (response.error) return { status: false, settings: {} };
        var settings = {};
        (response.data || []).forEach(function(s) {
          settings[s.key] = s.value;
        });
        return { status: true, settings: settings };
      });
  },

  updateSettings: function(settingsObj) {
    var upserts = Object.keys(settingsObj).map(function(key) {
      return { key: key, value: settingsObj[key] };
    });

    return _getSupabase()
      .from('settings')
      .upsert(upserts, { onConflict: 'key' })
      .then(function(response) {
        if (response.error) return { status: false, message: response.error.message };
        return { status: true, message: 'บันทึกการตั้งค่าสำเร็จ' };
      });
  },

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
              description: log.note,
              username: log.username,
              totalFiles: log.record_count,
              status: log.status
            };
          })
        };
      });
  },

  clearExportHistory: function() {
    return _getSupabase()
      .from('export_logs')
      .delete()
      .neq('id', '00000000-0000-0000-0000-000000000000')
      .then(function() {
        return { status: true, message: 'ล้างประวัติสำเร็จ' };
      });
  },


  // ═══════════════════════════════════════════════════════════════════════
  // 🌐 PUBLIC / GUEST — Supabase RPC
  // ═══════════════════════════════════════════════════════════════════════

  guestSearchCertificates: function(searchName, templateId) {
    return _getSupabase()
      .rpc('guest_search_certificates', {
        p_search_name: searchName,
        p_template_id: templateId || null
      })
      .then(function(response) {
        if (response.error) {
          return { status: false, results: [], message: response.error.message };
        }
        // RPC returns JSON object with status, results, total
        var data = response.data || {};
        return {
          status: data.status !== undefined ? data.status : true,
          results: data.results || [],
          total: data.total || 0,
          message: data.message || ''
        };
      });
  },

  getPublicTemplateList: function() {
    return _getSupabase()
      .rpc('get_public_template_list')
      .then(function(response) {
        if (response.error) {
          return { status: false, templates: [] };
        }
        var data = response.data || {};
        return {
          status: data.status !== undefined ? data.status : true,
          templates: data.templates || []
        };
      });
  },


  // ═══════════════════════════════════════════════════════════════════════
  // 🔧 DIAGNOSTIC
  // ═══════════════════════════════════════════════════════════════════════

  diagnoseCertSystem: function() {
    return _getSupabase()
      .rpc('health_check')
      .then(function(response) {
        if (response.error) {
          return {
            status: false,
            diagnostics: { supabaseConnected: false, error: response.error.message }
          };
        }
        var data = response.data || {};
        return {
          status: true,
          diagnostics: {
            supabaseConnected: true,
            version: data.version || 'unknown',
            tables: data.tables || {},
            timestamp: data.timestamp || new Date().toISOString()
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
 * Map DB record → frontend format (backward compatible with core.js/export.js)
 * DB: id, template_id, name, school, cert_number, cert_date, signer, position,
 *     extra1-5, status, drive_file_url
 */
function _mapRecordFromDb(row, idx) {
  return {
    rowIndex: idx !== undefined ? idx : 0,
    id: row.id,
    recordId: row.id,
    templateId: row.template_id,
    name: row.name || '',
    fullName: row.name || '',
    school: row.school || '',
    schoolName: row.school || '',
    certNumber: row.cert_number || '',
    certDate: row.cert_date || '',
    signer: row.signer || '',
    position: row.position || '',
    extra1: row.extra1 || '',
    extra2: row.extra2 || '',
    extra3: row.extra3 || '',
    extra4: row.extra4 || '',
    extra5: row.extra5 || '',
    status: row.status || 'pending',
    certStatus: row.status || 'pending',
    driveFileUrl: row.drive_file_url || '',
    driveUrl: row.drive_file_url || '',
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

/**
 * Map frontend format → DB record
 */
function _mapRecordToDb(record) {
  var db = {};
  if (record.name !== undefined) db.name = record.name;
  if (record.fullName !== undefined) db.name = record.fullName;
  if (record.school !== undefined) db.school = record.school;
  if (record.schoolName !== undefined) db.school = record.schoolName;
  if (record.certNumber !== undefined) db.cert_number = record.certNumber;
  if (record.cert_number !== undefined) db.cert_number = record.cert_number;
  if (record.certDate !== undefined) db.cert_date = record.certDate;
  if (record.cert_date !== undefined) db.cert_date = record.cert_date;
  if (record.signer !== undefined) db.signer = record.signer;
  if (record.position !== undefined) db.position = record.position;
  if (record.extra1 !== undefined) db.extra1 = record.extra1;
  if (record.extra2 !== undefined) db.extra2 = record.extra2;
  if (record.extra3 !== undefined) db.extra3 = record.extra3;
  if (record.extra4 !== undefined) db.extra4 = record.extra4;
  if (record.extra5 !== undefined) db.extra5 = record.extra5;
  if (record.status !== undefined) db.status = record.status;
  if (record.certStatus !== undefined) db.status = record.certStatus;
  if (record.driveFileUrl !== undefined) db.drive_file_url = record.driveFileUrl;
  if (record.driveUrl !== undefined) db.drive_file_url = record.driveUrl;
  return db;
}


// ═══════════════════════════════════════════════════════════════════════
// DYNAMIC FALLBACK — ป้องกัน "is not a function" error
// ═══════════════════════════════════════════════════════════════════════
if (typeof Proxy !== 'undefined') {
  api = new Proxy(api, {
    get: function(target, prop) {
      if (prop in target) return target[prop];
      return function() {
        var args = Array.prototype.slice.call(arguments);
        console.warn('api.' + prop + '() — ไม่มีใน Supabase, fallback to GAS');
        return target._callGAS(prop, { _args: args });
      };
    }
  });
}
