/* Page help and the first-visit menu tour for Company and the dealer portal. */
(function () {
  const COMPANY_PAGES = {
    dashboard: ['Dashboard', 'Your start page. See a count for each area, then open the one you need.'],
    calculator: ['Calculator', 'Size an LED wall for a job. Enter the screen size, pick a panel, and save the layout when you are ready to quote it.'],
    products: ['Products', 'The panel series on the public product pages. Change photos, specs, and which series are live.'],
    store: ['Store', 'What shoppers can buy on the US Store. Set the street price and the qty that can sell, then sync those items so checkout works.'],
    accounts: ['Accounts', 'People who created a website login. Look someone up when they cannot sign in or you need to see their account.'],
    dealer: ['Dealer', 'Dealers you already work with. Open one for contacts, a portal login, and what you have sold them.'],
    dealers: ['Applications', 'Dealer applications that came in from the site. Open one, then approve or decline it.'],
    'deal-registrations': ['Deal registration', 'Jobs a dealer registered so you can protect the opportunity. Open one to review it.'],
    'dealer-leads': ['Leads', 'A lead you send to one dealer. They accept or decline it, then move it on their pipeline. You can also send a company CRM lead from the lead itself.'],
    'dealer-rmas': ['RMA', 'Return requests from dealers. Open one to see what they sent back and where it stands.'],
    traffic: ['Traffic', 'Who visited the site and which pages they opened. Use it to see what is getting attention.'],
    inventory: ['Inventory', 'What is in the warehouse. Look up an item and see how many you have, then open it to change the qty or the details.'],
    warehouses: ['Location', 'Your warehouses and bins. Use this when the same item sits in more than one place.'],
    'receipt-shipments': ['Receipt Shipment', 'A shipment that arrived. Match it to the purchase order so the on-hand qty goes up.'],
    vendors: ['Vendor', 'Companies you buy from. Open a supplier to see their contact, terms, and the products you buy from them.'],
    'purchase-orders': ['Purchase Order', 'An order you send to a vendor. Write it, email it, and keep it here until the goods arrive.'],
    leads: ['Lead', 'A new inquiry. Open it, assign it, and turn it into a customer when they are ready to buy.'],
    crm: ['Lead', 'A new inquiry. Open it, assign it, and turn it into a customer when they are ready to buy.'],
    pipeline: ['Pipeline', 'Deals in progress, stage by stage. Move a deal forward when the next step happens.'],
    activities: ['Activity', 'Calls, emails, and tasks that are due. Use this so a follow-up does not sit.'],
    customers: ['Customer', 'Companies you already sell to. Open an account for contacts, addresses, and what you have sold them.'],
    quotes: ['Sales Quote', 'A price you send before they buy. Build it, email it, and turn it into an order when they say yes.'],
    orders: ['Sales Order', 'A confirmed sale. What they are buying, where it ships, and where the order stands.'],
    invoices: ['Invoice', 'What they owe. Send it, then mark it paid when the money comes in.'],
    'installed-walls': ['Installed walls', 'A wall that has shipped. Open one for the site, serials, spare kit, and warranty dates.'],
    sales: ['Sales Quote', 'A price you send before they buy. Build it, email it, and turn it into an order when they say yes.'],
    chat: ['Chat', 'A message to other staff. Use it while you are still on the quote, order, or customer you are talking about.'],
    company: ['Company', 'Your company name, address, and logo. This is what prints on quotes, orders, and invoices.'],
    forms: ['Forms', 'The layout of quotes, orders, and invoices. Change it here when a document should look different.'],
    staff: ['Manage users', 'Staff logins. Add a person, choose what they can open, and turn off someone who left.'],
    roles: ['Manage users', 'Staff logins. Add a person, choose what they can open, and turn off someone who left.'],
    updates: ['What’s new', 'The log of screen changes. Added, changed, or removed, in plain language.'],
    guide: ['Company guide', 'What each menu is for. Use this when you are new or looking for a page.']
  };

  const PORTAL_PAGES = {
    home: ['Dashboard', 'Your start page. See counts for the price book, quote requests, orders, and saved projects, then open one.'],
    book: ['Dealer book', 'Your price list. Search a SKU to see your price and what is on hand. Factory cost is not on this page.'],
    quotes: ['Request Quote', 'Ask Spectrum to price a job. Send the request here, then come back to read the quote they return.'],
    orders: ['Purchase Order', 'Orders you have placed with Spectrum. Open one to see what you ordered and where it stands.'],
    walls: ['Installed walls', 'Walls you installed. Open one for the site, serials, spare kit, and warranty dates.'],
    registrations: ['Deal registration', 'Register a named job so Spectrum can protect the opportunity. Open one to see if it was accepted.'],
    incoming: ['Incoming', 'Leads Spectrum sent you. Accept one to put it on your Leads board, or decline it.'],
    leads: ['Leads', 'Accepted leads on a pipeline. Drag a card to the next stage. Spectrum sees the same move.'],
    rmas: ['RMA', 'Ask to return goods. Open a request to see what you sent and where it stands.'],
    calculator: ['Calculator', 'Size a wall for your customer. Pick a panel and see the cabinet count at your price.'],
    projects: ['Projects', 'Wall layouts you saved. Open one to keep working, or send it as a quote request.'],
    panels: ['Saved Panel', 'Panels you use often. Pick one so the calculator starts on that series.'],
    company: ['Company', 'Your dealer company on the portal. Name, address, and the people who can sign in on this account.'],
    updates: ['What’s new', 'The log of portal screen changes, in plain language.'],
    guide: ['Dealer guide', 'What each menu is for. Use this when you are new or looking for a page.']
  };

  const APPS = {
    company: {
      pages: COMPANY_PAGES,
      tour: [
        ['#tab-dashboard', 'Dashboard', 'Your start page. See a count for each area, then open the one you need.'],
        ['#tab-crm', 'CRM', 'People who might buy, before they are a customer. Work new inquiries and deals in progress from here.'],
        ['#tab-customer', 'Customer', 'Companies you already sell to. Open this for the account, a quote, an order, an invoice, or an installed wall.'],
        ['#tab-dealer', 'Dealer', 'Dealers who buy from Spectrum. Open the dealer list, or review applications that came in from the site.'],
        ['#tab-inventory', 'Inventory', 'What is in the warehouse. Open this to check a SKU, a location, or a shipment that just arrived.'],
        ['#tab-vendor', 'Vendor', 'Companies you buy from. Open this to find a supplier or to write them a purchase order.'],
        ['#tab-calculator', 'Calculator', 'Size an LED wall for a job. Enter the screen size, pick a panel, and save the layout when you are ready to quote it.'],
        ['#tab-website', 'Website', 'What visitors see on the public site. Open this when you are changing the catalog, the store, or website accounts.'],
        ['#header-chat', 'Chat', 'A message to other staff. Use it while you are still on the quote, order, or customer you are talking about.'],
        ['#header-settings', 'Settings', 'Spectrum’s own setup. Company details, the paperwork layout, and who can sign in.']
      ]
    },
    portal: {
      pages: PORTAL_PAGES,
      tour: [
        ['a[data-view="home"]', 'Dashboard', 'Your start page. See counts for the price book, quote requests, orders, and saved projects, then open one.'],
        ['a[data-view="book"]', 'Dealer book', 'Your price list. Search a SKU to see your price and what is on hand. Factory cost is not on this page.'],
        ['#portal-calculator', 'Calculator', 'Size a wall for your customer. Pick a panel and see the cabinet count at your price.'],
        ['a[data-view="registrations"]', 'Deal registration', 'Register a named job so Spectrum can protect the opportunity. Open one to see if it was accepted.'],
        ['a[data-view="leads"]', 'Leads', 'Jobs Spectrum sends you. Open one to accept or decline it. You cannot add your own jobs here.'],
        ['a[data-view="quotes"]', 'Request Quote', 'Ask Spectrum to price a job. Send the request here, then come back to read the quote they return.'],
        ['a[data-view="orders"]', 'Purchase Order', 'Orders you have placed with Spectrum. Open one to see what you ordered and where it stands.'],
        ['a[data-view="walls"]', 'Installed walls', 'Walls you installed. Open one for the site, serials, spare kit, and warranty dates.'],
        ['a[data-view="rmas"]', 'RMA', 'Ask to return goods. Open a request to see what you sent and where it stands.'],
        ['#portal-settings', 'Settings', 'Your dealer company on the portal. Name, address, and the people who can sign in on this account.']
      ]
    }
  };

  const state = {
    app: '',
    userId: '',
    page: '',
    booted: false,
    bootGen: 0,
    cardOpen: false,
    tourOpen: false,
    tourIndex: 0,
    steps: [],
    openedSidebar: false
  };

  let dim = null;
  let card = null;
  let tour = null;
  let wired = false;
  let tourEndFns = [];

  function seenKey() {
    return 'spectrum-help-tour-' + state.app + '-' + (state.userId || 'anon');
  }

  function hasSeen() {
    try { return localStorage.getItem(seenKey()) === '1'; } catch (err) { return false; }
  }

  function markSeen() {
    try { localStorage.setItem(seenKey(), '1'); } catch (err) {}
  }

  function isShown(el) {
    let node = el;
    while (node && node !== document.body) {
      if (node.hidden || (node.classList && node.classList.contains('hidden'))) return false;
      node = node.parentElement;
    }
    if (!el) return false;
    const style = window.getComputedStyle(el);
    return style.display !== 'none' && style.visibility !== 'hidden';
  }

  function pageCopy() {
    const pages = (APPS[state.app] && APPS[state.app].pages) || {};
    const row = pages[state.page];
    if (row) return { title: row[0], text: row[1] };
    const titleEl = document.getElementById('admin-page-title') || document.getElementById('portal-title');
    const title = titleEl && titleEl.textContent ? titleEl.textContent.trim() : '';
    return {
      title: title || 'This page',
      text: 'Use the menu on the left to open an area. This button explains the page you are on.'
    };
  }

  function button() {
    return document.getElementById('app-help-btn');
  }

  function setExpanded(on) {
    const btn = button();
    if (btn) btn.setAttribute('aria-expanded', on ? 'true' : 'false');
  }

  function clearTarget() {
    document.querySelectorAll('.is-help-target').forEach(function (el) {
      el.classList.remove('is-help-target');
    });
  }

  function placeNear(panel, anchor, preferRight) {
    const rect = anchor.getBoundingClientRect();
    const margin = 12;
    const width = Math.min(352, window.innerWidth - margin * 2);
    panel.style.width = width + 'px';
    const height = panel.offsetHeight || 180;
    let left = preferRight ? rect.right + margin : rect.right - width;
    let top = preferRight ? rect.top : rect.bottom + 8;
    if (left + width > window.innerWidth - margin || left < margin) {
      left = Math.max(margin, window.innerWidth - width - margin);
      if (preferRight) top = rect.bottom + margin;
    }
    if (top + height > window.innerHeight - margin) {
      const above = rect.top - height - margin;
      top = above >= margin ? above : Math.max(margin, window.innerHeight - height - margin);
    }
    if (top < margin) top = margin;
    panel.style.left = left + 'px';
    panel.style.top = top + 'px';
  }

  function fillCard() {
    const copy = pageCopy();
    const title = document.getElementById('app-help-card-title');
    const text = document.getElementById('app-help-card-text');
    if (title) title.textContent = copy.title;
    if (text) text.textContent = copy.text;
    const btn = button();
    if (btn) btn.setAttribute('data-help-page', state.page || '');
  }

  function openCard() {
    if (state.tourOpen) return;
    fillCard();
    card.hidden = false;
    state.cardOpen = true;
    setExpanded(true);
    const btn = button();
    if (btn) placeNear(card, btn, false);
    const dismiss = document.getElementById('app-help-dismiss');
    if (dismiss) dismiss.focus();
  }

  function closeCard() {
    if (card) card.hidden = true;
    state.cardOpen = false;
    setExpanded(false);
  }

  function visibleSteps() {
    const tourSteps = (APPS[state.app] && APPS[state.app].tour) || [];
    return tourSteps.filter(function (step) {
      const el = document.querySelector(step[0]);
      return isShown(el);
    });
  }

  function showStep(index) {
    if (!state.tourOpen) return;
    if (index < 0) index = 0;
    if (index >= state.steps.length) {
      endTour(true);
      return;
    }
    state.tourIndex = index;
    const step = state.steps[index];
    const target = document.querySelector(step[0]);
    clearTarget();
    if (target) {
      target.classList.add('is-help-target');
      try { target.scrollIntoView({ block: 'nearest', inline: 'nearest' }); } catch (err) {}
    }
    document.getElementById('app-help-tour-title').textContent = step[1];
    document.getElementById('app-help-tour-text').textContent = step[2];
    document.getElementById('app-help-count').textContent = (index + 1) + ' of ' + state.steps.length;
    const back = document.getElementById('app-help-back');
    const next = document.getElementById('app-help-next');
    if (back) back.disabled = index === 0;
    if (next) next.textContent = index === state.steps.length - 1 ? 'Done' : 'Next';
    window.requestAnimationFrame(function () {
      if (!state.tourOpen || !target) return;
      placeNear(tour, target, true);
      if (next) next.focus();
    });
  }

  function beginTour() {
    closeCard();
    state.steps = visibleSteps();
    if (!state.steps.length) {
      markSeen();
      fireTourEnd();
      return;
    }
    state.openedSidebar = false;
    if (window.matchMedia('(max-width: 900px)').matches && !document.body.classList.contains('dash-open')) {
      document.body.classList.add('dash-open');
      state.openedSidebar = true;
    }
    state.tourOpen = true;
    document.body.classList.add('app-help-on');
    dim.hidden = false;
    tour.hidden = false;
    window.setTimeout(function () {
      if (state.tourOpen) showStep(0);
    }, state.openedSidebar ? 220 : 20);
  }

  function endTour(remember) {
    state.tourOpen = false;
    state.steps = [];
    clearTarget();
    if (tour) tour.hidden = true;
    if (dim) dim.hidden = true;
    document.body.classList.remove('app-help-on');
    if (state.openedSidebar) document.body.classList.remove('dash-open');
    state.openedSidebar = false;
    if (remember) markSeen();
    const btn = button();
    if (remember && btn && !btn.hidden && !btn.classList.contains('hidden')) btn.focus();
    if (remember) fireTourEnd();
    else tourEndFns = [];
  }

  function fireTourEnd() {
    const fns = tourEndFns.slice();
    tourEndFns = [];
    fns.forEach(function (fn) {
      try { fn(); } catch (err) {}
    });
  }

  function onDocClick(event) {
    if (!state.cardOpen) return;
    if (event.target.closest && (event.target.closest('#app-help-btn') || event.target.closest('#app-help-card'))) return;
    closeCard();
  }

  function onKey(event) {
    if (event.key !== 'Escape') return;
    if (state.tourOpen) {
      event.preventDefault();
      endTour(true);
    } else if (state.cardOpen) {
      event.preventDefault();
      closeCard();
    }
  }

  function onPlace() {
    if (state.cardOpen) {
      const btn = button();
      if (btn) placeNear(card, btn, false);
    } else if (state.tourOpen && state.steps[state.tourIndex]) {
      const target = document.querySelector(state.steps[state.tourIndex][0]);
      if (target) placeNear(tour, target, true);
    }
  }

  function ensureUi() {
    if (wired) return;
    wired = true;
    dim = document.createElement('div');
    dim.className = 'app-help-dim';
    dim.hidden = true;
    tour = document.createElement('div');
    tour.id = 'app-help-tour';
    tour.className = 'app-help-tour-card';
    tour.setAttribute('role', 'dialog');
    tour.setAttribute('aria-modal', 'true');
    tour.setAttribute('aria-labelledby', 'app-help-tour-title');
    tour.hidden = true;
    tour.innerHTML = ''
      + '<p class="app-help-kicker">Menu tour</p>'
      + '<p class="app-help-title" id="app-help-tour-title"></p>'
      + '<p class="app-help-text" id="app-help-tour-text"></p>'
      + '<div class="app-help-actions">'
      + '<button type="button" class="app-help-text-btn" id="app-help-skip">Skip</button>'
      + '<span class="app-help-step" id="app-help-count"></span>'
      + '<button type="button" class="app-help-text-btn" id="app-help-back">Back</button>'
      + '<button type="button" class="app-help-primary" id="app-help-next">Next</button>'
      + '</div>';
    card = document.createElement('div');
    card.id = 'app-help-card';
    card.className = 'app-help-card';
    card.setAttribute('role', 'dialog');
    card.setAttribute('aria-labelledby', 'app-help-card-title');
    card.hidden = true;
    card.innerHTML = ''
      + '<p class="app-help-title" id="app-help-card-title"></p>'
      + '<p class="app-help-text" id="app-help-card-text"></p>'
      + '<div class="app-help-actions">'
      + '<button type="button" class="app-help-text-btn" id="app-help-replay">Show menu tour</button>'
      + '<button type="button" class="app-help-primary" id="app-help-dismiss">Got it</button>'
      + '</div>';
    document.body.appendChild(dim);
    document.body.appendChild(tour);
    document.body.appendChild(card);
    document.getElementById('app-help-skip').addEventListener('click', function () { endTour(true); });
    document.getElementById('app-help-back').addEventListener('click', function () { showStep(state.tourIndex - 1); });
    document.getElementById('app-help-next').addEventListener('click', function () {
      if (state.tourIndex >= state.steps.length - 1) endTour(true);
      else showStep(state.tourIndex + 1);
    });
    document.getElementById('app-help-dismiss').addEventListener('click', closeCard);
    document.getElementById('app-help-replay').addEventListener('click', function () { beginTour(); });
    const btn = button();
    if (btn) {
      btn.addEventListener('click', function (event) {
        event.preventDefault();
        event.stopPropagation();
        if (state.cardOpen) closeCard();
        else openCard();
      });
    }
    document.addEventListener('click', onDocClick);
    document.addEventListener('keydown', onKey);
    window.addEventListener('resize', onPlace);
    document.addEventListener('scroll', onPlace, true);
  }

  function showButton() {
    const btn = button();
    if (!btn) return;
    btn.classList.remove('hidden');
    btn.hidden = false;
  }

  function hideButton() {
    const btn = button();
    if (!btn) return;
    btn.classList.add('hidden');
    btn.hidden = true;
    setExpanded(false);
  }

  window.SpectrumHelp = {
    start: function (opts) {
      opts = opts || {};
      if (!APPS[opts.app]) return;
      state.app = opts.app;
      state.userId = opts.userId == null ? '' : String(opts.userId);
      if (opts.page) state.page = opts.page;
      ensureUi();
      showButton();
      fillCard();
      if (state.booted) return;
      state.booted = true;
      if (hasSeen()) {
        window.setTimeout(fireTourEnd, 0);
        return;
      }
      const gen = ++state.bootGen;
      window.setTimeout(function () {
        if (gen !== state.bootGen || state.tourOpen || hasSeen()) return;
        beginTour();
      }, 450);
    },
    setPage: function (page) {
      state.page = page || '';
      if (card && state.cardOpen) fillCard();
      else if (wired) fillCard();
      const btn = button();
      if (btn) btn.setAttribute('data-help-page', state.page || '');
    },
    stop: function () {
      state.bootGen += 1;
      state.booted = false;
      closeCard();
      if (state.tourOpen) endTour(false);
      hideButton();
    },
    isTourOpen: function () {
      return !!state.tourOpen;
    },
    onTourEnd: function (fn) {
      if (typeof fn !== 'function') return;
      if (state.booted && hasSeen() && !state.tourOpen) {
        window.setTimeout(fn, 0);
        return;
      }
      tourEndFns.push(fn);
    }
  };
})();
