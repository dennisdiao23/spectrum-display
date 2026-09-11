(function (global) {
  'use strict';

  var H = {
    api: null,
    canUse: function () { return true; },
    canEdit: function () { return true; },
    esc: function (v) {
      return String(v == null ? '' : v)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
    },
    isMobile: function () { return false; },
    openQuote: null,
    pushPath: null,
    companyPath: function () { return location.pathname; },
    adminName: function () { return ''; }
  };

  var S = {
    view: 'leads',
    leads: [],
    deals: [],
    activities: [],
    assignees: [],
    sequences: [],
    leadFilter: 'all',
    activityFilter: 'all',
    dealKind: 'all',
    leadId: '',
    dealId: '',
    activityId: '',
    leadTab: 'details',
    dealTab: 'details',
    dirty: false,
    drawer: '',
    pendingMove: null,
    loaded: false,
    booted: false
  };

  var LEAD_STATUSES = [
    { id: 'new', label: 'New' },
    { id: 'working', label: 'Working' },
    { id: 'qualified', label: 'Qualified' },
    { id: 'converted', label: 'Converted' },
    { id: 'lost', label: 'Lost' }
  ];
  var DEAL_STAGES = [
    { id: 'new', label: 'New' },
    { id: 'qualified', label: 'Qualified' },
    { id: 'quoted', label: 'Quoted' },
    { id: 'negotiation', label: 'Negotiation' },
    { id: 'won', label: 'Won' },
    { id: 'lost', label: 'Lost' }
  ];
  var ACT_TYPES = [
    { id: 'note', label: 'Note' },
    { id: 'call', label: 'Call' },
    { id: 'email', label: 'Email' },
    { id: 'meeting', label: 'Meeting' },
    { id: 'task', label: 'Task' }
  ];
  var CLOSE_REASONS = [
    { id: 'price', label: 'Price' },
    { id: 'timing', label: 'Timing' },
    { id: 'competitor', label: 'Competitor' },
    { id: 'no_budget', label: 'No budget' },
    { id: 'other', label: 'Other' }
  ];
  var SOURCES = [
    { id: 'website', label: 'Website' },
    { id: 'dealer', label: 'Dealer' },
    { id: 'manual', label: 'Manual' },
    { id: 'referral', label: 'Referral' },
    { id: 'other', label: 'Other' }
  ];
  var KINDS = [
    { id: 'project', label: 'Project' },
    { id: 'dealer', label: 'Dealer' }
  ];
  var STAGE_PROB = { new: 10, qualified: 25, quoted: 50, negotiation: 75, won: 100, lost: 0 };

  function $(id) { return document.getElementById(id); }
  function esc(v) { return H.esc(v); }
  function canEdit(key) { return H.canEdit(key); }

  function val(id) {
    var el = $(id);
    return el ? String(el.value || '').trim() : '';
  }
  function setVal(id, value) {
    var el = $(id);
    if (el) el.value = value == null ? '' : String(value);
  }
  function setText(id, value) {
    var el = $(id);
    if (el) el.textContent = value == null ? '' : String(value);
  }
  function showErr(id, msg) {
    var el = $(id);
    if (!el) return;
    el.textContent = msg || '';
    el.classList.toggle('hidden', !msg);
  }

  function money(n) {
    var v = Number(n) || 0;
    return '$' + v.toLocaleString(undefined, { maximumFractionDigits: 0 });
  }

  function fmtDate(raw) {
    var s = String(raw || '');
    if (!s) return '—';
    return s.slice(0, 10);
  }

  function statusLabel(list, id) {
    var found = list.find(function (row) { return row.id === id; });
    return found ? found.label : (id || '—');
  }

  function leadName(lead) {
    if (!lead) return 'Lead';
    return lead.displayName || lead.companyName || [lead.contactFirst, lead.contactLast].filter(Boolean).join(' ') || lead.email || 'Lead';
  }

  function dealName(deal) {
    if (!deal) return 'Deal';
    return deal.title || deal.companyName || 'Deal';
  }

  function relatedLabel(act) {
    if (act.leadId) {
      var lead = S.leads.find(function (row) { return String(row.id) === String(act.leadId); });
      return lead ? leadName(lead) : 'Lead';
    }
    if (act.dealId) {
      var deal = S.deals.find(function (row) { return String(row.id) === String(act.dealId); });
      return deal ? dealName(deal) : 'Deal';
    }
    if (act.customerId) return 'Customer';
    return '—';
  }

  function isOverdue(act) {
    if (!act || act.doneAt || !act.dueAt) return false;
    var due = Date.parse(act.dueAt);
    return Number.isFinite(due) && due < Date.now();
  }

  function isDueSoon(act) {
    if (!act || act.doneAt || !act.dueAt || isOverdue(act)) return false;
    var due = Date.parse(act.dueAt);
    return Number.isFinite(due) && due <= Date.now() + 5 * 24 * 60 * 60 * 1000;
  }

  function closeReasonLabel(id) {
    return statusLabel(CLOSE_REASONS, id);
  }

  function kindLabel(id) {
    return statusLabel(KINDS, id || 'project');
  }

  function dealProb(deal) {
    if (!deal) return 0;
    if (deal.effectiveProbability != null && deal.effectiveProbability >= 0) return Number(deal.effectiveProbability) || 0;
    if (deal.probability != null && Number(deal.probability) >= 0) return Number(deal.probability) || 0;
    return STAGE_PROB[deal.stage] != null ? STAGE_PROB[deal.stage] : 10;
  }

  function dealWeighted(deal) {
    if (!deal || deal.stage === 'won' || deal.stage === 'lost') return 0;
    if (deal.weightedValue != null) return Number(deal.weightedValue) || 0;
    return Math.round((Number(deal.value) || 0) * dealProb(deal) / 100);
  }

  function visibleDeals() {
    if (S.dealKind === 'all') return S.deals;
    return S.deals.filter(function (deal) { return (deal.kind || 'project') === S.dealKind; });
  }

  function fillAssigneeList() {
    var list = $('crm-assignee-list');
    if (!list) return;
    list.innerHTML = (S.assignees || []).map(function (row) {
      return '<option value="' + esc(row.label || row.name || row.email || '') + '"></option>';
    }).join('');
  }

  function duplicateBanner(leads) {
    if (!leads || !leads.length) return '';
    return 'Possible duplicate' + (leads.length > 1 ? 's' : '') + ': ' + leads.map(function (row) {
      return leadName(row) + (row.email ? ' (' + row.email + ')' : '');
    }).join('; ');
  }

  function localDuplicates(email, company, excludeId) {
    var mail = String(email || '').trim().toLowerCase();
    var companyName = String(company || '').trim().toLowerCase();
    return S.leads.filter(function (lead) {
      if (lead.mergedIntoId) return false;
      if (excludeId && String(lead.id) === String(excludeId)) return false;
      if (mail && String(lead.email || '').toLowerCase() === mail) return true;
      if (companyName && String(lead.companyName || '').toLowerCase() === companyName) return true;
      return false;
    });
  }

  function optionsHtml(list, selected) {
    return list.map(function (row) {
      var id = row.id || row.value;
      var label = row.label || row.name || id;
      return '<option value="' + esc(id) + '"' + (String(id) === String(selected || '') ? ' selected' : '') + '>' + esc(label) + '</option>';
    }).join('');
  }

  function markKpis(rootId, filter) {
    var root = $(rootId);
    if (!root) return;
    root.querySelectorAll('[data-filter]').forEach(function (btn) {
      var on = btn.getAttribute('data-filter') === filter;
      btn.classList.toggle('is-on', on);
      btn.setAttribute('aria-pressed', on ? 'true' : 'false');
    });
  }

  function filteredLeads() {
    var q = val('crm-lead-search').toLowerCase();
    return S.leads.filter(function (lead) {
      if (S.leadFilter !== 'all' && lead.status !== S.leadFilter) return false;
      if (!q) return true;
      var blob = [lead.displayName, lead.companyName, lead.contactFirst, lead.contactLast, lead.email, lead.phone, lead.source, lead.kind, lead.ownerName].join(' ').toLowerCase();
      return blob.indexOf(q) !== -1;
    });
  }

  function filteredActivities() {
    var q = val('crm-act-search').toLowerCase();
    return S.activities.filter(function (act) {
      if (S.activityFilter === 'overdue' && !isOverdue(act)) return false;
      if (S.activityFilter === 'dueSoon' && !isDueSoon(act)) return false;
      if (S.activityFilter === 'open' && (act.doneAt || act.type === 'note')) return false;
      if (S.activityFilter === 'done' && !act.doneAt) return false;
      if (!q) return true;
      var blob = [act.subject, act.body, act.type, relatedLabel(act)].join(' ').toLowerCase();
      return blob.indexOf(q) !== -1;
    });
  }

  function fillLeadKpis() {
    var counts = { all: S.leads.length, new: 0, working: 0, qualified: 0, converted: 0, lost: 0 };
    S.leads.forEach(function (lead) {
      if (counts[lead.status] != null) counts[lead.status] += 1;
    });
    setText('crm-lead-stat-all', counts.all);
    setText('crm-lead-stat-new', counts.new);
    setText('crm-lead-stat-working', counts.working);
    setText('crm-lead-stat-qualified', counts.qualified);
    setText('crm-lead-stat-converted', counts.converted);
    setText('crm-lead-stat-lost', counts.lost);
    setText('crm-lead-total', String(counts.all));
    markKpis('crm-lead-overview', S.leadFilter);
  }

  function fillActivityKpis() {
    var overdue = 0, dueSoon = 0, open = 0, done = 0;
    S.activities.forEach(function (act) {
      if (act.doneAt) done += 1;
      else if (act.type === 'task' || act.dueAt) open += 1;
      if (isOverdue(act)) overdue += 1;
      if (isDueSoon(act)) dueSoon += 1;
    });
    setText('crm-act-stat-all', S.activities.length);
    setText('crm-act-stat-overdue', overdue);
    setText('crm-act-stat-soon', dueSoon);
    setText('crm-act-stat-open', open);
    setText('crm-act-stat-done', done);
    setText('crm-act-total', String(S.activities.length));
    markKpis('crm-act-overview', S.activityFilter);
  }

  function fillPipelineKpis() {
    var deals = visibleDeals();
    var openValue = 0, openN = 0, won = 0, lost = 0, weighted = 0;
    deals.forEach(function (deal) {
      if (deal.stage === 'won') won += 1;
      else if (deal.stage === 'lost') lost += 1;
      else {
        openN += 1;
        openValue += Number(deal.value) || 0;
        weighted += dealWeighted(deal);
      }
    });
    var closed = won + lost;
    setText('crm-pipe-stat-open', openN);
    setText('crm-pipe-stat-value', money(openValue));
    setText('crm-pipe-stat-weighted', money(weighted));
    setText('crm-pipe-stat-rate', closed ? Math.round((won / closed) * 100) + '%' : '—');
    setText('crm-pipe-stat-won', won);
    setText('crm-pipe-stat-lost', lost);
    setText('crm-pipe-total', String(deals.length));
  }

  function renderLeadTable() {
    var body = $('crm-lead-table');
    if (!body) return;
    var rows = filteredLeads();
    if (!rows.length) {
      body.innerHTML = '<tr><td colspan="9" class="py-6 px-4 text-slate-500">No leads match.</td></tr>';
      return;
    }
    body.innerHTML = rows.map(function (lead) {
      var on = String(lead.id) === String(S.leadId);
      return '<tr class="crm-row' + (on ? ' is-on' : '') + '" data-lead-id="' + esc(lead.id) + '">' +
        '<td class="py-3 px-4">' + esc(lead.companyName || leadName(lead)) + '</td>' +
        '<td class="py-3 px-4">' + esc(lead.contactName || [lead.contactFirst, lead.contactLast].filter(Boolean).join(' ') || '—') + '</td>' +
        '<td class="py-3 px-4">' + esc(lead.email || '—') + '</td>' +
        '<td class="py-3 px-4">' + esc(lead.phone || lead.mobile || '—') + '</td>' +
        '<td class="py-3 px-4"><span class="crm-pill crm-pill-' + esc(lead.status) + '">' + esc(statusLabel(LEAD_STATUSES, lead.status)) + '</span></td>' +
        '<td class="py-3 px-4">' + esc(kindLabel(lead.kind)) + '</td>' +
        '<td class="py-3 px-4">' + esc(statusLabel(SOURCES, lead.source)) + '</td>' +
        '<td class="py-3 px-4">' + esc(lead.ownerName || '—') + '</td>' +
        '<td class="py-3 px-4">' + esc(fmtDate(lead.updatedAt)) + '</td>' +
        '</tr>';
    }).join('');
  }

  function renderActivityTable() {
    var body = $('crm-act-table');
    if (!body) return;
    var rows = filteredActivities();
    if (!rows.length) {
      body.innerHTML = '<tr><td colspan="7" class="py-6 px-4 text-slate-500">No activities match.</td></tr>';
      return;
    }
    body.innerHTML = rows.map(function (act) {
      var on = String(act.id) === String(S.activityId);
      var dueClass = isOverdue(act) ? ' crm-overdue' : '';
      return '<tr class="crm-row' + (on ? ' is-on' : '') + '" data-act-id="' + esc(act.id) + '">' +
        '<td class="py-3 px-4">' + esc(statusLabel(ACT_TYPES, act.type)) + '</td>' +
        '<td class="py-3 px-4">' + esc(act.subject) + '</td>' +
        '<td class="py-3 px-4">' + esc(relatedLabel(act)) + '</td>' +
        '<td class="py-3 px-4' + dueClass + '">' + esc(act.dueAt ? fmtDate(act.dueAt) : '—') + '</td>' +
        '<td class="py-3 px-4">' + (act.doneAt ? 'Done' : (isOverdue(act) ? 'Overdue' : 'Open')) + '</td>' +
        '<td class="py-3 px-4">' + esc(act.assignedTo || '—') + '</td>' +
        '<td class="py-3 px-4">' + esc(act.createdByName || '—') + '</td>' +
        '</tr>';
    }).join('');
  }

  function renderPipelineBoard() {
    var board = $('crm-pipe-board');
    if (!board) return;
    board.innerHTML = DEAL_STAGES.map(function (stage) {
      var cards = visibleDeals().filter(function (deal) { return deal.stage === stage.id; });
      var sum = cards.reduce(function (n, deal) { return n + (Number(deal.value) || 0); }, 0);
      var weighted = cards.reduce(function (n, deal) { return n + dealWeighted(deal); }, 0);
      return '<section class="crm-col" data-stage="' + esc(stage.id) + '">' +
        '<header class="crm-col-head"><strong>' + esc(stage.label) + '</strong><span>' + cards.length + ' · ' + money(sum) + (stage.id !== 'won' && stage.id !== 'lost' ? ' · w ' + money(weighted) : '') + '</span></header>' +
        '<div class="crm-col-cards">' +
        (cards.length ? cards.map(function (deal) {
          var on = String(deal.id) === String(S.dealId);
          return '<button type="button" class="crm-card' + (on ? ' is-on' : '') + '" draggable="true" data-deal-id="' + esc(deal.id) + '">' +
            '<strong>' + esc(dealName(deal)) + '</strong>' +
            '<span class="crm-card-kind">' + esc(kindLabel(deal.kind)) + '</span>' +
            '<span>' + esc(deal.companyName || deal.contactName || deal.email || '') + '</span>' +
            (deal.quoteNumber ? '<span class="crm-card-quote">' + esc(deal.quoteNumber) + (deal.quoteTotal ? ' · ' + money(deal.quoteTotal) : '') + '</span>' : '') +
            '<em>' + money(deal.value) + ' · ' + esc(String(dealProb(deal))) + '%' +
            (deal.stage !== 'won' && deal.stage !== 'lost' ? ' · ' + money(dealWeighted(deal)) : '') +
            (deal.expectedClose ? ' · ' + esc(fmtDate(deal.expectedClose)) : '') + '</em>' +
            '</button>';
        }).join('') : '<p class="crm-col-empty">Drop a deal here</p>') +
        '</div></section>';
    }).join('');
  }

  function setCrmDetailOpen(sectionId, on) {
    var root = $(sectionId);
    if (!root) return;
    var ws = root.querySelector('.cc-workspace');
    if (!ws) return;
    if (H.isMobile && H.isMobile()) ws.classList.toggle('cc-detail-open', !!on);
    else ws.classList.remove('cc-detail-open');
    document.body.classList.toggle('dash-detail-open', !!document.querySelector('.cc-workspace.cc-detail-open'));
  }

  function showLeadOverview() {
    S.leadId = '';
    var pane = $('crm-lead-detail');
    var overview = $('crm-lead-overview-panel');
    if (pane) {
      pane.classList.add('hidden');
      pane.hidden = true;
    }
    if (overview) overview.classList.remove('hidden');
    setCrmDetailOpen('crm-lead-section', false);
    renderLeadTable();
  }

  function showDealOverview() {
    S.dealId = '';
    var pane = $('crm-pipe-detail');
    var overview = $('crm-pipe-overview-panel');
    if (pane) {
      pane.classList.add('hidden');
      pane.hidden = true;
    }
    if (overview) overview.classList.remove('hidden');
    setCrmDetailOpen('crm-pipe-section', false);
    renderPipelineBoard();
  }

  function activityListHtml(list, empty) {
    if (!list || !list.length) return '<p class="cc-detail-empty">' + esc(empty) + '</p>';
    return '<div class="crm-act-feed">' + list.map(function (act) {
      return '<article class="crm-act-item">' +
        '<header><strong>' + esc(act.subject) + '</strong><span>' + esc(statusLabel(ACT_TYPES, act.type)) +
        (act.dueAt ? ' · ' + esc(fmtDate(act.dueAt)) : '') +
        (act.doneAt ? ' · Done' : '') + '</span></header>' +
        (act.body ? '<p>' + esc(act.body) + '</p>' : '') +
        '</article>';
    }).join('') + '</div>';
  }

  function fillLeadDetail(lead) {
    if (!lead) return;
    S.leadId = String(lead.id);
    setText('crm-lead-detail-name', leadName(lead));
    setText('crm-lead-detail-sub', [lead.companyName, lead.email].filter(Boolean).join(' · '));
    setText('crm-lead-detail-email', lead.email || '—');
    setText('crm-lead-detail-phone', lead.phone || lead.mobile || '—');
    setText('crm-lead-detail-status', statusLabel(LEAD_STATUSES, lead.status));
    setText('crm-lead-detail-kind', kindLabel(lead.kind));
    setText('crm-lead-detail-source', statusLabel(SOURCES, lead.source));
    setText('crm-lead-detail-owner', lead.ownerName || '—');
    setText('crm-lead-detail-project', lead.projectType || '—');
    setText('crm-lead-detail-city', [lead.city, lead.state].filter(Boolean).join(', ') || '—');
    setText('crm-lead-detail-notes', lead.notes || '—');
    var converted = $('crm-lead-converted');
    if (converted) {
      converted.classList.toggle('hidden', !lead.convertedCustomerId);
      converted.href = lead.convertedCustomerId ? '/company/customers/' + lead.convertedCustomerId : '#';
    }
    var mail = $('crm-lead-mail');
    if (mail) {
      mail.classList.toggle('hidden', !lead.email);
      mail.href = lead.email ? 'mailto:' + lead.email : '#';
    }
    var tel = $('crm-lead-tel');
    if (tel) {
      tel.classList.toggle('hidden', !(lead.phone || lead.mobile));
      tel.href = (lead.phone || lead.mobile) ? 'tel:' + (lead.phone || lead.mobile) : '#';
    }
    var deals = lead.deals || S.deals.filter(function (d) { return String(d.leadId) === String(lead.id); });
    var dealBody = $('crm-lead-deals');
    if (dealBody) {
      dealBody.innerHTML = deals.length
        ? deals.map(function (d) {
          return '<tr data-open-deal="' + esc(d.id) + '"><td class="py-2 px-3">' + esc(dealName(d)) + '</td><td class="py-2 px-3">' +
            esc(statusLabel(DEAL_STAGES, d.stage)) + '</td><td class="py-2 px-3">' + money(d.value) + '</td></tr>';
        }).join('')
        : '<tr><td colspan="3" class="py-4 px-3 text-slate-500">No deals yet.</td></tr>';
    }
    var acts = $('crm-lead-acts');
    if (acts) acts.innerHTML = activityListHtml(lead.activities || [], 'No activity yet.');
    var pane = $('crm-lead-detail');
    var overview = $('crm-lead-overview-panel');
    if (overview) overview.classList.add('hidden');
    if (pane) {
      pane.classList.remove('hidden');
      pane.hidden = false;
    }
    setCrmDetailOpen('crm-lead-section', true);
    setLeadTab(S.leadTab || 'details');
    renderLeadTable();
    var convertBtn = $('crm-lead-convert');
    if (convertBtn) convertBtn.classList.toggle('hidden', lead.status === 'converted' || !canEdit('leads'));
    var dup = $('crm-lead-dup');
    if (dup) {
      var dupText = '';
      if (lead.mergedIntoId) {
        var into = S.leads.find(function (row) { return String(row.id) === String(lead.mergedIntoId); });
        dupText = 'Merged into ' + (into ? leadName(into) : ('lead #' + lead.mergedIntoId)) + '. Email and deals moved there.';
      } else {
        dupText = duplicateBanner(lead.duplicates || localDuplicates(lead.email, lead.companyName, lead.id));
      }
      dup.textContent = dupText;
      dup.classList.toggle('hidden', !dupText);
    }
    var messages = lead.messages || [];
    if (!messages.length && lead.notes && (lead.source === 'website' || lead.source === 'dealer')) {
      messages = [{
        direction: 'in',
        fromEmail: lead.email,
        toEmail: 'sales@spectrumdisplay.com',
        subject: lead.source === 'dealer' ? 'Dealer inquiry' : 'Website inquiry',
        body: lead.notes,
        source: lead.source,
        createdAt: lead.createdAt
      }];
    }
    renderLeadThread(messages);
    setVal('crm-mail-to', lead.email || '');
    setVal('crm-mail-subject', 'Following up — ' + leadName(lead));
    setVal('crm-mail-body', '');
    showErr('crm-mail-msg', '');
    var mailSend = $('crm-mail-send');
    if (mailSend) mailSend.classList.toggle('hidden', !canEdit('leads'));
    fillLeadSequence(lead);
  }

  function fillLeadSequence(lead) {
    var status = $('crm-lead-seq-status');
    var select = $('crm-lead-seq');
    var pause = $('crm-lead-seq-pause');
    var enrollments = (lead && lead.enrollments) || [];
    var active = enrollments.find(function (row) { return row.status === 'active'; }) || enrollments[0] || null;
    if (status) {
      if (active) {
        var n = (active.steps || []).length;
        status.textContent = (active.status === 'paused' ? 'Paused: ' : 'On ') +
          (active.sequenceName || 'sequence') +
          (n ? ' · ' + n + ' follow-up' + (n === 1 ? '' : 's') : '');
      } else {
        status.textContent = 'No sequence yet. Enroll to create follow-up tasks.';
      }
    }
    if (select) {
      select.innerHTML = '<option value="">Choose a sequence</option>' + (S.sequences || []).map(function (seq) {
        return '<option value="' + esc(seq.id) + '">' + esc(seq.name) + (seq.autoSource ? ' · auto ' + seq.autoSource : '') + '</option>';
      }).join('');
      if (active && active.sequenceId) select.value = String(active.sequenceId);
    }
    if (pause) {
      pause.classList.toggle('hidden', !(active && active.status === 'active' && canEdit('leads')));
      pause.setAttribute('data-enrollment-id', active && active.id ? String(active.id) : '');
    }
    var enrollBtn = $('crm-lead-seq-enroll');
    if (enrollBtn) enrollBtn.classList.toggle('hidden', !canEdit('leads'));
  }

  function fillDealDetail(deal) {
    if (!deal) return;
    S.dealId = String(deal.id);
    setText('crm-pipe-detail-name', dealName(deal));
    setText('crm-pipe-detail-sub', [deal.companyName, deal.contactName].filter(Boolean).join(' · '));
    setText('crm-pipe-detail-stage', statusLabel(DEAL_STAGES, deal.stage));
    setText('crm-pipe-detail-kind', kindLabel(deal.kind));
    setText('crm-pipe-detail-value', money(deal.value));
    setText('crm-pipe-detail-prob', String(dealProb(deal)) + '%');
    setText('crm-pipe-detail-weighted', deal.stage === 'won' || deal.stage === 'lost' ? '—' : money(dealWeighted(deal)));
    setText('crm-pipe-detail-close', deal.expectedClose ? fmtDate(deal.expectedClose) : '—');
    setText('crm-pipe-detail-owner', deal.ownerName || '—');
    setText('crm-pipe-detail-email', deal.email || '—');
    setText('crm-pipe-detail-notes', deal.notes || '—');
    var quoteBtn = $('crm-pipe-quote');
    if (quoteBtn) {
      quoteBtn.classList.toggle('hidden', !(deal.customerId || deal.leadId || deal.quoteId));
      quoteBtn.textContent = deal.quoteId ? 'Open quote' : 'Create quote';
    }
    setText('crm-pipe-detail-quote', deal.quoteNumber
      ? (deal.quoteNumber + (deal.quoteTotal ? ' · ' + money(deal.quoteTotal) : ''))
      : (deal.quoteId ? '#' + deal.quoteId : '—'));
    var reason = deal.stage === 'won' ? deal.wonReason : (deal.stage === 'lost' ? deal.lostReason : '');
    setText('crm-pipe-detail-reason', reason ? closeReasonLabel(reason) : '—');
    var pipeActs = $('crm-pipe-acts');
    if (pipeActs) pipeActs.innerHTML = activityListHtml(deal.activities || [], 'No activity yet.');
    fillDealCalculator(deal);
    var pane = $('crm-pipe-detail');
    var overview = $('crm-pipe-overview-panel');
    if (overview) overview.classList.add('hidden');
    if (pane) {
      pane.classList.remove('hidden');
      pane.hidden = false;
    }
    setCrmDetailOpen('crm-pipe-section', true);
    setDealTab(S.dealTab || 'details');
    renderPipelineBoard();
  }

  function calcSummaryHtml(deal) {
    var sum = deal && deal.calculatorSummary;
    if (!sum) return '';
    var bits = [];
    if (sum.seriesName || sum.series || sum.brand) bits.push([sum.brand, sum.seriesName || sum.series].filter(Boolean).join(' '));
    if (sum.sizeLabel) bits.push(sum.sizeLabel);
    else if (sum.width && sum.height) bits.push(sum.width + ' × ' + sum.height + (sum.unit ? ' ' + sum.unit : ''));
    if (sum.pitch) bits.push('P' + sum.pitch);
    if (sum.cabinets) bits.push(sum.cabinets + ' panels');
    if (sum.estimate) bits.push(money(sum.estimate));
    return bits.join(' · ');
  }

  function dealCalcUrl(deal) {
    var q = deal && deal.calculatorQuery ? String(deal.calculatorQuery).replace(/^\?/, '') : '';
    var url = '/led-wall-calculator?deal=' + encodeURIComponent(deal && deal.id || '') + '&embed=1';
    if (q) url += (q.charAt(0) === '&' ? '' : '&') + q;
    return url;
  }

  function fillDealCalculator(deal) {
    var summary = $('crm-pipe-calc-summary');
    var open = $('crm-pipe-calc-open');
    var clear = $('crm-pipe-calc-clear');
    var frame = $('crm-pipe-calc-frame');
    var text = calcSummaryHtml(deal);
    if (summary) summary.textContent = text || 'No wall on this deal yet. Open the calculator to size it; it saves back here.';
    if (open) {
      open.href = dealCalcUrl(deal).replace('&embed=1', '');
    }
    if (clear) clear.classList.toggle('hidden', !(deal && deal.calculatorQuery) || !canEdit('pipeline'));
    if (frame) {
      var show = S.dealTab === 'calculator';
      frame.hidden = !show;
      if (show && deal && deal.id) {
        var next = dealCalcUrl(deal);
        if (frame.getAttribute('data-src') !== next) {
          frame.setAttribute('data-src', next);
          frame.src = next;
        }
      }
    }
  }

  function setDealTab(name) {
    S.dealTab = name === 'calculator' || name === 'activity' ? name : 'details';
    ['details', 'calculator', 'activity'].forEach(function (tab) {
      var btn = document.querySelector('#crm-pipe-detail [data-crm-deal-tab="' + tab + '"]');
      var panel = $('crm-pipe-panel-' + tab);
      if (btn) {
        btn.classList.toggle('is-on', tab === S.dealTab);
        btn.setAttribute('aria-selected', tab === S.dealTab ? 'true' : 'false');
      }
      if (panel) {
        panel.classList.toggle('hidden', tab !== S.dealTab);
        panel.hidden = tab !== S.dealTab;
      }
    });
    var deal = S.deals.find(function (row) { return String(row.id) === String(S.dealId); });
    if (deal) fillDealCalculator(deal);
  }

  function renderLeadThread(messages) {
    var root = $('crm-lead-thread');
    if (!root) return;
    if (!messages || !messages.length) {
      root.innerHTML = '<p class="cc-detail-empty">No email on this lead yet. Website and dealer inquiries show up here.</p>';
      return;
    }
    root.innerHTML = messages.map(function (msg) {
      var dir = msg.direction === 'out' ? 'Sent' : 'Received';
      var who = msg.direction === 'out'
        ? ('To ' + (msg.toEmail || '—'))
        : ('From ' + (msg.fromEmail || '—'));
      return '<article class="crm-mail-item' + (msg.direction === 'out' ? ' is-out' : '') + '">' +
        '<header><strong>' + esc(msg.subject || dir) + '</strong><span>' + esc(dir + ' · ' + who) +
        (msg.createdAt ? ' · ' + esc(fmtDate(msg.createdAt)) : '') + '</span></header>' +
        (msg.body ? '<p>' + esc(msg.body) + '</p>' : '') +
        '</article>';
    }).join('');
  }

  function setLeadTab(name) {
    S.leadTab = name;
    ['details', 'email', 'activity', 'deals'].forEach(function (tab) {
      var btn = document.querySelector('#crm-lead-detail [data-crm-lead-tab="' + tab + '"]');
      var panel = $('crm-lead-panel-' + tab);
      if (btn) {
        btn.classList.toggle('is-on', tab === name);
        btn.setAttribute('aria-selected', tab === name ? 'true' : 'false');
      }
      if (panel) {
        panel.classList.toggle('hidden', tab !== name);
        panel.hidden = tab !== name;
      }
    });
  }

  async function loadAll() {
    var data = await Promise.all([
      H.api('/api/admin/crm/leads'),
      H.api('/api/admin/crm/deals'),
      H.api('/api/admin/crm/activities'),
      H.api('/api/admin/crm/assignees').catch(function () { return { assignees: [] }; }),
      H.api('/api/admin/crm/sequences').catch(function () { return { sequences: [] }; })
    ]);
    S.leads = data[0].leads || [];
    S.deals = data[1].deals || [];
    S.activities = data[2].activities || [];
    S.assignees = data[3].assignees || [];
    S.sequences = data[4].sequences || [];
    S.loaded = true;
    fillAssigneeList();
    fillLeadKpis();
    fillPipelineKpis();
    fillActivityKpis();
    renderLeadTable();
    renderPipelineBoard();
    renderActivityTable();
  }

  async function openLead(id, opts) {
    opts = opts || {};
    if (!id) {
      showLeadOverview();
      if (opts.push && H.pushPath) H.pushPath('/company/crm/leads');
      return;
    }
    var data = await H.api('/api/admin/crm/leads/' + encodeURIComponent(id));
    fillLeadDetail(data.lead);
    if (opts.push && H.pushPath) H.pushPath('/company/crm/leads/' + id);
  }

  async function openDeal(id, opts) {
    opts = opts || {};
    if (!id) {
      showDealOverview();
      if (opts.push && H.pushPath) H.pushPath('/company/crm/pipeline');
      return;
    }
    var data = await H.api('/api/admin/crm/deals/' + encodeURIComponent(id));
    fillDealDetail(data.deal);
    if (opts.push && H.pushPath) H.pushPath('/company/crm/pipeline/' + id);
  }

  async function openActivity(id) {
    S.activityId = String(id || '');
    renderActivityTable();
    var act = S.activities.find(function (row) { return String(row.id) === String(id); });
    if (act) openActivityDrawer(act);
  }

  function fillLeadForm(lead) {
    setVal('crm-lead-id', lead && lead.id || '');
    setVal('crm-lead-company', lead && lead.companyName || '');
    setVal('crm-lead-first', lead && lead.contactFirst || '');
    setVal('crm-lead-last', lead && lead.contactLast || '');
    setVal('crm-lead-email', lead && lead.email || '');
    setVal('crm-lead-phone', lead && lead.phone || '');
    setVal('crm-lead-mobile', lead && lead.mobile || '');
    setVal('crm-lead-website', lead && lead.website || '');
    setVal('crm-lead-source', lead && lead.source || 'manual');
    setVal('crm-lead-status', lead && lead.status || 'new');
    setVal('crm-lead-kind', lead && lead.kind || (lead && lead.source === 'dealer' ? 'dealer' : 'project'));
    setVal('crm-lead-owner', lead && lead.ownerName || '');
    setVal('crm-lead-project', lead && lead.projectType || '');
    setVal('crm-lead-city', lead && lead.city || '');
    setVal('crm-lead-state', lead && lead.state || '');
    setVal('crm-lead-country', lead && lead.country || 'United States');
    setVal('crm-lead-notes', lead && lead.notes || '');
    $('crm-lead-title').textContent = lead && lead.id ? leadName(lead) : 'Lead';
    $('crm-lead-delete').classList.toggle('hidden', !(lead && lead.id) || !canEdit('leads'));
    S.dirty = false;
  }

  function leadFormPayload() {
    return {
      companyName: val('crm-lead-company'),
      contactFirst: val('crm-lead-first'),
      contactLast: val('crm-lead-last'),
      email: val('crm-lead-email'),
      phone: val('crm-lead-phone'),
      mobile: val('crm-lead-mobile'),
      website: val('crm-lead-website'),
      source: val('crm-lead-source') || 'manual',
      status: val('crm-lead-status') || 'new',
      kind: val('crm-lead-kind') || 'project',
      ownerName: val('crm-lead-owner'),
      projectType: val('crm-lead-project'),
      city: val('crm-lead-city'),
      state: val('crm-lead-state'),
      country: val('crm-lead-country'),
      notes: val('crm-lead-notes')
    };
  }

  function fillDealForm(deal) {
    setVal('crm-deal-id', deal && deal.id || '');
    setVal('crm-deal-title', deal && deal.title || '');
    setVal('crm-deal-company', deal && deal.companyName || '');
    setVal('crm-deal-contact', deal && deal.contactName || '');
    setVal('crm-deal-email', deal && deal.email || '');
    setVal('crm-deal-stage', deal && deal.stage || 'new');
    setVal('crm-deal-value', deal && deal.value ? String(deal.value) : '');
    setVal('crm-deal-prob', deal && deal.probability != null && Number(deal.probability) >= 0 ? String(deal.probability) : '');
    setVal('crm-deal-kind', deal && deal.kind || 'project');
    setVal('crm-deal-close', deal && deal.expectedClose ? String(deal.expectedClose).slice(0, 10) : '');
    setVal('crm-deal-owner', deal && deal.ownerName || '');
    setVal('crm-deal-won-reason', deal && deal.wonReason || '');
    setVal('crm-deal-lost-reason', deal && deal.lostReason || '');
    setVal('crm-deal-notes', deal && deal.notes || '');
    var leadSel = $('crm-deal-lead');
    if (leadSel) {
      leadSel.innerHTML = '<option value="">No lead</option>' + S.leads.map(function (lead) {
        return '<option value="' + esc(lead.id) + '">' + esc(leadName(lead)) + '</option>';
      }).join('');
      leadSel.value = deal && deal.leadId ? String(deal.leadId) : (S.leadId || '');
    }
    $('crm-deal-title-label').textContent = deal && deal.id ? dealName(deal) : 'Deal';
    $('crm-deal-delete').classList.toggle('hidden', !(deal && deal.id) || !canEdit('pipeline'));
    syncDealReasonFields();
    S.dirty = false;
  }

  function syncDealReasonFields() {
    var stage = val('crm-deal-stage') || 'new';
    var won = $('crm-deal-won-wrap');
    var lost = $('crm-deal-lost-wrap');
    if (won) won.classList.toggle('hidden', stage !== 'won');
    if (lost) lost.classList.toggle('hidden', stage !== 'lost');
  }

  function dealFormPayload() {
    var current = S.deals.find(function (d) { return String(d.id) === val('crm-deal-id'); });
    return {
      title: val('crm-deal-title'),
      companyName: val('crm-deal-company'),
      contactName: val('crm-deal-contact'),
      email: val('crm-deal-email'),
      stage: val('crm-deal-stage') || 'new',
      value: val('crm-deal-value'),
      probability: val('crm-deal-prob') === '' ? -1 : val('crm-deal-prob'),
      kind: val('crm-deal-kind') || 'project',
      expectedClose: val('crm-deal-close'),
      ownerName: val('crm-deal-owner'),
      notes: val('crm-deal-notes'),
      leadId: val('crm-deal-lead') || null,
      customerId: current && current.customerId || null,
      quoteId: current && current.quoteId || null,
      calculatorQuery: current && current.calculatorQuery || '',
      calculatorSummary: current && current.calculatorSummary || '',
      wonReason: val('crm-deal-won-reason'),
      lostReason: val('crm-deal-lost-reason')
    };
  }

  function fillActivityForm(act) {
    setVal('crm-act-id', act && act.id || '');
    setVal('crm-act-type', act && act.type || 'task');
    setVal('crm-act-subject', act && act.subject || '');
    setVal('crm-act-due', act && act.dueAt ? String(act.dueAt).slice(0, 10) : '');
    setVal('crm-act-body', act && act.body || '');
    var leadSel = $('crm-act-lead');
    var dealSel = $('crm-act-deal');
    if (leadSel) {
      leadSel.innerHTML = '<option value="">Lead (optional)</option>' + S.leads.map(function (lead) {
        return '<option value="' + esc(lead.id) + '">' + esc(leadName(lead)) + '</option>';
      }).join('');
      leadSel.value = act && act.leadId ? String(act.leadId) : (S.view === 'leads' ? S.leadId : '');
    }
    if (dealSel) {
      dealSel.innerHTML = '<option value="">Deal (optional)</option>' + S.deals.map(function (deal) {
        return '<option value="' + esc(deal.id) + '">' + esc(dealName(deal)) + '</option>';
      }).join('');
      dealSel.value = act && act.dealId ? String(act.dealId) : (S.view === 'pipeline' ? S.dealId : '');
    }
    var done = $('crm-act-done');
    if (done) done.checked = !!(act && act.doneAt);
    setVal('crm-act-assigned', act && act.assignedTo || '');
    $('crm-act-title').textContent = act && act.id ? (act.subject || 'Activity') : 'Activity';
    $('crm-act-delete').classList.toggle('hidden', !(act && act.id) || !canEdit('activities'));
    S.dirty = false;
  }

  function activityFormPayload() {
    return {
      type: val('crm-act-type') || 'note',
      subject: val('crm-act-subject'),
      dueAt: val('crm-act-due'),
      body: val('crm-act-body'),
      leadId: val('crm-act-lead') || null,
      dealId: val('crm-act-deal') || null,
      assignedTo: val('crm-act-assigned'),
      done: $('crm-act-done') ? $('crm-act-done').checked : false,
      createdByName: typeof H.adminName === 'function' ? H.adminName() : ''
    };
  }

  function openDrawer(name) {
    S.drawer = name;
    document.body.classList.add('crm-drawer-open');
    ['lead', 'deal', 'act', 'seq'].forEach(function (key) {
      var el = $('crm-' + key + '-drawer');
      if (!el) return;
      var on = key === name;
      el.setAttribute('aria-hidden', on ? 'false' : 'true');
      el.classList.toggle('is-open', on);
    });
    var scrim = $('crm-drawer-scrim');
    if (scrim) scrim.classList.add('is-on');
  }

  function closeDrawers(force) {
    if (!force && S.dirty) return false;
    S.drawer = '';
    S.dirty = false;
    document.body.classList.remove('crm-drawer-open');
    ['lead', 'deal', 'act', 'seq'].forEach(function (key) {
      var el = $('crm-' + key + '-drawer');
      if (!el) return;
      el.setAttribute('aria-hidden', 'true');
      el.classList.remove('is-open');
    });
    var scrim = $('crm-drawer-scrim');
    if (scrim) scrim.classList.remove('is-on');
    return true;
  }

  function openLeadDrawer(lead) {
    fillLeadForm(lead || null);
    showErr('crm-lead-msg', '');
    openDrawer('lead');
    var focus = $('crm-lead-company');
    if (focus) focus.focus();
  }

  function openDealDrawer(deal) {
    fillDealForm(deal || null);
    showErr('crm-deal-msg', '');
    openDrawer('deal');
    var focus = $('crm-deal-title');
    if (focus) focus.focus();
  }

  function openActivityDrawer(act) {
    fillActivityForm(act || null);
    showErr('crm-act-msg', '');
    openDrawer('act');
    var focus = $('crm-act-subject');
    if (focus) focus.focus();
  }

  function drawerNeedsLeave() {
    return !!(S.drawer && S.dirty);
  }

  function syncViewChrome(view) {
    S.view = view === 'pipeline' || view === 'activities' ? view : 'leads';
    ['leads', 'pipeline', 'activities'].forEach(function (name) {
      var sec = $('crm-' + (name === 'pipeline' ? 'pipe' : name === 'activities' ? 'act' : 'lead') + '-section');
      if (sec) sec.classList.toggle('hidden', (name === 'pipeline' ? 'pipeline' : name === 'activities' ? 'activities' : 'leads') !== S.view);
    });
    document.body.classList.toggle('dash-split-lock', (S.view === 'leads' || S.view === 'pipeline' || S.view === 'activities') && !H.isMobile());
  }

  async function openRouted(name) {
    var view = name === 'pipeline' ? 'pipeline' : name === 'activities' ? 'activities' : 'leads';
    syncViewChrome(view);
    showErr('crm-lead-error', '');
    showErr('crm-pipe-error', '');
    showErr('crm-act-error', '');
    try {
      await loadAll();
    } catch (err) {
      var msg = err.message || 'Could not load CRM.';
      if (view === 'pipeline') showErr('crm-pipe-error', msg);
      else if (view === 'activities') showErr('crm-act-error', msg);
      else showErr('crm-lead-error', msg);
      return;
    }
    var path = H.companyPath();
    if (view === 'leads') {
      var lm = path.match(/\/company\/crm\/leads\/(\d+)/);
      if (lm) await openLead(lm[1]);
      else showLeadOverview();
    } else if (view === 'pipeline') {
      var dm = path.match(/\/company\/crm\/pipeline\/(\d+)/);
      if (dm) await openDeal(dm[1]);
      else showDealOverview();
    } else {
      renderActivityTable();
    }
    var addLead = $('crm-lead-new');
    if (addLead) addLead.classList.toggle('hidden', !canEdit('leads'));
    var exp = $('crm-lead-export');
    if (exp) exp.classList.toggle('hidden', false);
    var imp = $('crm-lead-import-btn');
    if (imp) imp.classList.toggle('hidden', !canEdit('leads'));
    var addDeal = $('crm-pipe-new');
    if (addDeal) addDeal.classList.toggle('hidden', !canEdit('pipeline'));
    var addAct = $('crm-act-new');
    if (addAct) addAct.classList.toggle('hidden', !canEdit('activities'));
  }

  async function saveLead(ev) {
    if (ev) ev.preventDefault();
    showErr('crm-lead-msg', '');
    try {
      var id = val('crm-lead-id');
      var payload = leadFormPayload();
      var dups = localDuplicates(payload.email, payload.companyName, id);
      var dupEl = $('crm-lead-dups');
      if (dupEl) {
        var text = duplicateBanner(dups);
        dupEl.textContent = text;
        dupEl.classList.toggle('hidden', !text);
      }
      if (dups.length && !window.confirm(duplicateBanner(dups) + '\n\nSave this lead anyway?')) return;
      var data = id
        ? await H.api('/api/admin/crm/leads/' + encodeURIComponent(id), { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })
        : await H.api('/api/admin/crm/leads', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
      S.dirty = false;
      closeDrawers(true);
      await loadAll();
      await openLead(data.lead.id, { push: true });
    } catch (err) {
      showErr('crm-lead-msg', err.message || 'Could not save lead.');
    }
  }

  async function saveDeal(ev) {
    if (ev) ev.preventDefault();
    showErr('crm-deal-msg', '');
    try {
      var id = val('crm-deal-id');
      var payload = dealFormPayload();
      var data = id
        ? await H.api('/api/admin/crm/deals/' + encodeURIComponent(id), { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })
        : await H.api('/api/admin/crm/deals', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
      S.dirty = false;
      closeDrawers(true);
      await loadAll();
      await openDeal(data.deal.id, { push: true });
    } catch (err) {
      showErr('crm-deal-msg', err.message || 'Could not save deal.');
    }
  }

  async function saveActivity(ev) {
    if (ev) ev.preventDefault();
    showErr('crm-act-msg', '');
    try {
      var id = val('crm-act-id');
      var payload = activityFormPayload();
      if (id) {
        await H.api('/api/admin/crm/activities/' + encodeURIComponent(id), { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
      } else {
        await H.api('/api/admin/crm/activities', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
      }
      S.dirty = false;
      closeDrawers(true);
      await loadAll();
      if (S.view === 'leads' && S.leadId) await openLead(S.leadId);
      if (S.view === 'pipeline' && S.dealId) await openDeal(S.dealId);
    } catch (err) {
      showErr('crm-act-msg', err.message || 'Could not save activity.');
    }
  }

  async function deleteCurrent(kind) {
    var id = kind === 'lead' ? val('crm-lead-id') : kind === 'deal' ? val('crm-deal-id') : val('crm-act-id');
    if (!id) return;
    if (!window.confirm('Delete this ' + kind + '?')) return;
    var url = kind === 'lead' ? '/api/admin/crm/leads/' : kind === 'deal' ? '/api/admin/crm/deals/' : '/api/admin/crm/activities/';
    try {
      await H.api(url + encodeURIComponent(id), { method: 'DELETE' });
      S.dirty = false;
      closeDrawers(true);
      await loadAll();
      if (kind === 'lead') showLeadOverview();
      if (kind === 'deal') showDealOverview();
    } catch (err) {
      showErr('crm-' + (kind === 'act' ? 'act' : kind) + '-msg', err.message || 'Could not delete.');
    }
  }

  function showModal(id, on) {
    var el = $(id);
    if (!el) return;
    el.classList.toggle('hidden', !on);
    el.hidden = !on;
  }

  function currentLead() {
    return S.leads.find(function (row) { return String(row.id) === String(S.leadId); }) || null;
  }

  function convertLead() {
    var lead = currentLead();
    if (!lead) return;
    var merge = $('crm-convert-merge');
    var dups = lead.duplicates || localDuplicates(lead.email, lead.companyName, lead.id);
    if (merge) {
      merge.innerHTML = '<option value="">Keep this lead</option>' + dups.map(function (row) {
        return '<option value="' + esc(row.id) + '">Merge into ' + esc(leadName(row)) + '</option>';
      }).join('');
    }
    var dup = $('crm-convert-dup');
    if (dup) {
      var text = duplicateBanner(dups);
      dup.textContent = text;
      dup.classList.toggle('hidden', !text);
    }
    var quote = $('crm-convert-quote');
    if (quote) {
      var hasValue = (lead.deals || S.deals.filter(function (d) { return String(d.leadId) === String(lead.id); }))
        .some(function (d) { return Number(d.value) > 0; });
      quote.checked = hasValue;
    }
    showModal('crm-convert-modal', true);
  }

  async function runConvert() {
    if (!S.leadId) return;
    showModal('crm-convert-modal', false);
    try {
      var mergeIntoId = val('crm-convert-merge');
      var createQuote = $('crm-convert-quote') ? $('crm-convert-quote').checked : false;
      var data = await H.api('/api/admin/crm/leads/' + encodeURIComponent(S.leadId) + '/convert', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ createQuote: createQuote, mergeIntoId: mergeIntoId || null })
      });
      await loadAll();
      await openLead(data.lead.id);
      if (data.quote && data.quote.id && H.openQuote) H.openQuote({ quoteId: data.quote.id, customerId: data.customer && data.customer.id });
    } catch (err) {
      showErr('crm-lead-error', err.message || 'Could not convert this lead.');
    }
  }

  async function sendLeadEmail(ev) {
    if (ev) ev.preventDefault();
    if (!S.leadId) return;
    showErr('crm-mail-msg', '');
    try {
      await H.api('/api/admin/crm/leads/' + encodeURIComponent(S.leadId) + '/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          to: val('crm-mail-to'),
          subject: val('crm-mail-subject'),
          body: val('crm-mail-body')
        })
      });
      setVal('crm-mail-body', '');
      await openLead(S.leadId);
      setLeadTab('email');
    } catch (err) {
      showErr('crm-mail-msg', err.message || 'Could not send email.');
    }
  }

  async function exportLeads() {
    var res = await fetch('/api/admin/crm/leads.csv', { credentials: 'same-origin' });
    if (!res.ok) throw new Error('Could not export leads.');
    var blob = await res.blob();
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url;
    a.download = 'crm-leads.csv';
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  async function importLeads(file) {
    if (!file) return;
    var text = await file.text();
    var data = await H.api('/api/admin/crm/leads/import', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ csv: text })
    });
    await loadAll();
    var msg = 'Imported ' + (data.created || 0) + ' lead' + ((data.created || 0) === 1 ? '' : 's') + '.';
    if (data.errors && data.errors.length) msg += ' ' + data.errors.length + ' row' + (data.errors.length === 1 ? '' : 's') + ' skipped.';
    showErr('crm-lead-error', '');
    window.alert(msg);
  }

  async function moveDeal(id, stage, extra) {
    var deal = S.deals.find(function (row) { return String(row.id) === String(id); });
    if (!deal || deal.stage === stage || !canEdit('pipeline')) return;
    extra = extra || {};
    if ((stage === 'won' || stage === 'lost') && !(extra.wonReason || extra.lostReason || deal.wonReason || deal.lostReason)) {
      S.pendingMove = { id: id, stage: stage };
      setText('crm-reason-title', stage === 'won' ? 'Won reason' : 'Lost reason');
      showModal('crm-reason-modal', true);
      return;
    }
    var prev = deal.stage;
    deal.stage = stage;
    if (stage === 'won' && extra.wonReason) deal.wonReason = extra.wonReason;
    if (stage === 'lost' && extra.lostReason) deal.lostReason = extra.lostReason;
    fillPipelineKpis();
    renderPipelineBoard();
    try {
      await H.api('/api/admin/crm/deals/' + encodeURIComponent(id), {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(Object.assign({}, deal, extra, { stage: stage }))
      });
      await loadAll();
      if (S.dealId === String(id)) await openDeal(id);
      else renderPipelineBoard();
    } catch (err) {
      deal.stage = prev;
      fillPipelineKpis();
      renderPipelineBoard();
      showErr('crm-pipe-error', err.message || 'Could not move this deal.');
    }
  }

  function seqStepsFromForm() {
    var steps = [];
    [1, 2, 3].forEach(function (n) {
      var subject = val('crm-seq-s' + n);
      if (!subject) return;
      steps.push({
        delayDays: Math.max(0, parseInt(val('crm-seq-d' + n), 10) || 0),
        type: val('crm-seq-t' + n) || 'task',
        subject: subject
      });
    });
    return steps;
  }

  function fillSeqForm(seq) {
    setVal('crm-seq-id', seq && seq.id || '');
    setVal('crm-seq-name', seq && seq.name || '');
    setVal('crm-seq-auto', seq && seq.autoSource || '');
    var steps = (seq && seq.steps) || [];
    [1, 2, 3].forEach(function (n) {
      var step = steps[n - 1] || {};
      setVal('crm-seq-d' + n, step.delayDays != null ? String(step.delayDays) : (n === 1 ? '0' : n === 2 ? '2' : '5'));
      setVal('crm-seq-t' + n, step.type || (n === 2 ? 'call' : n === 3 ? 'email' : 'task'));
      setVal('crm-seq-s' + n, step.subject || '');
    });
    var del = $('crm-seq-delete');
    if (del) del.classList.toggle('hidden', !(seq && seq.id) || !canEdit('activities'));
    setText('crm-seq-title', seq && seq.id ? 'Edit sequence' : 'New sequence');
    showErr('crm-seq-msg', '');
    S.dirty = false;
  }

  function renderSeqList() {
    var host = $('crm-seq-list');
    if (!host) return;
    if (!S.sequences.length) {
      host.innerHTML = '<p class="cc-muted">No sequences yet.</p>';
      return;
    }
    host.innerHTML = S.sequences.map(function (seq) {
      var on = String(seq.id) === val('crm-seq-id');
      return '<button type="button" class="crm-seq-item' + (on ? ' is-on' : '') + '" data-seq-id="' + esc(seq.id) + '">' +
        '<strong>' + esc(seq.name) + '</strong>' +
        '<span>' + esc((seq.steps && seq.steps.length) || 0) + ' steps · ' +
        (seq.active === false ? 'paused' : 'active') +
        (seq.autoSource ? ' · auto ' + esc(seq.autoSource) : '') + '</span></button>';
    }).join('');
  }

  function openSeqDrawer(seq) {
    if (!canEdit('activities')) {
      showErr('crm-act-error', "You don't have permission to edit sequences.");
      return;
    }
    fillSeqForm(seq || null);
    renderSeqList();
    openDrawer('seq');
    var focus = $('crm-seq-name');
    if (focus) focus.focus();
  }

  async function saveSequence(ev) {
    if (ev) ev.preventDefault();
    showErr('crm-seq-msg', '');
    var name = val('crm-seq-name');
    var steps = seqStepsFromForm();
    if (!name || !steps.length) {
      showErr('crm-seq-msg', 'Name and at least one step with a subject are required.');
      return;
    }
    var payload = {
      name: name,
      autoSource: val('crm-seq-auto'),
      steps: steps
    };
    var id = val('crm-seq-id');
    try {
      var data = id
        ? await H.api('/api/admin/crm/sequences/' + encodeURIComponent(id), {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        })
        : await H.api('/api/admin/crm/sequences', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
      S.dirty = false;
      var seqRes = await H.api('/api/admin/crm/sequences');
      S.sequences = seqRes.sequences || [];
      fillSeqForm(data.sequence || null);
      renderSeqList();
    } catch (err) {
      showErr('crm-seq-msg', err.message || 'Could not save sequence.');
    }
  }

  async function deleteSequence() {
    var id = val('crm-seq-id');
    if (!id) return;
    if (!window.confirm('Delete this sequence?')) return;
    try {
      await H.api('/api/admin/crm/sequences/' + encodeURIComponent(id), { method: 'DELETE' });
      S.dirty = false;
      var seqRes = await H.api('/api/admin/crm/sequences');
      S.sequences = seqRes.sequences || [];
      fillSeqForm(null);
      renderSeqList();
    } catch (err) {
      showErr('crm-seq-msg', err.message || 'Could not delete sequence.');
    }
  }

  async function enrollCurrentLead() {
    var lead = S.leads.find(function (row) { return String(row.id) === String(S.leadId); });
    var seqId = val('crm-lead-seq');
    if (!lead || !seqId) {
      showErr('crm-lead-error', 'Choose a sequence first.');
      return;
    }
    try {
      await H.api('/api/admin/crm/leads/' + encodeURIComponent(lead.id) + '/enroll', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sequenceId: Number(seqId) })
      });
      await loadAll();
      await openLead(lead.id);
    } catch (err) {
      showErr('crm-lead-error', err.message || 'Could not enroll this lead.');
    }
  }

  async function pauseCurrentLeadSeq() {
    var lead = S.leads.find(function (row) { return String(row.id) === String(S.leadId); });
    var pause = $('crm-lead-seq-pause');
    var enrollId = pause && pause.getAttribute('data-enrollment-id');
    if (!lead || !enrollId) return;
    try {
      await H.api('/api/admin/crm/leads/' + encodeURIComponent(lead.id) + '/enrollments/' + encodeURIComponent(enrollId) + '/pause', {
        method: 'POST'
      });
      await loadAll();
      await openLead(lead.id);
    } catch (err) {
      showErr('crm-lead-error', err.message || 'Could not pause this sequence.');
    }
  }

  async function clearDealCalculator() {
    var deal = S.deals.find(function (row) { return String(row.id) === String(S.dealId); });
    if (!deal) return;
    try {
      await H.api('/api/admin/crm/deals/' + encodeURIComponent(deal.id), {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          calculatorQuery: '',
          calculatorSummary: {}
        })
      });
      await loadAll();
      await openDeal(deal.id);
    } catch (err) {
      showErr('crm-pipe-error', err.message || 'Could not unlink the calculator.');
    }
  }

  function bindOnce() {
    if (S.booted) return;
    S.booted = true;
    var leadSearch = $('crm-lead-search');
    if (leadSearch) leadSearch.addEventListener('input', renderLeadTable);
    var actSearch = $('crm-act-search');
    if (actSearch) actSearch.addEventListener('input', renderActivityTable);
    var leadOverview = $('crm-lead-overview');
    if (leadOverview) leadOverview.addEventListener('click', function (ev) {
      var btn = ev.target.closest('[data-filter]');
      if (!btn) return;
      S.leadFilter = btn.getAttribute('data-filter') || 'all';
      fillLeadKpis();
      renderLeadTable();
    });
    var actOverview = $('crm-act-overview');
    if (actOverview) actOverview.addEventListener('click', function (ev) {
      var btn = ev.target.closest('[data-filter]');
      if (!btn) return;
      S.activityFilter = btn.getAttribute('data-filter') || 'all';
      fillActivityKpis();
      renderActivityTable();
    });
    var leadTable = $('crm-lead-table');
    if (leadTable) leadTable.addEventListener('click', function (ev) {
      var row = ev.target.closest('[data-lead-id]');
      if (row) openLead(row.getAttribute('data-lead-id'), { push: true });
    });
    var actTable = $('crm-act-table');
    if (actTable) actTable.addEventListener('click', function (ev) {
      var row = ev.target.closest('[data-act-id]');
      if (row) openActivity(row.getAttribute('data-act-id'));
    });
    var board = $('crm-pipe-board');
    if (board) {
      board.addEventListener('click', function (ev) {
        var card = ev.target.closest('[data-deal-id]');
        if (card) openDeal(card.getAttribute('data-deal-id'), { push: true });
      });
      board.addEventListener('dragstart', function (ev) {
        var card = ev.target.closest('[data-deal-id]');
        if (!card || !ev.dataTransfer) return;
        ev.dataTransfer.setData('text/plain', card.getAttribute('data-deal-id'));
        ev.dataTransfer.effectAllowed = 'move';
        card.classList.add('is-dragging');
      });
      board.addEventListener('dragend', function () {
        renderPipelineBoard();
      });
      board.addEventListener('dragover', function (ev) {
        if (ev.target.closest('.crm-col')) {
          ev.preventDefault();
          ev.dataTransfer.dropEffect = 'move';
        }
      });
      board.addEventListener('drop', function (ev) {
        var col = ev.target.closest('.crm-col');
        if (!col) return;
        ev.preventDefault();
        ev.stopPropagation();
        var id = ev.dataTransfer.getData('text/plain');
        if (id) moveDeal(id, col.getAttribute('data-stage'));
      });
    }
    var leadDeals = $('crm-lead-deals');
    if (leadDeals) leadDeals.addEventListener('click', function (ev) {
      var row = ev.target.closest('[data-open-deal]');
      if (!row || !H.openCompanyTab) return;
      H.openCompanyTab('pipeline', true);
      openDeal(row.getAttribute('data-open-deal'), { push: true });
    });
    if ($('crm-lead-new')) $('crm-lead-new').addEventListener('click', function () { openLeadDrawer(null); });
    if ($('crm-lead-edit')) $('crm-lead-edit').addEventListener('click', function () {
      var lead = S.leads.find(function (row) { return String(row.id) === String(S.leadId); });
      openLeadDrawer(lead || null);
    });
    if ($('crm-lead-convert')) $('crm-lead-convert').addEventListener('click', convertLead);
    if ($('crm-lead-mail')) $('crm-lead-mail').addEventListener('click', function (ev) {
      ev.preventDefault();
      setLeadTab('email');
      var to = $('crm-mail-to');
      if (to) to.focus();
    });
    if ($('crm-mail-form')) $('crm-mail-form').addEventListener('submit', sendLeadEmail);
    if ($('crm-lead-export')) $('crm-lead-export').addEventListener('click', function () {
      exportLeads().catch(function (err) { showErr('crm-lead-error', err.message || 'Could not export.'); });
    });
    if ($('crm-lead-import-btn')) $('crm-lead-import-btn').addEventListener('click', function () {
      var input = $('crm-lead-import');
      if (input) input.click();
    });
    if ($('crm-lead-import')) $('crm-lead-import').addEventListener('change', function (ev) {
      var file = ev.target.files && ev.target.files[0];
      ev.target.value = '';
      if (file) importLeads(file).catch(function (err) { showErr('crm-lead-error', err.message || 'Could not import.'); });
    });
    if ($('crm-convert-cancel')) $('crm-convert-cancel').addEventListener('click', function () { showModal('crm-convert-modal', false); });
    if ($('crm-convert-go')) $('crm-convert-go').addEventListener('click', runConvert);
    if ($('crm-reason-cancel')) $('crm-reason-cancel').addEventListener('click', function () {
      S.pendingMove = null;
      showModal('crm-reason-modal', false);
    });
    if ($('crm-reason-go')) $('crm-reason-go').addEventListener('click', function () {
      var pending = S.pendingMove;
      showModal('crm-reason-modal', false);
      if (!pending) return;
      var reason = val('crm-reason-value') || 'other';
      var extra = pending.stage === 'won' ? { wonReason: reason } : { lostReason: reason };
      S.pendingMove = null;
      moveDeal(pending.id, pending.stage, extra);
    });
    var dealStage = $('crm-deal-stage');
    if (dealStage) dealStage.addEventListener('change', syncDealReasonFields);
    if ($('crm-lead-deal')) $('crm-lead-deal').addEventListener('click', function () {
      var lead = S.leads.find(function (row) { return String(row.id) === String(S.leadId); });
      openDealDrawer(lead ? {
        title: (lead.companyName || leadName(lead)) + ' deal',
        companyName: lead.companyName,
        contactName: lead.contactName || [lead.contactFirst, lead.contactLast].filter(Boolean).join(' '),
        email: lead.email,
        ownerName: lead.ownerName,
        leadId: lead.id,
        kind: lead.kind || (lead.source === 'dealer' ? 'dealer' : 'project'),
        customerId: lead.convertedCustomerId
      } : null);
    });
    if ($('crm-lead-act')) $('crm-lead-act').addEventListener('click', function () { openActivityDrawer({ leadId: S.leadId, type: 'task' }); });
    if ($('crm-pipe-new')) $('crm-pipe-new').addEventListener('click', function () { openDealDrawer(null); });
    if ($('crm-pipe-edit')) $('crm-pipe-edit').addEventListener('click', function () {
      var deal = S.deals.find(function (row) { return String(row.id) === String(S.dealId); });
      openDealDrawer(deal || null);
    });
    if ($('crm-pipe-act')) $('crm-pipe-act').addEventListener('click', function () { openActivityDrawer({ dealId: S.dealId, type: 'task' }); });
    if ($('crm-pipe-quote')) $('crm-pipe-quote').addEventListener('click', async function () {
      var deal = S.deals.find(function (row) { return String(row.id) === String(S.dealId); });
      if (!deal) return;
      try {
        var data = await H.api('/api/admin/crm/deals/' + encodeURIComponent(deal.id) + '/quote', { method: 'POST' });
        await loadAll();
        if (data.deal) await openDeal(data.deal.id);
        if (data.quote && data.quote.id && H.openQuote) {
          H.openQuote({ quoteId: data.quote.id, customerId: data.deal && data.deal.customerId || deal.customerId });
        }
      } catch (err) {
        showErr('crm-pipe-error', err.message || 'Could not open a quote for this deal.');
      }
    });
    if ($('crm-act-new')) $('crm-act-new').addEventListener('click', function () { openActivityDrawer(null); });
    if ($('crm-seq-open')) $('crm-seq-open').addEventListener('click', function () { openSeqDrawer(null); });
    if ($('crm-seq-new')) $('crm-seq-new').addEventListener('click', function () { openSeqDrawer(null); });
    document.querySelectorAll('#crm-lead-detail [data-crm-lead-tab]').forEach(function (btn) {
      btn.addEventListener('click', function () { setLeadTab(btn.getAttribute('data-crm-lead-tab')); });
    });
    document.querySelectorAll('#crm-pipe-detail [data-crm-deal-tab]').forEach(function (btn) {
      btn.addEventListener('click', function () { setDealTab(btn.getAttribute('data-crm-deal-tab')); });
    });
    var kindBar = $('crm-pipe-kind');
    if (kindBar) kindBar.addEventListener('click', function (ev) {
      var btn = ev.target.closest('[data-kind]');
      if (!btn) return;
      S.dealKind = btn.getAttribute('data-kind') || 'all';
      kindBar.querySelectorAll('[data-kind]').forEach(function (el) {
        var on = el.getAttribute('data-kind') === S.dealKind;
        el.classList.toggle('is-on', on);
      });
      fillPipelineKpis();
      renderPipelineBoard();
    });
    if ($('crm-lead-seq-enroll')) $('crm-lead-seq-enroll').addEventListener('click', enrollCurrentLead);
    if ($('crm-lead-seq-pause')) $('crm-lead-seq-pause').addEventListener('click', pauseCurrentLeadSeq);
    if ($('crm-pipe-calc')) $('crm-pipe-calc').addEventListener('click', function () {
      setDealTab('calculator');
      var deal = S.deals.find(function (row) { return String(row.id) === String(S.dealId); });
      if (deal) window.open(dealCalcUrl(deal).replace('&embed=1', ''), '_blank');
    });
    if ($('crm-pipe-calc-clear')) $('crm-pipe-calc-clear').addEventListener('click', clearDealCalculator);
    if ($('crm-seq-form')) $('crm-seq-form').addEventListener('submit', saveSequence);
    if ($('crm-seq-delete')) $('crm-seq-delete').addEventListener('click', deleteSequence);
    var seqList = $('crm-seq-list');
    if (seqList) seqList.addEventListener('click', function (ev) {
      var btn = ev.target.closest('[data-seq-id]');
      if (btn) openSeqDrawer(S.sequences.find(function (row) { return String(row.id) === btn.getAttribute('data-seq-id'); }));
    });
    if ($('crm-lead-form')) $('crm-lead-form').addEventListener('submit', saveLead);
    if ($('crm-deal-form')) $('crm-deal-form').addEventListener('submit', saveDeal);
    if ($('crm-act-form')) $('crm-act-form').addEventListener('submit', saveActivity);
    ['crm-lead-form', 'crm-deal-form', 'crm-act-form', 'crm-seq-form'].forEach(function (id) {
      var form = $(id);
      if (!form) return;
      form.addEventListener('input', function () { S.dirty = true; });
      form.addEventListener('change', function () { S.dirty = true; });
      form.addEventListener('click', function (ev) {
        var btn = ev.target.closest('.cc-sec-btn');
        if (btn) btn.parentElement.classList.toggle('is-open');
      });
    });
    if ($('crm-lead-delete')) $('crm-lead-delete').addEventListener('click', function () { deleteCurrent('lead'); });
    if ($('crm-deal-delete')) $('crm-deal-delete').addEventListener('click', function () { deleteCurrent('deal'); });
    if ($('crm-act-delete')) $('crm-act-delete').addEventListener('click', function () { deleteCurrent('act'); });
    document.querySelectorAll('[data-crm-drawer-close]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        if (S.dirty && !window.confirm('Discard unsaved changes?')) return;
        closeDrawers(true);
      });
    });
    var scrim = $('crm-drawer-scrim');
    if (scrim) scrim.addEventListener('click', function () {
      if (S.dirty && !window.confirm('Discard unsaved changes?')) return;
      closeDrawers(true);
    });
  }

  function boot(hooks) {
    Object.keys(hooks || {}).forEach(function (key) { H[key] = hooks[key]; });
    bindOnce();
  }

  global.SpectrumCrm = {
    boot: boot,
    openRouted: openRouted,
    drawerNeedsLeave: drawerNeedsLeave,
    closeDrawers: closeDrawers,
    view: function () { return S.view; }
  };
})(window);
