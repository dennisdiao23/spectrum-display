/**
 * NovaStar control-systems catalog.
 * Controllers and cards — not LED cabinets. Do not treat as a 6th cabinet brand.
 * Specs: official model names and published loading / I/O only. Copy is Spectrum's.
 */
(function (global) {
  // Official NovaStar product photos (novastar.tech / oss specs). SVG placeholders where no photo found.
  var PHOTO_EXT = {
    'vx400-pro': '.png', 'vx600-pro': '.png', 'vx1000-pro': '.png', 'vx2000-pro': '.png',
    ku20: '.png', mx20: '.png', mx30: '.png', 'mx40-pro': '.png',
    msd300: '.jpg',
    mctrl300: '.png', mctrl600: '.png', 'mctrl660-pro': '.png', mctrl4k: '.jpg',
    'tu15-pro': '.png', 'tu20-pro': '.png', 'tu4k-pro': '.png', tb60: '.png',
    'a5s-plus': '.jpg', 'a10s-pro': '.jpg', 'mrv412-n': '.jpg'
  };

  function nv(cfg) {
    var subtype = cfg.subtype;
    var cats = ['control', subtype];
    if (subtype === 'receiving-card') cats.push('receiving-cards');
    var ext = PHOTO_EXT[cfg.id] || '.svg';
    return {
      id: cfg.id,
      name: cfg.name,
      model: cfg.model,
      family: cfg.family,
      type: 'control',
      subtype: subtype,
      replacementOnly: !!cfg.replacementOnly,
      pitches: [],
      pricePerM2: 0,
      priceEach: Number(cfg.priceEach) || 0,
      cabinetW: 0,
      cabinetH: 0,
      weightPerM2: 0,
      powerAvg: 0,
      powerMax: 0,
      description: cfg.description,
      lead: cfg.lead || cfg.description,
      badge: cfg.badge || null,
      cats: cats,
      image: 'assets/products/novastar/' + cfg.id + ext,
      maxPixels: cfg.maxPixels || 0,
      outputs: cfg.outputs || '',
      inputs: cfg.inputs || '',
      bestFor: cfg.bestFor || '',
      bestWith: cfg.bestWith || [],
      latency: cfg.latency || '',
      hdr: cfg.hdr || '',
      chips: cfg.chips || [],
      specTable: cfg.specTable || [],
      sourceUrl: cfg.sourceUrl || 'https://www.novastar.tech',
      features: cfg.features || []
    };
  }

  function spec(rows) {
    return [['Parameter', 'Value']].concat(rows);
  }

  var series = [
    nv({
      id: 'vx400-pro',
      name: 'NovaStar VX400 Pro',
      model: 'VX400 Pro',
      family: 'VX Pro',
      subtype: 'all-in-one',
      maxPixels: 2600000,
      outputs: '4× RJ45 · 2× 10G OPT',
      inputs: 'HDMI 2.0 · HDMI 1.3 · 3G-SDI',
      bestFor: 'Retail · small fixed walls',
      bestWith: ['posters', 'fixed-indoor'],
      latency: 'Low latency / ByPass',
      chips: ['2.6M px', '4× RJ45', 'HDMI + SDI'],
      description: 'All-in-one processor for compact walls. Scales HDMI or SDI and sends pixel-accurate output to the cards already in each cabinet.',
      features: [
        { title: 'Processor + sender in one', text: 'HDMI and SDI in, scaled output over four Gigabit ports. No separate scaler required for a small fixed wall.' },
        { title: '2.6 million pixel load', text: 'Published capacity 2.6 million pixels, 4× RJ45 plus two 10G optical ports.' }
      ],
      specTable: spec([
        ['Family', 'VX Pro all-in-one'],
        ['Loading capacity', '2.6 million pixels'],
        ['Ethernet outputs', '4× Gigabit RJ45'],
        ['Optical', '2× 10G OPT'],
        ['Key inputs', '1× HDMI 2.0 (IN & LOOP), 2× HDMI 1.3, 1× 3G-SDI (IN & LOOP)'],
        ['Max width / height', '10,240 × 8,192 px']
      ])
    }),
    nv({
      id: 'vx600-pro',
      name: 'NovaStar VX600 Pro',
      model: 'VX600 Pro',
      family: 'VX Pro',
      subtype: 'all-in-one',
      maxPixels: 3900000,
      outputs: '6× RJ45 · 2× 10G OPT',
      inputs: 'HDMI 2.0 · HDMI 1.3 · 3G-SDI',
      bestFor: 'Sports bar · mid commercial',
      bestWith: ['fixed-indoor', 'posters'],
      latency: 'Low latency / ByPass',
      chips: ['3.9M px', '6× RJ45', 'HDMI + SDI'],
      description: 'Mid-size all-in-one for lobbies, sports bars, and meeting rooms. Six Ethernet ports cover most walls that are not yet 4K-native.',
      features: [
        { title: '3.9 million pixel load', text: 'Published capacity 3.9 million pixels on 6× RJ45, with the same HDMI / SDI input set as VX400 Pro.' },
        { title: 'One box at the rack', text: 'Processor and sender in a single chassis so the wall does not need a separate scaler.' }
      ],
      specTable: spec([
        ['Family', 'VX Pro all-in-one'],
        ['Loading capacity', '3.9 million pixels'],
        ['Ethernet outputs', '6× Gigabit RJ45'],
        ['Optical', '2× 10G OPT'],
        ['Key inputs', '1× HDMI 2.0 (IN & LOOP), 2× HDMI 1.3, 1× 3G-SDI (IN & LOOP)'],
        ['Max width / height', '10,240 × 8,192 px']
      ])
    }),
    nv({
      id: 'vx1000-pro',
      name: 'NovaStar VX1000 Pro',
      model: 'VX1000 Pro',
      family: 'VX Pro',
      subtype: 'all-in-one',
      maxPixels: 6500000,
      outputs: '10× RJ45 · 2× 10G OPT',
      inputs: 'HDMI 2.0 · HDMI 1.3 · 3G-SDI',
      bestFor: '4K fixed · corporate · control room',
      bestWith: ['cob', 'fixed-indoor', 'indoor-rental'],
      latency: 'Low latency / ByPass',
      hdr: '4K×2K@60Hz input',
      chips: ['6.5M px', '10× RJ45', '4K input'],
      description: 'The usual pick for a 4K corporate or control-room wall. Ten Ethernet ports and 6.5 million pixel capacity with HDMI 2.0 in.',
      features: [
        { title: '6.5 million pixel load', text: 'Published capacity 6.5 million pixels on 10× RJ45 — enough for most native 4K cabinets with headroom.' },
        { title: '4K input', text: 'HDMI 2.0 path accepts 4K×2K@60Hz, then scales and color-corrects for the wall.' }
      ],
      specTable: spec([
        ['Family', 'VX Pro all-in-one'],
        ['Loading capacity', '6.5 million pixels'],
        ['Ethernet outputs', '10× Gigabit RJ45'],
        ['Optical', '2× 10G OPT'],
        ['Key inputs', '1× HDMI 2.0 (IN & LOOP), 2× HDMI 1.3, 1× 3G-SDI (IN & LOOP)'],
        ['Max input', '4K×2K@60Hz'],
        ['Max width / height', '10,240 × 8,192 px']
      ])
    }),
    nv({
      id: 'vx2000-pro',
      name: 'NovaStar VX2000 Pro',
      model: 'VX2000 Pro',
      family: 'VX Pro',
      subtype: 'all-in-one',
      maxPixels: 13000000,
      outputs: '20× RJ45 · 4× OPT',
      inputs: '12G-SDI · DP 1.2 · HDMI 2.0',
      bestFor: 'Large rental · events · wide façades',
      bestWith: ['indoor-rental', 'outdoor-rental', 'creative'],
      latency: 'Low latency / ByPass',
      hdr: '4K×2K@60Hz input',
      chips: ['13M px', '20× RJ45', '12G-SDI + DP'],
      description: 'High-capacity all-in-one for wide events and large façades. Twenty Ethernet ports load up to 13 million pixels.',
      features: [
        { title: '13 million pixel load', text: 'Published capacity 13 million pixels, max width 16,384 px, on 20× RJ45.' },
        { title: 'Broadcast inputs', text: '12G-SDI, DisplayPort 1.2, and dual HDMI 2.0 for rental racks and control rooms.' }
      ],
      specTable: spec([
        ['Family', 'VX Pro all-in-one'],
        ['Loading capacity', '13 million pixels'],
        ['Ethernet outputs', '20× Gigabit RJ45'],
        ['Optical', '4× OPT'],
        ['Key inputs', '1× 12G-SDI (IN & LOOP), 1× DP 1.2, 2× HDMI 2.0, 4× HDMI 1.3'],
        ['Max width / height', '16,384 × 8,192 px']
      ])
    }),
    nv({
      id: 'ku20',
      name: 'NovaStar KU20',
      model: 'KU20',
      family: 'COEX',
      subtype: 'all-in-one',
      maxPixels: 3900000,
      outputs: '6× RJ45 · 1× 10G OPT',
      inputs: 'HDMI 1.3',
      bestFor: 'Small walls · posters',
      bestWith: ['posters', 'fixed-indoor'],
      chips: ['3.9M px', '6× RJ45', 'HDMI 1.3'],
      description: 'Compact COEX controller for posters and small 2K walls. One HDMI in, six Ethernet out — pair with a player if you need scaling layers.',
      features: [
        { title: '3.9 million pixel load', text: 'Published capacity 3.9 million pixels on 6× RJ45 plus one 10G optical output.' },
        { title: 'Simple HDMI path', text: 'Single HDMI 1.3 input with loop. Use it when the source is already the right size, or add a scaler upstream.' }
      ],
      specTable: spec([
        ['Family', 'COEX'],
        ['Loading capacity', '3.9 million pixels'],
        ['Ethernet outputs', '6× Gigabit RJ45'],
        ['Optical', '1× 10G OPT'],
        ['Key inputs', '1× HDMI 1.3 with loop']
      ])
    }),
    nv({
      id: 'mx20',
      name: 'NovaStar MX20',
      model: 'MX20',
      family: 'COEX',
      subtype: 'all-in-one',
      maxPixels: 3900000,
      outputs: '6× RJ45 · 2× 10G OPT',
      inputs: 'HDMI 1.3 · 3G-SDI',
      bestFor: 'Retail · small commercial',
      bestWith: ['fixed-indoor', 'posters'],
      chips: ['3.9M px', '6× RJ45', 'HDMI + SDI'],
      description: 'COEX all-in-one with HDMI and SDI in. Same 3.9 million pixel load as KU20, with extra inputs for mixed AV racks.',
      features: [
        { title: '3.9 million pixel load', text: 'Published capacity 3.9 million pixels on 6× RJ45 and two 10G optical ports.' },
        { title: 'HDMI + SDI', text: 'Two HDMI 1.3 inputs and 3G-SDI with loop for retail and small commercial walls.' }
      ],
      specTable: spec([
        ['Family', 'COEX'],
        ['Loading capacity', '3.9 million pixels'],
        ['Ethernet outputs', '6× Gigabit RJ45'],
        ['Optical', '2× 10G OPT'],
        ['Key inputs', '2× HDMI 1.3 (loop), 1× 3G-SDI (loop)']
      ])
    }),
    nv({
      id: 'mx30',
      name: 'NovaStar MX30',
      model: 'MX30',
      family: 'COEX',
      subtype: 'all-in-one',
      maxPixels: 6500000,
      outputs: '10× RJ45 · 2× 10G OPT',
      inputs: 'HDMI 2.0 · HDMI 1.4 · DP 1.1 · 3G-SDI',
      bestFor: 'Sports bar · mid commercial',
      bestWith: ['fixed-indoor', 'cob'],
      hdr: 'HDR10 / HLG',
      chips: ['6.5M px', '10× RJ45', 'HDMI 2.0 + SDI'],
      description: 'COEX mid-range for sports bars and meeting rooms. HDMI 2.0 and SDI in, 6.5 million pixels out.',
      features: [
        { title: '6.5 million pixel load', text: 'Published capacity 6.5 million pixels on 10× RJ45.' },
        { title: '4K-class inputs', text: 'HDMI 2.0, HDMI 1.4, DP 1.1, and dual 3G-SDI with loop.' }
      ],
      specTable: spec([
        ['Family', 'COEX'],
        ['Loading capacity', '6.5 million pixels'],
        ['Ethernet outputs', '10× Gigabit RJ45'],
        ['Optical', '2× 10G OPT'],
        ['Key inputs', '1× HDMI 2.0, 1× HDMI 1.4, 1× DP 1.1, 2× 3G-SDI with loop'],
        ['HDR', 'HDR10 / HLG']
      ])
    }),
    nv({
      id: 'mx40-pro',
      name: 'NovaStar MX40 Pro',
      model: 'MX40 Pro',
      family: 'COEX',
      subtype: 'all-in-one',
      maxPixels: 9000000,
      outputs: '20× RJ45 · 4× 10G OPT',
      inputs: 'HDMI 2.0 · DP 1.2 · 12G-SDI',
      bestFor: '4K fixed · control room',
      bestWith: ['cob', 'fixed-indoor'],
      hdr: 'HDR10 / HLG',
      chips: ['9M px', '20× RJ45', '12G-SDI + DP'],
      description: 'COEX 4K controller for control rooms and large corporate walls. Twenty Ethernet ports, 9 million pixel load, 12G-SDI and DP in.',
      features: [
        { title: '9 million pixel load', text: 'Published COEX capacity 9 million pixels on 20× RJ45 plus four 10G optical ports.' },
        { title: '4K and SDI', text: 'HDMI 2.0, DisplayPort 1.2, and 12G-SDI for broadcast-style control rooms.' }
      ],
      specTable: spec([
        ['Family', 'COEX'],
        ['Loading capacity', '9 million pixels'],
        ['Ethernet outputs', '20× Gigabit RJ45'],
        ['Optical', '4× 10G OPT'],
        ['Key inputs', 'HDMI 2.0, DP 1.2, 12G-SDI'],
        ['HDR', 'HDR10 / HLG']
      ])
    }),
    nv({
      id: 'msd300',
      name: 'NovaStar MSD300',
      model: 'MSD300',
      family: 'MSD',
      subtype: 'sending',
      maxPixels: 1300000,
      outputs: '2× RJ45',
      inputs: 'DVI',
      bestFor: 'Spare sender · small output-only',
      bestWith: ['posters', 'fixed-indoor'],
      chips: ['1.3M px', '2× RJ45', 'DVI'],
      description: 'Sending card only — no scaler. Use it when a processor already exists and you need two extra Ethernet outputs.',
      features: [
        { title: 'Sending card, not a processor', text: 'DVI in, two Gigabit ports out. Pair with an upstream scaler if the source is not already pixel-to-pixel.' },
        { title: '1.3 million pixel load', text: 'Published capacity 1.3 million pixels (2× 650,000 per port).' }
      ],
      specTable: spec([
        ['Family', 'MSD sending'],
        ['Loading capacity', '1.3 million pixels'],
        ['Ethernet outputs', '2× Gigabit RJ45'],
        ['Key inputs', 'DVI']
      ])
    }),
    nv({
      id: 'msd600',
      name: 'NovaStar MSD600',
      model: 'MSD600',
      family: 'MSD',
      subtype: 'sending',
      maxPixels: 2300000,
      outputs: '4× RJ45',
      inputs: 'DVI',
      bestFor: 'Output-only expansion',
      bestWith: ['fixed-indoor', 'indoor-rental'],
      chips: ['2.3M px', '4× RJ45', 'DVI'],
      description: 'Four-port sending card for an existing processor. Adds Ethernet outputs without another all-in-one box.',
      features: [
        { title: 'Sending card, not a processor', text: 'Use when video processing is already handled and you only need more cabinet outputs.' },
        { title: '2.3 million pixel load', text: 'Published capacity 2.3 million pixels on 4× RJ45.' }
      ],
      specTable: spec([
        ['Family', 'MSD sending'],
        ['Loading capacity', '2.3 million pixels'],
        ['Ethernet outputs', '4× Gigabit RJ45'],
        ['Key inputs', 'DVI']
      ])
    }),
    nv({
      id: 'mctrl300',
      name: 'NovaStar MCTRL300',
      model: 'MCTRL300',
      family: 'MCTRL',
      subtype: 'sending',
      maxPixels: 1300000,
      outputs: '2× RJ45',
      inputs: 'DVI · audio',
      bestFor: 'Small sender · rental spare',
      bestWith: ['posters', 'indoor-rental'],
      chips: ['1.3M px', '2× RJ45', 'DVI'],
      description: 'Compact sending box with DVI in and two Ethernet ports. Keeps a small wall or a spare output path running when you already have a processor.',
      features: [
        { title: 'Independent sender', text: '1× DVI, 2× RJ45, USB control. Cascade additional units when one box is not enough.' },
        { title: '1.3 million pixel load', text: 'Published capacity 1.3 million pixels; max input 1920×1200@60Hz.' }
      ],
      specTable: spec([
        ['Family', 'MCTRL sending'],
        ['Loading capacity', '1.3 million pixels'],
        ['Ethernet outputs', '2× Gigabit RJ45'],
        ['Key inputs', '1× SL-DVI, 1× audio'],
        ['Max input', '1920×1200@60Hz']
      ])
    }),
    nv({
      id: 'mctrl600',
      name: 'NovaStar MCTRL600',
      model: 'MCTRL600',
      family: 'MCTRL',
      subtype: 'sending',
      maxPixels: 2600000,
      outputs: '4× RJ45',
      inputs: 'DVI · HDMI 1.3',
      bestFor: 'Output-only mid walls',
      bestWith: ['fixed-indoor', 'indoor-rental'],
      chips: ['2.6M px', '4× RJ45', 'HDMI + DVI'],
      description: 'Four-port sending box with HDMI and DVI. Choose this when a scaler already sits upstream and you only need to drive cabinets.',
      features: [
        { title: '2.6 million pixel load', text: 'Published 4× RJ45 at up to 650,000 pixels per port (8-bit).' },
        { title: 'HDMI + DVI', text: '1× HDMI 1.3 and 1× SL-DVI, max 1920×1200@60Hz.' }
      ],
      specTable: spec([
        ['Family', 'MCTRL sending'],
        ['Loading capacity', '2.6 million pixels'],
        ['Ethernet outputs', '4× Gigabit RJ45'],
        ['Key inputs', '1× SL-DVI, 1× HDMI 1.3, audio'],
        ['Max input', '1920×1200@60Hz']
      ])
    }),
    nv({
      id: 'mctrl660-pro',
      name: 'NovaStar MCTRL660 Pro',
      model: 'MCTRL660 Pro',
      family: 'MCTRL',
      subtype: 'sending',
      maxPixels: 2300000,
      outputs: '6× RJ45 · 2× 10G OPT',
      inputs: 'HDMI · DVI · 3G-SDI',
      bestFor: 'Rental sender with fiber',
      bestWith: ['indoor-rental', 'outdoor-rental'],
      chips: ['2.3M px', '6× RJ45', 'SDI + fiber'],
      description: 'Rental-friendly sender with SDI, HDMI, DVI, and dual 10G fiber. Use it to extend an existing processor, not as the only scaler on a 4K wall.',
      features: [
        { title: 'Fiber + copper', text: '6× RJ45 and 2× 10G SFP+ for long runs to the wall.' },
        { title: '2.3 million pixel load', text: 'Published device capacity 2.3 million pixels; 8-bit ports up to 650,000 px each.' }
      ],
      specTable: spec([
        ['Family', 'MCTRL sending'],
        ['Loading capacity', '2.3 million pixels'],
        ['Ethernet outputs', '6× Gigabit RJ45'],
        ['Optical', '2× 10G SFP+'],
        ['Key inputs', 'HDMI 1.4a, SL-DVI, 3G-SDI'],
        ['Max input', '1920×1200@60Hz']
      ])
    }),
    nv({
      id: 'mctrl4k',
      name: 'NovaStar MCTRL4K',
      model: 'MCTRL4K',
      family: 'MCTRL',
      subtype: 'sending',
      maxPixels: 8800000,
      outputs: '16× EtherCON · 4× 10G',
      inputs: 'DP · HDMI · DVI',
      bestFor: 'Large rental · events',
      bestWith: ['indoor-rental', 'outdoor-rental', 'creative'],
      chips: ['8.8M px', '16× EtherCON', '4K sender'],
      description: '4K sending box for large rental walls. Sixteen EtherCON ports and 8.8 million pixel capacity when the processor (or source) is already sorted.',
      features: [
        { title: '8.8 million pixel load', text: 'Published capacity 8.8 million pixels on 16× EtherCON plus four 10G optical ports.' },
        { title: '4K-class sender', text: 'DP, HDMI, and dual DVI inputs for event racks that already have a scaler.' }
      ],
      specTable: spec([
        ['Family', 'MCTRL sending'],
        ['Loading capacity', '8.8 million pixels'],
        ['Ethernet outputs', '16× EtherCON'],
        ['Optical', '4× 10G'],
        ['Key inputs', 'DisplayPort, HDMI, 2× DVI']
      ])
    }),
    nv({
      id: 'tu15-pro',
      name: 'NovaStar TU15 Pro',
      model: 'TU15 Pro',
      family: 'TU',
      subtype: 'playback',
      maxPixels: 2600000,
      outputs: '4× RJ45',
      inputs: 'HDMI · USB · Android playback',
      bestFor: '4K playback · no media player',
      bestWith: ['posters', 'fixed-indoor'],
      chips: ['2.6M px', '4× RJ45', 'Android + HDMI'],
      description: 'Playback box with a sender built in. Run playlists from the device or USB when there is no separate media player.',
      features: [
        { title: 'Player + sender', text: 'Android playback, HDMI in, and 4× RJ45 out so a poster or small wall does not need a second box.' },
        { title: '2.6 million pixel load', text: 'Published capacity 2.6 million pixels on four Ethernet ports.' }
      ],
      specTable: spec([
        ['Family', 'TU playback'],
        ['Loading capacity', '2.6 million pixels'],
        ['Ethernet outputs', '4× Gigabit RJ45'],
        ['Key inputs', '2× HDMI 1.3, 3× USB 2.0'],
        ['Playback', 'Android 11, H.264 / H.265']
      ])
    }),
    nv({
      id: 'tu20-pro',
      name: 'NovaStar TU20 Pro',
      model: 'TU20 Pro',
      family: 'TU',
      subtype: 'playback',
      maxPixels: 3900000,
      outputs: '6× RJ45',
      inputs: 'HDMI · USB · Android playback',
      bestFor: '4K playback · mid signage',
      bestWith: ['fixed-indoor', 'posters'],
      chips: ['3.9M px', '6× RJ45', 'Android + HDMI'],
      description: 'Larger TU playback processor for signage that should run without a separate player. Six Ethernet ports, 3.9 million pixels.',
      features: [
        { title: '3.9 million pixel load', text: 'Published capacity 3.9 million pixels on 6× RJ45 when scaling is enabled.' },
        { title: 'Standalone playlists', text: 'Android playback plus HDMI in for lobbies and meeting rooms that do not have a dedicated media player.' }
      ],
      specTable: spec([
        ['Family', 'TU playback'],
        ['Loading capacity', '3.9 million pixels (scaling)'],
        ['Ethernet outputs', '6× Gigabit RJ45'],
        ['Key inputs', '2× HDMI 1.3, USB'],
        ['Playback', 'Android 11']
      ])
    }),
    nv({
      id: 'tu4k-pro',
      name: 'NovaStar TU4K Pro',
      model: 'TU4K Pro',
      family: 'TU',
      subtype: 'playback',
      maxPixels: 13000000,
      outputs: '20× RJ45 · 2× OPT',
      inputs: 'HDMI · USB · 4K playback',
      bestFor: '4K playback · large signage',
      bestWith: ['fixed-indoor', 'outdoor-fixed'],
      chips: ['13M px', '20× RJ45', '4K playback'],
      description: 'High-capacity TU playback processor for large signage walls that need onboard content as well as HDMI.',
      features: [
        { title: '13 million pixel load', text: 'Published high-capacity TU output: 20× RJ45 plus optical, up to 13 million pixels.' },
        { title: '4K playback path', text: 'Use when the wall should play files on the box instead of a separate media player.' }
      ],
      specTable: spec([
        ['Family', 'TU playback'],
        ['Loading capacity', '13 million pixels'],
        ['Ethernet outputs', '20× Gigabit RJ45'],
        ['Optical', '2× OPT'],
        ['Playback', '4K onboard + HDMI']
      ])
    }),
    nv({
      id: 'tb60',
      name: 'NovaStar TB60',
      model: 'TB60',
      family: 'TB',
      subtype: 'playback',
      maxPixels: 2300000,
      outputs: '2× RJ45',
      inputs: 'HDMI · USB · Taurus playback',
      bestFor: 'Outdoor signage · posters',
      bestWith: ['posters', 'outdoor-fixed'],
      chips: ['2.3M px', '2× RJ45', 'Taurus player'],
      description: 'Taurus playback box for posters and outdoor signage that should run on a schedule without a separate player.',
      features: [
        { title: 'Player for small walls', text: 'Onboard Taurus playback plus two Ethernet ports — typical for a poster or a modest outdoor board.' },
        { title: '2.3 million pixel load', text: 'Published capacity 2.3 million pixels on 2× RJ45.' }
      ],
      specTable: spec([
        ['Family', 'TB / Taurus playback'],
        ['Loading capacity', '2.3 million pixels'],
        ['Ethernet outputs', '2× Gigabit RJ45'],
        ['Playback', 'Taurus / ViPlex']
      ])
    }),
    nv({
      id: 'a5s-plus',
      name: 'NovaStar A5s Plus',
      model: 'A5s Plus',
      family: 'Armor',
      subtype: 'receiving-card',
      replacementOnly: true,
      badge: 'Replacement only — included with new cabinets',
      maxPixels: 196608,
      outputs: 'Cabinet hub (spare)',
      inputs: 'Gigabit from sender',
      bestFor: 'Spare / field replacement',
      chips: ['512×384', 'Replacement only'],
      description: 'Receiving card sold only as a spare. New Spectrum walls already include a card in each cabinet — do not add this to a new-wall quote.',
      features: [
        { title: 'Replacement only', text: 'New Spectrum cabinets ship with receiving cards installed. Order A5s Plus only if you need a spare or a field replacement.' },
        { title: 'Published load', text: 'Typical Armor load 512×384 pixels per card.' }
      ],
      specTable: spec([
        ['Family', 'Armor receiving card'],
        ['Use', 'Replacement / spare only'],
        ['Typical load', '512×384 px'],
        ['Included with new cabinets', 'Yes — do not add to new-wall quotes']
      ])
    }),
    nv({
      id: 'a8s-n',
      name: 'NovaStar A8s-N',
      model: 'A8s-N',
      family: 'Armor',
      subtype: 'receiving-card',
      replacementOnly: true,
      badge: 'Replacement only — included with new cabinets',
      maxPixels: 196608,
      outputs: 'Cabinet hub (spare)',
      inputs: 'Gigabit from sender',
      bestFor: 'Spare / field replacement',
      chips: ['512×384', 'Replacement only'],
      description: 'Armor receiving card for spares and field swaps. Not used in new-wall bundles or the calculator.',
      features: [
        { title: 'Replacement only', text: 'New Spectrum walls ship with receiving cards installed. Order these only if you need a spare or a field replacement.' },
        { title: 'Published load', text: 'Typical Armor load 512×384 pixels per card.' }
      ],
      specTable: spec([
        ['Family', 'Armor receiving card'],
        ['Use', 'Replacement / spare only'],
        ['Typical load', '512×384 px'],
        ['Included with new cabinets', 'Yes — do not add to new-wall quotes']
      ])
    }),
    nv({
      id: 'a10s-pro',
      name: 'NovaStar A10s Pro',
      model: 'A10s Pro',
      family: 'Armor',
      subtype: 'receiving-card',
      replacementOnly: true,
      badge: 'Replacement only — included with new cabinets',
      maxPixels: 262144,
      outputs: 'Cabinet hub (spare)',
      inputs: 'Gigabit from sender',
      bestFor: 'Spare / field replacement',
      chips: ['512×512', 'Replacement only'],
      description: 'Higher-load Armor receiving card, sold as a spare. New cabinets already include a receiver in the $/m² price.',
      features: [
        { title: 'Replacement only', text: 'Do not estimate card quantity from cabinet count. This SKU is a spare, not a line item on a new wall.' },
        { title: 'Published load', text: 'Typical Armor load 512×512 pixels per card.' }
      ],
      specTable: spec([
        ['Family', 'Armor receiving card'],
        ['Use', 'Replacement / spare only'],
        ['Typical load', '512×512 px'],
        ['Included with new cabinets', 'Yes — do not add to new-wall quotes']
      ])
    }),
    nv({
      id: 'mrv208-n',
      name: 'NovaStar MRV208-N',
      model: 'MRV208-N',
      family: 'MRV',
      subtype: 'receiving-card',
      replacementOnly: true,
      badge: 'Replacement only — included with new cabinets',
      maxPixels: 65536,
      outputs: 'Cabinet hub (spare)',
      inputs: 'Gigabit from sender',
      bestFor: 'Spare / field replacement',
      chips: ['256×256', 'Replacement only'],
      description: 'MRV receiving card for older or smaller cabinets. Replacement and spare stock only.',
      features: [
        { title: 'Replacement only', text: 'New Spectrum walls ship with receiving cards installed. Order MRV208-N only as a spare.' },
        { title: 'Published load', text: 'Typical MRV208 load 256×256 pixels per card.' }
      ],
      specTable: spec([
        ['Family', 'MRV receiving card'],
        ['Use', 'Replacement / spare only'],
        ['Typical load', '256×256 px'],
        ['Included with new cabinets', 'Yes — do not add to new-wall quotes']
      ])
    }),
    nv({
      id: 'mrv412-n',
      name: 'NovaStar MRV412-N',
      model: 'MRV412-N',
      family: 'MRV',
      subtype: 'receiving-card',
      replacementOnly: true,
      badge: 'Replacement only — included with new cabinets',
      maxPixels: 262144,
      outputs: 'Cabinet hub (spare)',
      inputs: 'Gigabit from sender',
      bestFor: 'Spare / field replacement',
      chips: ['512×512', 'Replacement only'],
      description: 'MRV412 receiving card sold as a field spare. Not listed in the calculator or new-wall quotes.',
      features: [
        { title: 'Replacement only', text: 'Cabinet $/m² already includes the receiving card. This SKU is for a spare or a swap.' },
        { title: 'Published load', text: 'Typical MRV412 load 512×512 pixels per card.' }
      ],
      specTable: spec([
        ['Family', 'MRV receiving card'],
        ['Use', 'Replacement / spare only'],
        ['Typical load', '512×512 px'],
        ['Included with new cabinets', 'Yes — do not add to new-wall quotes']
      ])
    }),
    nv({
      id: 'mrv416-n',
      name: 'NovaStar MRV416-N',
      model: 'MRV416-N',
      family: 'MRV',
      subtype: 'receiving-card',
      replacementOnly: true,
      badge: 'Replacement only — included with new cabinets',
      maxPixels: 196608,
      outputs: 'Cabinet hub (spare)',
      inputs: 'Gigabit from sender',
      bestFor: 'Spare / field replacement',
      chips: ['512×384', 'Replacement only'],
      description: 'MRV416 receiving card for spare stock. Hidden from homepage and calculator line items.',
      features: [
        { title: 'Replacement only', text: 'New Spectrum walls ship with receiving cards installed. Order these only if you need a spare or a field replacement.' },
        { title: 'Published load', text: 'Typical MRV416 load 512×384 pixels per card.' }
      ],
      specTable: spec([
        ['Family', 'MRV receiving card'],
        ['Use', 'Replacement / spare only'],
        ['Typical load', '512×384 px'],
        ['Included with new cabinets', 'Yes — do not add to new-wall quotes']
      ])
    })
  ];

  global.SPECTRUM_PRODUCTS = global.SPECTRUM_PRODUCTS || {};
  global.SPECTRUM_PRODUCTS.novastar = {
    name: 'NovaStar',
    tagline: 'Control systems — processors, senders, and spare cards',
    kind: 'control',
    series: series
  };

  function rebuildList() {
    var data = global.SPECTRUM_PRODUCTS || {};
    var list = [];
    Object.keys(data).forEach(function (brandId) {
      var brand = data[brandId];
      (brand.series || []).forEach(function (s) {
        var pitches = s.pitches || [];
        var n = s.type === 'control' ? Number(s.priceEach) || 0 : Number(s.pricePerM2) || 0;
        var priceLabel = (global.SpectrumPricing && SpectrumPricing.fromLabel)
          ? SpectrumPricing.fromLabel(n)
          : (n ? ('From $' + n.toLocaleString()) : 'Request quote');
        list.push(Object.assign({}, s, {
          brandId: brandId,
          brandName: brand.name,
          pitchLabel: pitches.length
            ? pitches[0] + (pitches.length > 1 ? '–' + pitches[pitches.length - 1] : '') + ' mm'
            : (s.type === 'control' ? (s.family || 'Control') : ''),
          priceLabel: priceLabel
        }));
      });
    });
    global.SPECTRUM_PRODUCT_LIST = list;
  }

  rebuildList();
})(typeof window !== 'undefined' ? window : globalThis);
