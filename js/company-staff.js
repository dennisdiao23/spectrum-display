(function (global) {
  'use strict';

  var S = {
    api: null,
    esc: function (s) { return String(s == null ? '' : s); },
    fillStaffRoleSelect: null,
    staffRoleLabel: null,
    goCompany: null,
    pathForTab: null,
    canEditStaff: function () { return true; },
    onListChanged: null,
    activeId: '',
    detail: null
  };

  function $(id) { return document.getElementById(id); }

  function showMsg(text, ok) {
    var el = $('su-msg');
    if (!el) return;
    el.textContent = text || '';
    el.className = 'text-sm ' + (ok ? 'text-sky-600' : 'text-red-500');
    el.classList.toggle('hidden', !text);
  }

  function initials(person) {
    var a = ((person && (person.firstName || person.name || person.email)) || '?').trim().charAt(0);
    var b = ((person && person.lastName) || '').trim().charAt(0);
    return (a + b).toUpperCase() || '?';
  }

  function setPhoto(person) {
    var img = $('su-photo-img');
    var fallback = $('su-photo-fallback');
    var url = person && person.photoUrl;
    if (img) {
      if (url) {
        img.src = url;
        img.classList.remove('hidden');
      } else {
        img.removeAttribute('src');
        img.classList.add('hidden');
      }
    }
    if (fallback) {
      fallback.textContent = initials(person || {});
      fallback.classList.toggle('hidden', !!url);
    }
  }

  function fillForm(person) {
    S.detail = person || null;
    S.activeId = person && person.id != null ? String(person.id) : '';
    $('su-id').value = S.activeId;
    $('su-name').value = (person && person.name) || '';
    $('su-email').value = (person && person.email) || '';
    $('su-first').value = (person && person.firstName) || '';
    $('su-last').value = (person && person.lastName) || '';
    $('su-job').value = (person && person.jobTitle) || '';
    $('su-phone').value = (person && person.phone) || '';
    $('su-mobile').value = (person && person.mobile) || '';
    $('su-personal-email').value = (person && person.personalEmail) || '';
    $('su-notes').value = (person && person.notes) || '';
    $('su-street').value = (person && person.street) || '';
    $('su-street2').value = (person && person.street2) || '';
    $('su-city').value = (person && person.city) || '';
    $('su-state').value = (person && person.state) || '';
    $('su-zip').value = (person && person.zip) || '';
    $('su-country').value = (person && person.country) || 'United States';
    $('su-password').value = '';
    $('su-password').required = !S.activeId;
    $('su-password-hint').textContent = S.activeId
      ? 'Leave blank to keep the current Company login password.'
      : 'At least 8 characters.';
    if (S.fillStaffRoleSelect) S.fillStaffRoleSelect(person && person.role);
    var roleSel = $('su-role');
    if (roleSel && person && person.role) {
      roleSel.value = person.role;
      if (roleSel.value !== person.role) {
        // Role option missing (e.g. owner filtered) — force it in
        var opt = document.createElement('option');
        opt.value = person.role;
        opt.textContent = (S.staffRoleLabel && S.staffRoleLabel(person.role)) || person.role;
        roleSel.appendChild(opt);
        roleSel.value = person.role;
      }
    }
    $('su-created').textContent = person && person.created_at
      ? new Date(person.created_at).toLocaleString()
      : '—';
    var title = $('su-title');
    if (title) title.textContent = (person && (person.displayName || person.name)) || 'New user';
    var sub = $('su-sub');
    if (sub) sub.textContent = (person && person.email) || 'Company staff login';
    setPhoto(person);
    renderAccounts((person && person.accounts) || []);
    renderFiles((person && person.files) || []);
    var del = $('su-delete');
    if (del) {
      var canDel = !!S.activeId && !(S.canDeleteStaff && !S.canDeleteStaff(S.activeId));
      del.classList.toggle('hidden', !canDel);
    }
    showMsg('');
  }

  function formBody() {
    return {
      name: $('su-name').value.trim(),
      email: $('su-email').value.trim(),
      role: $('su-role').value,
      password: $('su-password').value,
      firstName: $('su-first').value.trim(),
      lastName: $('su-last').value.trim(),
      jobTitle: $('su-job').value.trim(),
      phone: $('su-phone').value.trim(),
      mobile: $('su-mobile').value.trim(),
      personalEmail: $('su-personal-email').value.trim(),
      notes: $('su-notes').value.trim(),
      street: $('su-street').value.trim(),
      street2: $('su-street2').value.trim(),
      city: $('su-city').value.trim(),
      state: $('su-state').value.trim(),
      zip: $('su-zip').value.trim(),
      country: $('su-country').value.trim()
    };
  }

  function renderAccounts(list) {
    var host = $('su-accounts');
    if (!host) return;
    if (!list.length) {
      host.innerHTML = '<p class="su-empty">No company accounts yet. Add email, phone, or other logins issued by Spectrum.</p>';
      return;
    }
    host.innerHTML = list.map(function (a) {
      return '<article class="su-account" data-account-id="' + S.esc(a.id) + '">' +
        '<div class="su-account-top">' +
          '<strong>' + S.esc(a.label || a.type) + '</strong>' +
          '<span class="su-account-type">' + S.esc(a.type) + '</span>' +
        '</div>' +
        '<p class="su-account-user">' + S.esc(a.username || '—') + '</p>' +
        '<div class="su-account-secret">' +
          '<input type="password" readonly value="' + S.esc(a.secret || '') + '" data-secret>' +
          '<button type="button" class="su-link" data-toggle-secret>Show</button>' +
        '</div>' +
        (a.notes ? '<p class="su-account-notes">' + S.esc(a.notes) + '</p>' : '') +
        '<div class="su-account-actions">' +
          '<button type="button" class="su-link" data-edit-account>Edit</button>' +
          '<button type="button" class="su-link is-danger" data-del-account>Remove</button>' +
        '</div>' +
      '</article>';
    }).join('');
  }

  function renderFiles(list) {
    var host = $('su-files');
    if (!host) return;
    if (!list.length) {
      host.innerHTML = '<p class="su-empty">No files yet. Drop files here to upload.</p>';
      return;
    }
    host.innerHTML = list.map(function (f) {
      var size = f.size > 1024 * 1024
        ? (f.size / (1024 * 1024)).toFixed(1) + ' MB'
        : Math.max(1, Math.round(f.size / 1024)) + ' KB';
      return '<div class="su-file" data-file-id="' + S.esc(f.id) + '">' +
        '<a href="' + S.esc(f.url) + '" target="_blank" rel="noopener">' + S.esc(f.name) + '</a>' +
        '<span>' + S.esc(size) + '</span>' +
        '<button type="button" class="su-link is-danger" data-del-file>Remove</button>' +
      '</div>';
    }).join('');
  }

  function showList() {
    var list = $('staff-list-wrap');
    var detail = $('staff-detail-pane');
    if (list) list.classList.remove('hidden');
    if (detail) {
      detail.classList.add('hidden');
      detail.hidden = true;
      detail.setAttribute('aria-hidden', 'true');
    }
    S.activeId = '';
    S.detail = null;
  }

  function showDetail() {
    var list = $('staff-list-wrap');
    var detail = $('staff-detail-pane');
    if (list) list.classList.add('hidden');
    if (detail) {
      detail.classList.remove('hidden');
      detail.hidden = false;
      detail.setAttribute('aria-hidden', 'false');
    }
  }

  async function openUser(id, push) {
    if (!S.api) return;
    showDetail();
    if (!id) {
      fillForm(null);
      if (push && S.goCompany) S.goCompany('/company/settings/users/new');
      return;
    }
    showMsg('Loading…', true);
    try {
      var data = await S.api('/api/admin/staff/' + encodeURIComponent(id));
      fillForm(data.staff);
      if (push && S.goCompany) S.goCompany('/company/settings/users/' + encodeURIComponent(id));
    } catch (err) {
      showMsg(err.message || 'Could not load user.');
    }
  }

  async function saveUser(e) {
    if (e) e.preventDefault();
    if (!S.canEditStaff()) return;
    var body = formBody();
    if (!body.password) delete body.password;
    try {
      var data;
      if (S.activeId) {
        data = await S.api('/api/admin/staff/' + encodeURIComponent(S.activeId), {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body)
        });
      } else {
        data = await S.api('/api/admin/staff', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body)
        });
      }
      fillForm(data.staff);
      if (S.onListChanged) await S.onListChanged();
      if (S.goCompany && data.staff && data.staff.id) {
        S.goCompany('/company/settings/users/' + encodeURIComponent(data.staff.id), true);
      }
      showMsg('Saved.', true);
    } catch (err) {
      showMsg(err.message || 'Could not save user.');
    }
  }

  async function uploadPhoto(file) {
    if (!S.activeId) {
      showMsg('Save the user first, then add a photo.');
      return;
    }
    var fd = new FormData();
    fd.append('photo', file);
    try {
      var data = await S.api('/api/admin/staff/' + encodeURIComponent(S.activeId) + '/photo', {
        method: 'POST',
        body: fd
      });
      fillForm(data.staff);
      if (S.onListChanged) await S.onListChanged();
      showMsg('Photo updated.', true);
    } catch (err) {
      showMsg(err.message || 'Could not upload photo.');
    }
  }

  async function uploadFiles(fileList) {
    if (!S.activeId) {
      showMsg('Save the user first, then upload files.');
      return;
    }
    var files = Array.prototype.slice.call(fileList || []);
    if (!files.length) return;
    var fd = new FormData();
    files.forEach(function (f) { fd.append('files', f); });
    try {
      await S.api('/api/admin/staff/' + encodeURIComponent(S.activeId) + '/files', {
        method: 'POST',
        body: fd
      });
      var data = await S.api('/api/admin/staff/' + encodeURIComponent(S.activeId));
      fillForm(data.staff);
      showMsg('Files uploaded.', true);
    } catch (err) {
      showMsg(err.message || 'Could not upload files.');
    }
  }

  function bind() {
    var form = $('su-form');
    if (!form || form.dataset.bound) return;
    form.dataset.bound = '1';

    form.addEventListener('submit', saveUser);
    var back = $('su-back');
    if (back) back.addEventListener('click', function () {
      showList();
      if (S.goCompany) S.goCompany('/company/settings');
    });
    var del = $('su-delete');
    if (del) del.addEventListener('click', async function () {
      if (!S.activeId) return;
      if (!confirm('Remove this Admin login? They will not be able to sign in here.')) return;
      try {
        await S.api('/api/admin/staff/' + encodeURIComponent(S.activeId), { method: 'DELETE' });
        if (S.onListChanged) await S.onListChanged();
        showList();
        if (S.goCompany) S.goCompany('/company/settings');
      } catch (err) {
        showMsg(err.message || 'Could not remove user.');
      }
    });

    var photoInput = $('su-photo-input');
    var photoBtn = $('su-photo-btn');
    var photoClear = $('su-photo-clear');
    if (photoBtn && photoInput) {
      photoBtn.addEventListener('click', function () { photoInput.click(); });
      photoInput.addEventListener('change', function () {
        if (photoInput.files && photoInput.files[0]) uploadPhoto(photoInput.files[0]);
        photoInput.value = '';
      });
    }
    if (photoClear) {
      photoClear.addEventListener('click', async function () {
        if (!S.activeId) return;
        try {
          var data = await S.api('/api/admin/staff/' + encodeURIComponent(S.activeId) + '/photo', { method: 'DELETE' });
          fillForm(data.staff);
          if (S.onListChanged) await S.onListChanged();
          showMsg('Photo removed.', true);
        } catch (err) {
          showMsg(err.message || 'Could not remove photo.');
        }
      });
    }

    var drop = $('su-file-drop');
    var fileInput = $('su-file-input');
    if (drop) {
      ['dragenter', 'dragover'].forEach(function (ev) {
        drop.addEventListener(ev, function (e) {
          e.preventDefault();
          drop.classList.add('is-drag');
        });
      });
      ['dragleave', 'drop'].forEach(function (ev) {
        drop.addEventListener(ev, function (e) {
          e.preventDefault();
          drop.classList.remove('is-drag');
        });
      });
      drop.addEventListener('drop', function (e) {
        uploadFiles(e.dataTransfer && e.dataTransfer.files);
      });
      drop.addEventListener('click', function () {
        if (fileInput) fileInput.click();
      });
    }
    if (fileInput) {
      fileInput.addEventListener('change', function () {
        uploadFiles(fileInput.files);
        fileInput.value = '';
      });
    }

    var filesHost = $('su-files');
    if (filesHost) {
      filesHost.addEventListener('click', async function (e) {
        var btn = e.target.closest('[data-del-file]');
        if (!btn) return;
        var row = btn.closest('[data-file-id]');
        if (!row || !S.activeId) return;
        if (!confirm('Remove this file?')) return;
        try {
          await S.api('/api/admin/staff/' + encodeURIComponent(S.activeId) + '/files/' + encodeURIComponent(row.getAttribute('data-file-id')), {
            method: 'DELETE'
          });
          var data = await S.api('/api/admin/staff/' + encodeURIComponent(S.activeId));
          fillForm(data.staff);
        } catch (err) {
          showMsg(err.message || 'Could not remove file.');
        }
      });
    }

    var addAccount = $('su-account-add');
    if (addAccount) {
      addAccount.addEventListener('click', function () {
        $('su-account-form').classList.remove('hidden');
        $('su-acc-id').value = '';
        $('su-acc-type').value = 'email';
        $('su-acc-label').value = '';
        $('su-acc-user').value = '';
        $('su-acc-secret').value = '';
        $('su-acc-notes').value = '';
      });
    }
    var cancelAccount = $('su-acc-cancel');
    if (cancelAccount) {
      cancelAccount.addEventListener('click', function () {
        $('su-account-form').classList.add('hidden');
      });
    }
    var saveAccount = $('su-acc-save');
    if (saveAccount) {
      saveAccount.addEventListener('click', async function () {
        if (!S.activeId) {
          showMsg('Save the user first, then add company accounts.');
          return;
        }
        var body = {
          type: $('su-acc-type').value,
          label: $('su-acc-label').value.trim(),
          username: $('su-acc-user').value.trim(),
          secret: $('su-acc-secret').value,
          notes: $('su-acc-notes').value.trim()
        };
        var accId = $('su-acc-id').value;
        try {
          if (accId) {
            await S.api('/api/admin/staff/' + encodeURIComponent(S.activeId) + '/accounts/' + encodeURIComponent(accId), {
              method: 'PUT',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(body)
            });
          } else {
            await S.api('/api/admin/staff/' + encodeURIComponent(S.activeId) + '/accounts', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(body)
            });
          }
          $('su-account-form').classList.add('hidden');
          var data = await S.api('/api/admin/staff/' + encodeURIComponent(S.activeId));
          fillForm(data.staff);
          showMsg('Account saved.', true);
        } catch (err) {
          showMsg(err.message || 'Could not save account.');
        }
      });
    }

    var accountsHost = $('su-accounts');
    if (accountsHost) {
      accountsHost.addEventListener('click', async function (e) {
        var card = e.target.closest('[data-account-id]');
        if (!card) return;
        var id = card.getAttribute('data-account-id');
        if (e.target.closest('[data-toggle-secret]')) {
          var input = card.querySelector('[data-secret]');
          var btn = e.target.closest('[data-toggle-secret]');
          if (!input) return;
          var show = input.type === 'password';
          input.type = show ? 'text' : 'password';
          btn.textContent = show ? 'Hide' : 'Show';
          return;
        }
        if (e.target.closest('[data-del-account]')) {
          if (!confirm('Remove this company account?')) return;
          try {
            await S.api('/api/admin/staff/' + encodeURIComponent(S.activeId) + '/accounts/' + encodeURIComponent(id), {
              method: 'DELETE'
            });
            var data = await S.api('/api/admin/staff/' + encodeURIComponent(S.activeId));
            fillForm(data.staff);
          } catch (err) {
            showMsg(err.message || 'Could not remove account.');
          }
          return;
        }
        if (e.target.closest('[data-edit-account]')) {
          var acc = (S.detail && S.detail.accounts || []).find(function (a) {
            return String(a.id) === String(id);
          });
          if (!acc) return;
          $('su-account-form').classList.remove('hidden');
          $('su-acc-id').value = acc.id;
          $('su-acc-type').value = acc.type || 'other';
          $('su-acc-label').value = acc.label || '';
          $('su-acc-user').value = acc.username || '';
          $('su-acc-secret').value = acc.secret || '';
          $('su-acc-notes').value = acc.notes || '';
        }
      });
    }
  }

  function boot(opts) {
    Object.assign(S, opts || {});
    bind();
  }

  global.SpectrumStaff = {
    boot: boot,
    openUser: openUser,
    showList: showList,
    showDetail: showDetail,
    isDetailOpen: function () { return !!S.activeId || !($('staff-detail-pane') || { classList: { contains: function () { return true; } } }).classList.contains('hidden'); }
  };
})(window);
