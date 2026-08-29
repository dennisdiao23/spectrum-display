/**
 * Product-page Support copy (warranty / what you get).
 * Key Features come from the database (`products.details.features` via /api/catalog).
 */
(function (global) {
  function decode(s) {
    return String(s || '')
      .replace(/&amp;/g, '&')
      .replace(/&deg;/g, '°')
      .replace(/&#39;/g, "'")
      .replace(/&bull;/g, '•')
      .replace(/&plusmn;/g, '±')
      .replace(/&times;/g, '×')
      .replace(/&nbsp;/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  function f(title, text) {
    return { title: decode(title), text: decode(text) };
  }

  var FEATURES = {
    discovery: [
      f('Flip-Chip COB Technology', 'Superior surface protection, higher contrast, and better reliability compared with traditional SMD. Excellent performance under close viewing.'),
      f('Front Service Design', 'Modules and power/data can be accessed from the front, simplifying installation and maintenance in wall-mounted applications.'),
      f('High Refresh & HDR Ready', '3840 Hz+ refresh rates for camera-friendly, flicker-free imagery. Supports high dynamic range content for impactful visuals.'),
      f('Seamless 16:9 Panels', 'Optimized 600 × 337.5 mm panels for standard 16:9 and ultra-wide video walls without awkward cropping.')
    ],
    ledposter: [
      f('Digital Poster Format', 'Standalone LED poster for windows, lobbies, and retail aisles — high impact without a full video wall.'),
      f('High Brightness', 'Bright enough for storefront and indoor ambient light so content stays readable during the day.'),
      f('Quick Deployment', 'Poster footprint and simple power/data make it fast to place, relocate, or swap content.'),
      f('Fine Pitch Options', '1.9 mm and 2.5 mm pitches for close viewing in retail and corporate environments.')
    ],
    finepitch: [
      f('Flip-Chip COB', 'Flip-chip COB package for longer life, better heat, and higher brightness than conventional SMD at close viewing.'),
      f('Common-Cathode Energy Saving', 'Common-cathode drive cuts power. Average 100 W/m², max 350 W/m².'),
      f('Protected LED Face', 'Shockproof, anti-collision, moisture-proof, dust-proof, and front IP65 on the LED surface.'),
      f('16:9 Panels', '600 × 337.5 mm panels (or 600 × 675 mm) at 35.5 mm thick and 4 kg — about 40% thinner than a conventional panel.'),
      f('Premium Picture', '800 nits, 14-bit color, 3840 Hz refresh, 15,000:1 contrast, 170° viewing.'),
      f('Eye Comfort', 'Soft light, low blue light, low radiation, quiet, and lower heat for long viewing sessions.')
    ],
    allinone: [
      f('108″ / 135″ / 162″', 'Complete COB conference walls in three sizes, floor-stand or wall-mount.'),
      f('4K Options', 'Real or dynamic 4K depending on pitch. 3840 Hz, 600 nits, 15,000:1 contrast, 175° viewing.'),
      f('Wireless Share', 'Mirror a computer, phone, or tablet — up to four devices at once.'),
      f('Flip-Chip COB', 'Integrated flip-chip COB package with common-cathode energy saving and IP54/IP50 protection.')
    ],
    rentalcob: [
      f('Indoor and Outdoor COB', 'Same 500 × 500 mm rental footprint. Indoor 600 nits / 3840 Hz; outdoor 3500 nits / 7680 Hz.'),
      f('Flip-Chip COB', 'Front IP65 on the LED face, common-cathode energy saving, 73 mm thick.'),
      f('Touring Pitch Set', 'P1.56 / P1.95 / P2.6 for close-view rental stages and outdoor events.')
    ],
    diamond4: [
      f('Indoor and Outdoor Rental', 'Die-cast 500 × 500 and 500 × 1000 mm panels. Mix sizes on one wall.'),
      f('Curve and 90° Corners', 'Outward 0–5°, inward 0–20°, and 90° seamless corners.'),
      f('Light Touring Weight', '6.8 kg (500 × 500 indoor) and about 12–13 kg (500 × 1000). Locating pins let you pull one panel without stripping the wall.'),
      f('High Refresh', '≥ 3840 Hz. Indoor 800–1200 nits; outdoor 4500–5500 nits.')
    ],
    flyingdrone: [
      f('UHD 16:9 Panels', '600 × 337.5 mm die-cast panels at 6 kg for native HD / 4K walls.'),
      f('100% Front Service', 'Modules, HUB, cards, and power from the front — no rear access required.'),
      f('No-Module-Frame Design', 'Hidden cables and a clean face for control rooms, studios, and conference walls.'),
      f('Fine Pitch Set', 'P0.937 IMD through P2.5 SMD, 500–800 nits, ≥ 3840 Hz.')
    ],
    bakoposter: [
      f('45 kg Poster', 'Self-contained aluminum LED poster, indoor or outdoor, easy to move.'),
      f('Four Installs', 'Hang, wall-mount, base-standing, or landscape.'),
      f('Indoor and Outdoor Pitches', 'Indoor P1.75 / P2.0 / P2.5; outdoor P2.5. 160° / 140° viewing.')
    ],
    spaceship: [
      f('IP68 Modules', 'Modules can be immersed. Fully sealed power and data for harsh outdoor weather.'),
      f('High-Temp Frame', 'Die-cast module frames for high UV and temperature. Front or rear service.'),
      f('DOOH Panel Sizes', '960 × 960, 1280 × 960, 900 × 900, and 1200 × 900 mm.'),
      f('Brightness', '4000–7000 nits depending on pitch, from P1.86 through P10.7.')
    ],
    sphere: [
      f('1500 mm Sphere', 'CNC spherical surface with magnetic modules and ≤ 0.3 mm gaps.'),
      f('P3 SMD1515', 'About 111,111 dots/m², ≥ 800 nits, 2880–3840 Hz, 160° viewing.'),
      f('Install Options', 'Floor, hoist, inlaid, or embedded. Front maintenance, IP20.')
    ],
    bks: [
      f('Player Protection', 'Soft rubber sleeve and silicone mask so perimeter hits do not injure players or the wall.'),
      f('Adjustable Tilt', 'Aim the perimeter so every seat can read the screen.'),
      f('P10 Outdoor', '7000 nits, IP65/IP54, 320 × 160 mm modules.')
    ],
    uhdpro: [
      f('640 × 480 Panels', 'Die-cast indoor fixed panels at 8 kg with standard 320 × 160 mm modules.'),
      f('100% Front Service', 'Front install and front maintenance for wall-mount rooms.'),
      f('P1.25–P3.07', '600–800 nits, ≥ 3840 Hz, high contrast for conference and control rooms.')
    ],
    bakocarbon: [
      f('Ultra-Light Carbon', '30–40% lighter than conventional rental. 500 × 500 mm at 5.3 kg; 1000 × 500 mm at 8.3 kg.'),
      f('Fast Touring Hardware', 'Quick lock, automatic ejection, lightweight handle, hang or stack.'),
      f('Service Pins', 'Flexible locating pins let you pull one panel without removing its neighbors.')
    ],
    tpro: [
      f('66% Transmittance', 'See-through rental for glass façades, floors, and windows.'),
      f('1000 × 500 × 65 mm', 'Die-cast panels about 10.5 kg. Indoor 1000 nits; outdoor 4500 nits.'),
      f('IP65 / IP54', 'Outdoor-capable transparent wall with 1920/3840 Hz refresh.')
    ],
    indoor480: [
      f('480 × 480 Panels', 'Die-cast indoor panels with 240 × 240 mm modules and CNC seams.'),
      f('Fanless', 'No fan. Board-to-board hub — no cable transfer inside the panel.'),
      f('Front or Rear Service', '100% front installation, four-corner anti-bump, 3840 Hz.')
    ],
    pro: [
      f('Spectrum Exclusive', 'DIAO Pro is a Spectrum exclusive fixed-install line with strong value for commercial walls.'),
      f('Indoor Fine Pitch', '1.5 / 1.8 / 2.5 mm pitches for meeting rooms, retail, and lobby displays.'),
      f('500 × 500 Panels', 'Standard 500 mm panels keep layout and spare planning simple.'),
      f('Partner Support', 'Sized, quoted, and warranted through Spectrum Display.')
    ],
    value: [
      f('Budget Fixed Install', 'DIAO Value is the Spectrum exclusive option for cost-sensitive commercial walls.'),
      f('Larger Pitches', '2.5 / 3.0 / 4.0 mm for viewing distances typical of outdoor and large commercial spaces.'),
      f('500 × 500 Panels', 'Simple panel grid for fast layout and replacement.'),
      f('Partner Support', 'Quoted and supported through Spectrum Display.')
    ],
    rental: [
      f('Lightweight Rental', 'Element Rental is a Spectrum exclusive touring panel for events and stage work.'),
      f('Fast Build', '2.6 / 2.9 / 3.9 mm pitches with 500 × 500 panels for quick hang and stack.'),
      f('Touring Weight', 'Lower weight per m² than typical fixed panels to speed crew installs.'),
      f('Partner Support', 'Quoted, spares-planned, and warranted through Spectrum Display.')
    ],
    creative: [
      f('Creative / XR Form Factors', 'Element Creative is a Spectrum exclusive line for flexible shapes and XR volumes.'),
      f('Fine Rental Pitches', '1.9 mm and 2.6 mm for close viewing and camera work.'),
      f('500 × 500 Panels', 'Standard rental footprint for mixing with conventional walls.'),
      f('Partner Support', 'Configuration and warranty through Spectrum Display.')
    ],

    af2: [
      f('Multi-Scenario Application', 'Pair with dedicated stands to assemble all-in-one screens and poster displays for meetings, education, and retail.'),
      f('Dual Redundancy for Power & Signal', 'Supports dual redundancy for both power and signal for command centers, monitoring rooms, and studios.'),
      f('Edge-Encapsulation Design', 'By removing the top locating pins, panels on all four sides can be encapsulated — combining aesthetic appeal with protection.'),
      f('MIP & Flip-Chip COB (Optional)', 'Refined light-emitting units for ultra-high contrast, detailed imagery, and pure color. Reduces moiré and provides a non-reflective viewing experience.'),
      f('16:9 Panels', '600 × 337.5 mm 16:9 panels with HD image quality, quick installation, and energy-saving design.')
    ],
    arpro: [
      f('GOB Process', 'Indoor pitches down to 1.9 mm with GOB protection against impact, moisture, dust, and pressure to extend service life.'),
      f('Interactive Sensing (Optional)', 'Each module can include four sensor points for human-screen interaction at exhibitions and commercial tours.'),
      f('Dual-Purpose Screen', 'Use as a floor screen or a conventional background screen. Integrated installation without complex modifications.'),
      f('Outdoor High Protection', 'Outdoor rating Front IP65 / Rear IP65 for water and dust resistance in humid environments.'),
      f('XR-Ready Performance', 'Low-gray processing for uniform color. Supports 7680 Hz refresh for smooth motion — suitable as an XR virtual production screen.')
    ],
    aw: [
      f('16:9 Aspect Ratio', 'Easy layouts for 1080P, 2K, 4K, and 8K walls.'),
      f('High Grey Scale', 'High grey scale and ultra-wide viewing angle for indoor fine-pitch viewing.'),
      f('Energy Saving', 'Energy-saving playback with an environment-friendly design.'),
      f('Full Front Access', 'Wall-mounted design with full front access for fast panel installation.'),
      f('Ultra-Light HDR', 'HDR, high refresh, and ultra-light 16:9 panels for fixed indoor installs.')
    ],
    blade: [
      f('The Ultimate Visual Experience', 'Better contrast, wider color gamut, larger viewing angle, higher refresh and grayscale, and consistent ink color for indoor HD applications.'),
      f('Anti-Bump Protection', 'Anti-bump design plus optional GOB to protect lamp beads during transport and installation.'),
      f('Smooth Visuals', 'Higher panel flatness for seamless, HD indoor viewing.'),
      f('Cost-Effective Structure', 'Simple structure with high cost performance for indoor fixed projects.'),
      f('Clean Appearance', 'No external wires. Simple, clean look for elegant indoor installations.')
    ],
    carbon: [
      f('High Gray Scale', 'Rich color layers and smooth brightness transitions for a more realistic image.'),
      f('Super Lightweight', 'Carbon-fiber rental panels built for fast installation and touring weight.'),
      f('90° Splicing', 'Right-angle splicing for cubes, columns, and creative stage shapes.'),
      f('Curving Capability', 'Curved configurations for concave and convex stage looks.'),
      f('Fast Rear Maintenance', 'Rear service access for touring crews.')
    ],
    cbmax: [
      f('Hanging & Stacking', 'Max hanging height up to 15 meters; with wind-bracing frame up to 20 meters.'),
      f('Mix Splicing', 'Mix-splice with CB II Series panels for flexible combinations and seamless integration.'),
      f('Integrated Wind-Bracing', 'Integrated wind-bracing system for outdoor structural stability.'),
      f('High Transparency', 'Transparent outdoor LED with an ultra-light panel for events and festivals.')
    ],
    cfpro: [
      f('Dual Flexible Module', '500 × 250 mm modules with fewer seams, a flatter surface, and smoother connections.'),
      f('Smooth Curvature Adjustment', 'Optimized angle-lock switch and comfort-grip rotation for quick, precise curve adjustments.'),
      f('Cylindrical Shape', 'Single panel max curve ±45°. A cylinder can be built with 8 panels; minimum outside diameter is 1.273 m.'),
      f('Superior Performance', 'Stable image quality during long operating hours for rental and creative stages.'),
      f('Easy Maintenance', 'Rear-screw module service with a 500 × 500 × 108 mm panel.')
    ],
    cfpro2: [
      f('Creative Stages', 'Seamless combination with indoor DN, DN-B, MV Pro, MV Ultra, CB-S, and CB-S II for versatile stage setups.'),
      f('Wide Viewing Angle', 'H: 160°, V: 140° with no shadows. Ultra HD, vivid colors, and detailed reproduction.'),
      f('Patent Moving Mechanism', 'Module positioning pins adjust on demand for a clean shooting surface. Dual flexible modules minimize gaps and keep color/brightness uniform. Single-person operation.'),
      f('Integrated Power Box', 'Power supply, receiving card, and HUB in one box for fast maintenance.'),
      f('Indoor & Outdoor Flexible LED', 'Indoor and outdoor flexible LED. Single panel max curve ±45° / 90° optional; cylinder with 8 panels, 1.273 m minimum outside diameter.')
    ],
    crmax: [
      f('Convenient Maintenance', 'Modules are fixed by magnets and screws for both front and rear service.'),
      f('All-in-One Rear Cover', 'Integrated rear cover with rotary-knob fixation for tool-free assembly and removal.'),
      f('Curved Splicing', 'Adjustable curve: -10° / -7.5° / -5° / -2.5° / 0° / 2.5° / 5° / 7.5° / 10°.'),
      f('Hanging & Stacking', 'Up to 10 meters hang/stack; up to 20 meters with the integrated wind-bracing system.'),
      f('Dolly System', 'Professional dolly carts carry 12 panels each; two dollies stack for outdoor transport.'),
      f('Lightweight Design', 'Die-cast aluminum and carbon fiber for portability and structural strength.'),
      f('Mix Transparent & Solid', 'Mix-splice transparent and solid LED panels for flexible outdoor looks.')
    ],
    cs2: [
      f('Triangle Panel Splicing', 'Triangle panels assemble into boats, Christmas trees, pinwheels, and other creative shapes.'),
      f('Sector Panel Splicing', 'Sector panels assemble into hearts, semi-circles, and full circles.'),
      f('Panel Compatibility', 'Seamless splicing with multiple Gloshine series so creative shapes reuse standard inventory.'),
      f('Waterproof Modular Design', 'Triangle creative screen with waterproof, 4K-capable modular panels.')
    ],
    dn: [
      f('Multiple Panels', 'Straight, curved, and 45° beveled panels in one series.'),
      f('Dual Top Locks', 'Dual top locks for quicker, more secure installation.'),
      f('Anti-Collision (Optional)', 'Corner guards protect lamp beads from collision damage.'),
      f('Curved Shape', 'DN and DN Plus splice for curves with easy radian adjustment.'),
      f('Magnetic Modules', 'Magnetic modules, tool-free maintenance, 90° splicing, and IP65 outdoor protection.'),
      f('10 m Hang / Stack', 'Maximum stacking and hanging height of 10 meters.')
    ],
    dnin: [
      f('Multiple Panels', 'Straight, curved, and 45° beveled panels in one series.'),
      f('Curved Shape', 'DN and DN Plus splice for curves with easy radian adjustment.'),
      f('Vertical + Flexible Splicing', 'Vertical plus curved splicing with flexible screens for creative indoor/outdoor shapes.'),
      f('Quick Installation', 'Maximum stacking / hanging height of 10 meters.'),
      f('Magnetic Modules', 'Ultra-wide viewing angle, magnetic modules, 90° splicing, and IP65 protection.')
    ],
    gposterplus: [
      f('Extremely Light & Slim', 'Ultra-slim 83-inch and 70-inch sizes with 43 mm panel thickness for commercial spaces.'),
      f('Multiple Playback Modes', 'Synchronous, LAN, USB, asynchronous, and cluster cloud playback.'),
      f('Intelligent Cluster Control', 'Remote wireless interaction, monitoring, timed power on/off, and centralized management.'),
      f('Multiple Splicing Options', 'Standard, multi-unit, and creative splicing.'),
      f('Seat Mounting (Standard)', 'Fuma caster base for flexible mobility and fast deployment.'),
      f('Hanging (Optional)', 'For high-ceiling spaces such as cinemas, theaters, and stadiums.'),
      f('Wall Mounting (Optional)', 'Flush wall install, as thin as a painting, for a premium visual with saved floor space.')
    ],
    gposter: [
      f('Damped Flip Frame', 'Built-in shock absorption for smooth, slow frame rotation that protects the structure and keeps layout changes quiet.'),
      f('Multi-Screen Splicing (Optional)', 'Seamless splicing of up to 6 units with HDR for exhibitions — video, charts, and HD images.'),
      f('Shared Backup Power', 'Optional power balancing between panels. If one supply fails, the other supports both units.'),
      f('Intelligent Cluster Control', 'Remote wireless interaction, monitoring, timed power on/off, and centralized management.'),
      f('Dual-Sided Foldable Design', 'Dual-sided display with a foldable panel for easier transport and maintenance.')
    ],
    gp: [
      f('Delicate Picture Quality', 'High grayscale, high contrast, and a large viewing angle for vivid outdoor images.'),
      f('Fireproof Aluminum Module', 'All-aluminum die-cast module that is fireproof and flame-retardant.'),
      f('Concealed Waterproof Cables', 'IP66 front and rear. Fully sealed against dust, rain, and snow — direct outdoor exposure without an extra enclosure.'),
      f('Front-Rear Service', 'Front and rear service. Fast-lock modules for quicker install and dismantle.')
    ],
    legend: [
      f('Convex & Concave Curves', 'LE Series offers convex and concave curving for flexible event layouts.'),
      f('Wide Viewing Angle', 'H: 160°, V: 140°, shadowless full-frame visibility on stage.'),
      f('Wind-Bracing Frame (Optional)', 'Optional wind-bracing makes stacking easier and adds wind resistance for festival hangs.'),
      f('Dolly System (Optional)', 'Transport dolly package: 2 × 6 panels per dolly to speed stage LED logistics.')
    ],
    mr: [
      f('Splice with LE Series', 'Interconnect and splice with the Legend (LE) series.'),
      f('Splice with DN Series', 'Interconnect and splice with the DN series.'),
      f('360° Immersive Shooting', 'Interconnect with CF Pro and MV Pro to create a 360° immersive shooting environment.'),
      f('90° Curved Corner', '90° curved-corner panels with HD image and IP65 protection.')
    ],
    mtedge: [
      f('Works with MT Series', 'Pair with MT series to create creative booths, inner arcs, and outer arcs.'),
      f('BeMatrix Frame', 'Works with a BeMatrix frame on the back for exhibition builds.'),
      f('Vertical Installation', 'Maximum vertical height 5 meters.'),
      f('Hanging', 'Maximum lifting height 5 meters.'),
      f('Flexible Curve', 'Flexible module with curved lock. P1.9 / 2.3 / 2.8 max curve ±80° per panel; a cylinder from as few as 5 panels.')
    ],
    mt2: [
      f('Quick Installation', 'Two fast latches on the top and two on the panel side for easy, fast installation.'),
      f('Display Rack Match', 'Fits a standard display rack. Wiring can run inside the rack. Rear can be covered with SEG fabric.'),
      f('Creative Shapes', 'Optional 45° tiles for right-angle and cubic-column splicing.'),
      f('Work with MT Edge', 'MT II + MT Edge for “L” and “U” shapes and other creative booth designs.')
    ],
    mt55: [
      f('Customizable Back Panel', 'Custom back-cover hides panel cables. Choose material, color, and pattern to match the booth design.'),
      f('Convenient Maintenance', 'Front and rear service for module, power supply, and HUB. Integrated back-cover knob for easy removal.'),
      f('Brompton Compatible', 'Compatible with Nova and Colorlight, and supports Brompton for wider brightness/color range and more efficient tuning.'),
      f('90° Splicing', 'High-precision 496 mm panels with 90° splicing and 4K-capable layouts.'),
      f('Magnetic Modules', 'Magnetic modules for fast installation; corner panels supported.')
    ],
    mvpro: [
      f('Anti-Collision (Optional)', 'Four-corner anti-collision structure with integrated button and guard plate to reduce damage during frequent production setups.'),
      f('LED Quality for Virtual Production', 'Deep black LEDs for wide color-gamut reproduction meeting the DCI-P3 film color standard.'),
      f('HDR Display Technology', 'Enhanced brightness and contrast that reproduce fine image detail for XR LED workflows.'),
      f('High Gray Scale', 'High-precision color and contrast for cinematic HDR shooting and ICVFX walls.'),
      f('High Frame Rate', 'Handles 120 Hz and beyond for fast-action virtual production.'),
      f('High Refresh Architecture', 'Advanced driver ICs minimize flicker under professional shooting conditions.'),
      f('XR Studio Combinations', 'Standard XR setup: MV Pro + CF Pro for compact through large virtual production environments. Pitches 1.2 / 1.5 / 1.9 / 2.3 / 2.6 / 2.9 mm.')
    ],
    mvultra: [
      f('Novastar 5G & Brompton (Optional)', 'High-speed, low-latency transmission with millisecond-level control and 8K-class display for high-end rental.'),
      f('Splice with Multiple Series', 'Combine with CF Pro, CF Pro II flexible LED, and DN-B HD LED for rapid installs and versatile shapes.'),
      f('Vertical Splicing', 'Detachable 45° beveled frames support flat, curved, right-angle, cubic column, and cube splicing from one panel type.'),
      f('Curved Splicing', 'Optional curved panels: -10° / -7.5° / -5° / -2.5° / 0° / 2.5° / 5° / 7.5° / 10°.'),
      f('Integrated Rear Cover', 'Integrated rear cover with rotary-knob fixation for tool-free maintenance.'),
      f('Anti-Collision Corners (Optional)', 'Optional protection corners protect corner LEDs from collision damage during transport.'),
      f('7680 Hz Refresh', '5G solutions, 7680 Hz high refresh, curving, and vertical splicing for premium indoor rental.')
    ],
    ra2: [
      f('40 mm Profile Compatible', 'Fits 40 × 40 mm aluminum profiles for rapid assembly and disassembly at exhibitions and temporary sites.'),
      f('Stacking with Angle Steel', 'Profile stacking using interior angle steel.'),
      f('Customizable Backplate', 'Custom backplates conceal panel cables and keep a unified visual style.'),
      f('Lightweight Fixed / Ceiling', 'Lightweight 4K-capable panels with optional GOB; hang as a ceiling screen or use as fixed install.')
    ],
    rbb: [
      f('Multiple Panels', 'Multiple panel options for complex creative shapes.'),
      f('Cubic / Vertical Splicing', 'RB-B supports four-sided cutting edge. RB PLUS-B supports two-side (left and right) cutting edge.'),
      f('Curved Screen', 'Curve splicing with easy radian adjustment and efficient installation.'),
      f('90° Corner with MR', 'Splice with MR Series 90° corner fillets for a seamless round-corner look.'),
      f('Flexible Screen Splicing', 'Indoor RB-B splices with flexible screens for versatile creative designs.')
    ],
    ur: [
      f('Superior Color Performance', 'High contrast ratio and strong color performance for rental stages.'),
      f('Concave & Convex Splicing', 'Support concave and convex splicing from 0° to ±10°.'),
      f('Wide Viewing Angle', 'Horizontal 160°, vertical 140°, shadowless full-frame.'),
      f('Hanging Height', 'Maximum hanging height 20 m with touring frame, 10 m standard.'),
      f('Full Waterproof', 'Ultra-light, high-stability, fully waterproof panels with easy maintenance.')
    ],
    vamax: [
      f('Magnetic Module Maintenance', 'Magnetic modules allow front and rear service. Modular design cuts repair time.'),
      f('Hanging Installation', 'Max hanging height 20 m.'),
      f('Stacking Installation', 'Stacking height 20 m with foldable touring frame; 12 m without.'),
      f('Efficient Dolly System', 'Dolly carts carry 12 panels each and stack for outdoor transport.'),
      f('Ultra-High Transparency', 'About 5200 nits with 14–16 bit grayscale and 3840–7680 Hz refresh for large outdoor concerts.')
    ],
    vanish: [
      f('High Transparency Design', 'Contrast up to 6000:1 and over 35% transparency for creative see-through displays with clear, vivid visuals.'),
      f('Integrated Power Box', 'Power box replacement and maintenance stay quick so the transparent wall stays in service.'),
      f('Ultra Light Weight', '500 × 1000 mm panel at 8.0 kg. Special module design for durability, transport, and fast install.'),
      f('Curving Capabilities', 'Concave or convex configuration for creative projects. Also supports 90° splicing.')
    ],
    zs3: [
      f('Arc-Adjustable Tensioning', 'Two arc-adjustable tensioning mechanisms make assembly more stable and convenient.'),
      f('±10° Arc Modules', 'Supports ±10° arc-shaped module splicing for curved walls.'),
      f('90° Splicing', 'Supports 90° splicing for corners and creative shapes.'),
      f('Front IP65 / Rear IP54', 'Outdoor-capable protection with quick installation.')
    ],
    zspro: [
      f('Curved Splicing', 'ZS Pro II supports curved splicing at -10° / -5° / 0° / 5° / 10°.'),
      f('High Wind Resistance', 'Optional integrated wind-bracing for screen fixation and force dispersion. Stack and hang up to 20 meters.'),
      f('90° Splicing', 'Right-angle splicing for corners and columns.'),
      f('Excellent Display Performance', 'Black LEDs for high brightness, high contrast, rich color, and HD detail. 7680 Hz refresh for smooth motion.'),
      f('Tool-Free Magnetic Maintenance', 'Optional magnetic modules for fast front service. Rotary-knob dual securement helps prevent misalignment in transport.')
    ]
  };

  var BRAND_FEATURES = {
    trt: FEATURES.discovery,
    bako: FEATURES.finepitch,
    diao: FEATURES.pro,
    element: FEATURES.rental
  };

  function spectrumListHtml() {
    return (
      '<ul class="text-sm text-slate-400 space-y-2 list-disc list-inside">' +
        '<li>Authorized genuine product</li>' +
        '<li>Configuration assistance and system design</li>' +
        '<li>Shipping coordination from US inventory or factory</li>' +
        '<li>First-line North American support and RMA coordination</li>' +
        '<li>Technical resources for drawings, load data, and processors</li>' +
      '</ul>'
    );
  }

  var WARRANTY =
    'All LED displays sold by Spectrum Display include the full manufacturer warranty plus Spectrum’s 3-year support layer from date of shipment. Manufacturer coverage follows the factory terms for the series on your order (typically 2–5 years). Coverage is limited to the original purchaser. Rental and touring use excludes physical damage from transport or handling. See the Limited Warranty Policy for what is covered and how to file a claim.';

  var SUPPORT = {
    gloshine: {
      warrantyTitle: 'Limited Warranty',
      warranty: WARRANTY,
      extraTitle: 'Certifications & factory specs',
      extra:
        'Gloshine publishes CE, ETL, FCC, UL, and RoHS marks for its LED products. Confirm the exact certifications and datasheet for the pitch and panel you order. Official series specifications are linked from this page.'
    },
    trt: {
      warrantyTitle: 'Limited Warranty',
      warranty: WARRANTY,
      extraTitle: 'What you get with Spectrum',
      extra: ''
    },
    bako: {
      warrantyTitle: 'Limited Warranty',
      warranty: WARRANTY,
      extraTitle: 'Factory specs',
      extra: 'BAKO publishes CCC, TUV (CE), and FCC marks on COB fine-pitch series. Confirm the exact datasheet for the pitch and panel you order. Official series pages are linked from this product.'
    },
    diao: {
      warrantyTitle: 'Limited Warranty',
      warranty: WARRANTY,
      extraTitle: 'What you get with Spectrum',
      extra: ''
    },
    novastar: {
      warrantyTitle: 'Control gear warranty',
      warranty: 'Warranty coverage for NovaStar processors, senders, playback boxes, and spare receiving cards is quoted by Spectrum sales for the model on your order. We do not publish a generic control-gear term here. Email sales@spectrumdisplay.com with the model and serial if you need a warranty statement.',
      extraTitle: 'Receiving cards on new walls',
      extra: 'New Spectrum LED walls ship with receiving cards installed in each panel. The panel $/m² price already includes that card. Order receiving cards from this catalog only as replacements or spares.'
    }
  };

  function getFeatures(brandId, seriesId, series) {
    var fromSeries = series && series.features;
    if (Array.isArray(fromSeries) && fromSeries.length) return fromSeries;
    return [];
  }

  function getSupport(brandId) {
    return SUPPORT[brandId] || {
      warrantyTitle: 'Limited Warranty',
      warranty: WARRANTY,
      extraTitle: 'What you get with Spectrum',
      extra: ''
    };
  }

  global.SPECTRUM_PRODUCT_COPY = {
    features: FEATURES,
    support: SUPPORT
  };
  global.getSpectrumProductFeatures = getFeatures;
  global.getSpectrumProductSupport = getSupport;
  global.getSpectrumSupportListHtml = spectrumListHtml;
})(window);
