/**
 * UNUSED on public pages. Panel catalog is the admin database via /api/catalog.
 * Do not include this file in HTML. Server seed is server/seed-catalog.json.
 * Extra copy (cats, specs, features) is server/product-details.json → products.details.
 */
window.SPECTRUM_PRODUCTS = {
  trt: {
    name: 'TRT',
    tagline: 'Energy-efficient fine pitch & outdoor',
    series: [
      {
        id: 'discovery',
        name: 'Discovery Series',
        pitches: [0.93, 1.25, 1.56, 1.87, 2.5],
        pricePerM2: 7000,
        weightPerM2: 28,
        powerAvg: 160,
        powerMax: 400,
        cabinetW: 0.600,
        cabinetH: 0.3375,
        type: 'Fixed',
        description: 'Fine pitch COB for retail, corporate lobbies, and control rooms.',
        badge: null,
        cats: ['cob', 'indoor', 'popular', 'micro-led'],
        image: 'assets/products/discovery.jpg'
      },
      {
        id: 'ledposter',
        name: 'LedPoster',
        pitches: [1.9, 2.5],
        pricePerM2: 1650,
        weightPerM2: 32,
        powerAvg: 180,
        powerMax: 450,
        cabinetW: 0.500,
        cabinetH: 0.500,
        type: 'Poster',
        description: 'Digital poster and window displays with high brightness.',
        badge: null,
        cats: ['indoor', 'popular', 'micro-led'],
        image: 'assets/products/ledposter.jpg'
      }
    ]
  },
  gloshine: {
    name: 'Gloshine',
    tagline: 'Rental, transparent, creative & outdoor',
    series: [
      {
        id: "mvultra",
        name: "MV Ultra",
        pitches: [
          1.5,
          1.9,
          2.6,
          2.9
        ],
        pricePerM2: 1450,
        weightPerM2: 34.0,
        powerAvg: 200,
        powerMax: 500,
        cabinetW: 0.5,
        cabinetH: 0.5,
        type: "Rental",
        description: "High-end indoor rental LED. 500×500 mm panels, 3840/7680 Hz refresh, GOB/HOB on fine pitches, ±10° curve, 10 m hang/stack.",
        badge: "Rental",
        cats: [
          "rental",
          "popular"
        ],
        image: "assets/products/gloshine/mvultra-hero.png",
        gallery: [
          "assets/products/gloshine/mvultra-g1.jpg"
        ],
        sourceUrl: "https://gloshine.com/products/mv-ultra-series.html",
        lead: "MV Ultra Series High-End Indoor Rental LED Display,Support Novastar 5G & Brompton Control Solutions,Optional curved panels with adjustable angles: -10°/-7.5°/-5°/-2.5°/0°/2.5°/5°/7.5°/10°.Featuring a wide color gamut, HDR technology, 16-bit grayscale, a high frame rate of 250FPS, a refresh rate of 7680Hz, and an ultra-wide viewing angle of H:160°/V:140°, it delivers a comprehensive and distortion-free visual display solution.",
        specTable: [
          [
            "Model No.",
            "MV Ultra1.5",
            "MV Ultra1.9",
            "MV Ultra1.9",
            "MV Ultra2.6",
            "MV Ultra2.9"
          ],
          [
            "Pixel Pitch",
            "1.5",
            "1.9",
            "1.9",
            "2.6",
            "2.9"
          ],
          [
            "Packaging Technology",
            "GOB/HOB",
            "GOB/HOB",
            "/",
            "/",
            "/"
          ],
          [
            "Panel Dimension",
            "500mm*500mm*76mm",
            "500mm*500mm*76mm",
            "500mm*500mm*76mm",
            "500mm*500mm*76mm",
            "500mm*500mm*76mm"
          ],
          [
            "Scan Rate",
            "1/40 or 1/32 or 1/16",
            "1/32 or 1/16",
            "1/32 or 1/16",
            "1/24",
            "1/21"
          ],
          [
            "Refresh Rate",
            "3840Hz/7680Hz"
          ],
          [
            "Gray Scale",
            "14-16Bit"
          ],
          [
            "Panel Weight",
            "8.5kg±10%"
          ],
          [
            "Panel Material",
            "Die-Casting Panel"
          ],
          [
            "Viewing Angle",
            "H:160°/V:140°"
          ],
          [
            "IP Rating",
            "IP30"
          ],
          [
            "Maintenance",
            "Front/Rear"
          ],
          [
            "Curve",
            "-10°/-7.5°/-5°/-2.5°/0°/2.5°/5°/7.5°/10°"
          ],
          [
            "Max. Stacking/Hanging",
            "10m"
          ]
        ]
      },
      {
        id: "dnin",
        name: "DN Indoor",
        pitches: [
          1.25,
          1.5,
          1.9,
          2.6,
          2.9,
          3.9
        ],
        pricePerM2: 0,
        weightPerM2: 28.8,
        powerAvg: 200,
        powerMax: 500,
        cabinetW: 0.5,
        cabinetH: 0.5,
        type: "Rental",
        description: "Indoor DN rental panels with magnetic front service, dual locks, ±10° curve, and 45° bevel options. 500×500 / 500×1000 mm.",
        badge: "Rental",
        cats: [
          "rental",
          "indoor"
        ],
        image: "assets/products/gloshine/dnin-hero.png",
        gallery: [
          "assets/products/gloshine/dnin-g2.png"
        ],
        sourceUrl: "https://gloshine.com/products/dn-series.html",
        lead: "Perfect for concerts, exhibitions, and broadcasts, our rental LED displays feature magnetic modules and dual-lock panels for fast setup and flexible cube or arc configurations.",
        specTable: [
          [
            "Application Scenario",
            "Indoor"
          ],
          [
            "Model No.",
            "DN1.2",
            "DN1.5",
            "DN1.9",
            "DN1.9",
            "DN/DN Plus2.6",
            "DN/DN Plus2.9",
            "DN/DN Plus3.9"
          ],
          [
            "Pixel Pitch",
            "1.25mm",
            "1.5mm",
            "1.9mm",
            "1.9mm",
            "2.6mm",
            "2.9mm",
            "3.9mm"
          ],
          [
            "LED Type",
            "SMD1010",
            "SMD1212",
            "IMD 2 in 1",
            "SMD1515",
            "SMD1515",
            "SMD2020",
            "SMD2020"
          ],
          [
            "Packaging Technology",
            "GOB/HOB",
            "GOB/HOB",
            "SMD",
            "GOB/HOB",
            "SMD",
            "SMD",
            "SMD"
          ],
          [
            "Panel Dimension",
            "DN:500mm*500mm*76mm",
            "DN:500mm*500mm*76mm",
            "DN:500mm*500mm*76mm",
            "DN:500mm*500mm*76mm",
            "DN Plus: 500mm*1000mm*76mm DN: 500mm*500mm*76mm",
            "DN Plus: 500mm*1000mm*76mm DN: 500mm*500mm*76mm",
            "DN Plus: 500mm*1000mm*76mm DN: 500mm*500mm*76mm"
          ],
          [
            "Panel Weight",
            "DN:7.2kg±10% DN Plus:12.2kg±10% GOB: DN:7.5kg±10% DN Plus:12.7kg±10% Redundant: DN:8kg±10%"
          ],
          [
            "Panel Material",
            "Die-Casting Aluminum"
          ],
          [
            "Curve",
            "Curved panel/45° beveled panel（±10° curved lock）：-10°/-7.5°/-5°/-2.5°/0°/2.5°/5°/7.5°/10° 90° lock or 90° connector plate can do vertical splicing."
          ]
        ]
      },
      {
        id: "dn",
        name: "DN Outdoor",
        pitches: [
          2.6,
          2.97,
          3.91
        ],
        pricePerM2: 1280,
        weightPerM2: 35,
        powerAvg: 280,
        powerMax: 700,
        cabinetW: 0.5,
        cabinetH: 0.5,
        type: "Outdoor",
        description: "Outdoor rental/fixed DN panels with magnetic modules, dual top locks, IP65 front, curve and 90° splicing.",
        badge: null,
        cats: [
          "outdoor"
        ],
        image: "assets/products/gloshine/dnout-hero.png",
        gallery: [
          "assets/products/gloshine/dnout-g1.png",
          "assets/products/gloshine/dnout-g2.png",
          "assets/products/gloshine/dnout-g3.png"
        ],
        sourceUrl: "https://gloshine.com/products/dn-series-outdoor.html",
        lead: "DN Series-Ultra-Thin Creative Display,Ultra Thin & Lightweight Panel ;Classical Industrial-style Design Quick Installation & Maintenance;Multiple Shapes, available splicing for Vertical Angle/Cube/Curve etc.",
        specTable: [
          [
            "Model No.",
            "DN/DN Plus2.6",
            "DN/DN Plus2.9",
            "DN/DN Plus3.9",
            "DN/DN Plus3.9"
          ],
          [
            "Pixel Pitch",
            "2.6mm",
            "2.9mm",
            "3.9mm",
            "3.9mm"
          ],
          [
            "Packaging Technology",
            "SMD",
            "SMD",
            "SMD",
            "SMD"
          ],
          [
            "Panel Dimension",
            "DN Plus :500mm*1000mm*76mm DN:500mm*500mm*76mm",
            "DN Plus :500mm*1000mm*76mm DN:500mm*500mm*76mm",
            "DN Plus :500mm*1000mm*76mm DN:500mm*500mm*76mm",
            "DN Plus :500mm*1000mm*76mm DN:500mm*500mm*76mm"
          ],
          [
            "Scan Rate",
            "1/24 or 1/16",
            "1/21 or 1/14",
            "1/8",
            "1/16"
          ],
          [
            "Refresh Rate",
            "3840Hz/7680Hz"
          ],
          [
            "Panel Weight",
            "DN: 7.2kg±10% DN Plus: 12.5kg±10%"
          ],
          [
            "Panel Material",
            "Die-Casting Aluminum"
          ],
          [
            "Viewing Angle",
            "H:160°/V:140°"
          ],
          [
            "IP Rating",
            "Front IP65, Rear IP54"
          ],
          [
            "Maintenance",
            "Rear"
          ],
          [
            "Curve",
            "Curved panel/45° beveled panel（±10° curved lock）：-10°/-7.5°/-5°/-2.5°/0°/2.5°/5°/7.5°/10° 90° lock or 90° connector plate can do vertical splicing."
          ]
        ]
      },
      {
        id: "vanish",
        name: "Vanish Transparent",
        pitches: [
          3.91,
          7.81,
          8.93
        ],
        pricePerM2: 0,
        weightPerM2: 20.4,
        powerAvg: 250,
        powerMax: 600,
        cabinetW: 0.5,
        cabinetH: 0.5,
        type: "Transparent",
        description: "Outdoor transparent LED with ≥35% transparency, IP65 panels, ultra-light panels, concave/convex and 90° setups.",
        badge: "Transparent",
        cats: [
          "outdoor",
          "rental"
        ],
        image: "assets/products/gloshine/vanish-hero.png",
        gallery: [
          "assets/products/gloshine/vanish-g1.png",
          "assets/products/gloshine/vanish-g2.png",
          "assets/products/gloshine/vanish-g3.png"
        ],
        sourceUrl: "https://gloshine.com/products/vanish.html",
        lead: "Transparent LED screen features over 70% transparency and a 6000:1 contrast ratio, delivering stunning visuals while maintaining a clear see-through effect. Lightweight, durable, and quick to install.",
        specTable: [
          [
            "Model No.",
            "VA3.91-7.81",
            "VA8.93"
          ],
          [
            "Pixel Pitch",
            "3.91-7.81mm",
            "8.93-8.93mm"
          ],
          [
            "LED Type",
            "SMD1921",
            "SMD1921"
          ],
          [
            "Pixel Density",
            "32768 pixel/㎡",
            "12544 pixel/㎡"
          ],
          [
            "Panel Resolution",
            "256*64 pixel",
            "112*56 pixel"
          ],
          [
            "128*64 pixel",
            "56*56 pixel"
          ],
          [
            "Scan Rate",
            "1/16 or 1/8",
            "1/4"
          ],
          [
            "Panel Dimension",
            "VA mini:500mm*500mm*78mm VA:1000mm*500mm*78mm"
          ],
          [
            "Panel Weight",
            "VA mini:5.1kg±10% VA:8.0kg±10%"
          ],
          [
            "Panel Material",
            "Die casting Aluminium"
          ]
        ]
      },
      {
        id: "vamax",
        name: "VA MAX",
        pitches: [
          3.91,
          7.81,
          5.95
        ],
        pricePerM2: 0,
        weightPerM2: 26.0,
        powerAvg: 280,
        powerMax: 700,
        cabinetW: 1.0,
        cabinetH: 1.0,
        type: "Outdoor",
        description: "High-end outdoor large-scale rental. 1000×1000 mm panels with touring frame; solid and transparent-hybrid modules.",
        badge: "Rental",
        cats: [
          "outdoor",
          "rental"
        ],
        image: "assets/products/gloshine/vamax-hero.png",
        gallery: [
          "assets/products/gloshine/vamax-g1.png"
        ],
        sourceUrl: "https://gloshine.com/products/va-max.html",
        lead: "The VA MAX Series, which has won the Red Dot Award, is a high-performance display product specifically designed for outdoor touring scenes in Europe and the United States. It is renowned for its extreme load-bearing capacity and superior stability. The VA MAX Series features an integrated die-cast aluminum panel frame, with a total unit weight of 22 kilograms. The structure is robust and durable. Equipped with a foldable wind-resistant frame, it can withstand winds of Force 8 or above and endure tension and pressure of up to 3.5 tons.",
        specTable: [
          [
            "Model No.",
            "VA MAX3.91(Outdoor)",
            "VA MAX3.91-7.81(Outdoor)",
            "VA MAX5.95(Outdoor)"
          ],
          [
            "Pixel Pitch",
            "3.91mm",
            "3.91-7.81mm",
            "5.95mm"
          ],
          [
            "LED Type",
            "SMD1921",
            "SMD1921",
            "SMD1921"
          ],
          [
            "Transparent Rate",
            "/",
            "Around30%",
            "/"
          ],
          [
            "Scan Rate",
            "1/16 or 1/8",
            "1/16 or 1/8",
            "1/7"
          ],
          [
            "Panel Dimension",
            "Large Panel:1000mm*1000mm*100mm (39.4\"*39.4\"*3.94\") Small Panel:1000mm*500mm*100mm（39.4\"*19.7\"*3.94\")"
          ],
          [
            "Panel Weight",
            "Large Panel:26kg±10% Small Panel:15kg±10%",
            "Large Panel:22kg±10% Small Panel:14kg±10%",
            "Large Panel:26kg±10% Small Panel:15kg±10%"
          ]
        ]
      },
      {
        id: "cbmax",
        name: "CB MAX",
        pitches: [
          3.9,
          4.8,
          5.9,
          6.9,
          8.9
        ],
        pricePerM2: 0,
        weightPerM2: 11.5,
        powerAvg: 280,
        powerMax: 700,
        cabinetW: 1.0,
        cabinetH: 1.0,
        type: "Outdoor",
        description: "Lightweight outdoor rental. 1000×1000 mm magnesium + carbon fiber panels, IP65 front, 3840/7680 Hz.",
        badge: "Rental",
        cats: [
          "outdoor",
          "rental"
        ],
        image: "assets/products/gloshine/cbmax-hero.png",
        gallery: [
          "assets/products/gloshine/cbmax-g1.jpg"
        ],
        sourceUrl: "https://gloshine.com/products/cb-max-series.html",
        lead: "The CB MAX series features an integrated square-tube design of die-cast magnesium and carbon fiber, combining lightweight construction with high stability. It is 30% lighter than conventional products, with the CB MAX series weighing 11.5 kg.",
        specTable: [
          [
            "CB MAX (Outdoor)"
          ],
          [
            "Model No.",
            "CB MAX3.9-7.8",
            "CB MAX3.9",
            "CB MAX4.8",
            "CB MAX8.9"
          ],
          [
            "Pixel Pitch",
            "3.9-7.8",
            "3.9",
            "4.8",
            "8.9"
          ],
          [
            "Panel Dimension",
            "1000mm*1000mm*74.5mm",
            "1000mm*1000mm*74.5mm",
            "1000mm*1000mm*74.5mm",
            "1000mm*1000mm*74.5mm"
          ],
          [
            "Scan Rate",
            "1/16 or 1/8",
            "1/16",
            "1/13",
            "1/4"
          ],
          [
            "Refresh Rate",
            "3840Hz/7680Hz"
          ],
          [
            "Panel Weight",
            "11.5kg±10%",
            "15.5kg±10%",
            "15.5kg±10%",
            "13.5kg±10%"
          ],
          [
            "Panel Material",
            "Die-Casting Magnesium+Carbon Fiber"
          ],
          [
            "IP Rating",
            "Front IP65/Rear IP54"
          ]
        ]
      },
      {
        id: "crmax",
        name: "CR MAX",
        pitches: [
          3.9,
          7.8
        ],
        pricePerM2: 0,
        weightPerM2: 17.5,
        powerAvg: 280,
        powerMax: 700,
        cabinetW: 1.0,
        cabinetH: 1.0,
        type: "Outdoor",
        description: "Outdoor carbon-fiber rental panel with wind-bracing option, ±10° curve, IP65 front / IP54 rear.",
        badge: "Rental",
        cats: [
          "outdoor",
          "rental"
        ],
        image: "assets/products/gloshine/crmax-hero.png",
        gallery: [
          "assets/products/gloshine/crmax-g1.jpg"
        ],
        sourceUrl: "https://gloshine.com/products/cr-max-series.html",
        lead: "CR MAX Series Outdoor Super Lightweight Carbon Fiber Transparent LED Display,The large size 1m x 1m panel features a die-casting aluminum&carbon fiber panel frame, balancing product strength with weight reduction. The panel weighs only 16.5kg without the wind-bracing frame, significantly reducing structural load requirements for on-site setup. One person can complete installation quickly.",
        specTable: [
          [
            "Model No.",
            "CR MAX3.9-7.8"
          ],
          [
            "Pixel Pitch",
            "3.9-7.8"
          ],
          [
            "LED Type",
            "SMD1921"
          ],
          [
            "Pixel Density",
            "32768/㎡"
          ],
          [
            "Panel Dimension",
            "1000mm*1000mm*105mm"
          ],
          [
            "Refresh Rate",
            "3840Hz/7680Hz"
          ],
          [
            "Gray Scale",
            "14-16Bit"
          ],
          [
            "Panel Weight",
            "With Wind-Bracing System 17.5kg±10% / Without Wind-Bracing System 20kg±10％"
          ],
          [
            "Panel Material",
            "Die-Casting Aluminum+Carbon Fiber"
          ],
          [
            "Viewing Angle",
            "H:160°/V:140°"
          ],
          [
            "IP Rating",
            "Front IP65/Rear IP54"
          ],
          [
            "Curve",
            "-10°/-7.5°/-5°/-2.5°/0°/2.5°/5°/7.5°/10°"
          ],
          [
            "Max Stacking/Hanging",
            "Without Wind-Bracing System 10m / With Wind-Bracing System 20m"
          ]
        ]
      },
      {
        id: "af2",
        name: "AF II Fine Pitch",
        pitches: [
          0.62,
          0.78,
          0.94,
          1.25,
          1.56,
          1.87
        ],
        pricePerM2: 0,
        weightPerM2: 27.2,
        powerAvg: 120,
        powerMax: 300,
        cabinetW: 0.6,
        cabinetH: 0.3375,
        type: "Fixed",
        description: "16:9 fine-pitch 600×337.5 mm panels, 5.5 kg, MIP / flip-chip COB / SMD options from 0.625–1.875 mm.",
        badge: "COB",
        cats: [
          "cob",
          "indoor",
          "popular"
        ],
        image: "assets/products/gloshine/af2-hero.png",
        gallery: [
          "assets/products/gloshine/af2-g1.jpg"
        ],
        sourceUrl: "https://gloshine.com/products/af-ii-series.html",
        lead: "AF II series features a 16:9 panel dimension, with a thickness of only 33cm and a weight of merely 5.5kg. Optional MIP (Micro-chip in Package) Technology and Flip-Chip COB Process,support 5G Signal Transmission.",
        specTable: [
          [
            "Application Scenario",
            "Indoor"
          ],
          [
            "Model No.",
            "AFⅡ0.6",
            "AFⅡ0.7",
            "AFⅡ0.9",
            "AFⅡ1.2",
            "AFⅡ1.5",
            "AFⅡ1.8"
          ],
          [
            "Pixel Pitch",
            "0.625",
            "0.78125",
            "0.9375",
            "1.25",
            "1.5625",
            "1.875"
          ],
          [
            "Packaging techinque",
            "MIP",
            "COB",
            "MIP",
            "MIP",
            "MIP",
            "COB",
            "SMD TOP",
            "MIP",
            "COB",
            "COB",
            "COB",
            "SMD TOP",
            "SMD TOP",
            "COB"
          ],
          [
            "Panel Dimension",
            "600mm*337.5mm*32mm",
            "600mm*337.5mm*32mm",
            "600mm*337.5mm*32mm",
            "600mm*337.5mm*32mm",
            "600mm*337.5mm*32mm",
            "600mm*337.5mm*32mm"
          ],
          [
            "Driver Rate",
            "CC",
            "CC",
            "CC",
            "CC",
            "CC",
            "CC/CA",
            "CA",
            "CA",
            "CC",
            "CC",
            "CA",
            "CA",
            "CA",
            "CA"
          ],
          [
            "Scan Rate",
            "1/90",
            "1/36",
            "1/72",
            "1/30",
            "1/45",
            "1/54",
            "1/27",
            "1/27",
            "1/40",
            "1/60",
            "1/54",
            "1/54",
            "1/45",
            "1/45"
          ],
          [
            "Gray Scale",
            "14-16Bit"
          ],
          [
            "Panel Weight",
            "5.5kg±10%"
          ],
          [
            "Panel Material",
            "Die-casting Aluminum"
          ],
          [
            "Viewing Angle",
            "H:160°/V:160°"
          ],
          [
            "IP Rating",
            "Module: Front IP65, Panel: Front IP30 (SMD: IP30)"
          ],
          [
            "Processing platform",
            "Novastar/Colorlight"
          ],
          [
            "Product Certification",
            "EMC/LVD/FCC/ETL/RCM/CCC"
          ]
        ]
      },
      {
        id: "aw",
        name: "AW Fine Pitch",
        pitches: [
          0.93,
          1.25,
          1.56,
          1.87,
          2.5
        ],
        pricePerM2: 0,
        weightPerM2: 28.6,
        powerAvg: 120,
        powerMax: 300,
        cabinetW: 0.6,
        cabinetH: 0.3375,
        type: "Fixed",
        description: "Indoor 16:9 fine-pitch 600×337.5 mm panels, Mini 4-in-1 through SMD, GOB optional, 5.8 kg.",
        badge: "COB",
        cats: [
          "cob",
          "indoor"
        ],
        image: "assets/products/gloshine/aw-hero.png",
        gallery: [
          "assets/products/gloshine/aw-g2.png",
          "assets/products/gloshine/aw-g3.jpg"
        ],
        sourceUrl: "https://gloshine.com/products/aw.html",
        lead: "Indoor 16:9 fine-pitch 600×337.5 mm panels, Mini 4-in-1 through SMD, GOB optional, 5.8 kg.",
        specTable: [
          [
            "Model No.",
            "AW 0.93",
            "AW 1.25",
            "AW 1.56",
            "AW 1.87",
            "AW 2.50"
          ],
          [
            "Pixel Pitch",
            "0.93mm",
            "1.25mm",
            "1.56mm",
            "1.87mm",
            "2.50mm"
          ],
          [
            "LED Type",
            "Mini 4in1",
            "SMD1010",
            "SMD1212",
            "SMD1515",
            "SMD2020"
          ],
          [
            "GOB",
            "Optional"
          ],
          [
            "Pixel Density",
            "1137777 pixel/m²",
            "640000 pixel/m²",
            "409600 pixel/m²",
            "284444 pixel/m²",
            "160000 pixel/m²"
          ],
          [
            "Brightness",
            "400～600 nits",
            "400～600 nits",
            "500～700 nits",
            "600～800 nits",
            "800～1000 nits"
          ],
          [
            "Color Temperature",
            "2500～9500K"
          ],
          [
            "Scan Rate",
            "1/30",
            "1/30 or 1/60",
            "1/32 or 1/64",
            "1/30",
            "1/30"
          ],
          [
            "Panel Dimension(W*H*D)",
            "600mm*337.5mm*41mm（23.6\"*13.3\"*1.6\"）"
          ],
          [
            "Panel Resolution",
            "640*360 pixel",
            "480*270 pixel",
            "384*216 pixel",
            "320*180pixel",
            "240*135 pixel"
          ],
          [
            "Panel Weight",
            "5.8kg（12.8lb）±10%"
          ],
          [
            "Panel Material",
            "Die-casting Panel"
          ],
          [
            "Max Power Consumption",
            "≦500w/m²"
          ],
          [
            "Ave Power Consumption",
            "≤250W/m²"
          ],
          [
            "Viewing Angle",
            "H：160° V：140°"
          ],
          [
            "Refresh Rate",
            "7680/3840Hz"
          ],
          [
            "Gray Scale",
            "13-16bit"
          ],
          [
            "Working Voltage （Wide Voltage）",
            "AC100-240V～ 50-60Hz"
          ]
        ]
      },
      {
        id: "blade",
        name: "Blade",
        pitches: [
          1.25,
          1.53,
          1.86,
          2,
          2.5
        ],
        pricePerM2: 0,
        weightPerM2: 24.4,
        powerAvg: 160,
        powerMax: 400,
        cabinetW: 0.64,
        cabinetH: 0.48,
        type: "Fixed",
        description: "Ultra-thin indoor fixed LED, 640×480×38 mm, 7.5 kg, full front service, GOB optional.",
        badge: null,
        cats: [
          "indoor"
        ],
        image: "assets/products/gloshine/blade-hero.png",
        gallery: [
          "assets/products/gloshine/blade-g1.png"
        ],
        sourceUrl: "https://gloshine.com/products/blade-series.html",
        lead: "We provide premium indoor fixed GOB LED screens, combining Ultra-HD visuals, lightweight construction, energy efficiency, and IP30 protection — ideal for diverse indoor applications.",
        specTable: [
          [
            "Model No.",
            "BD 1.25",
            "BD 1.53",
            "BD 1.86",
            "BD 2.0",
            "BD 2.50"
          ],
          [
            "Pixel Pitch",
            "1.25mm",
            "1.53mm",
            "1.86mm",
            "2.0mm",
            "2.50mm"
          ],
          [
            "LED Type",
            "SMD1010",
            "SMD1212",
            "SMD1515",
            "SMD1515",
            "SMD2020"
          ],
          [
            "Brightness",
            "300～500 nits",
            "400～600 nits",
            "500～800 nits",
            "500～800 nits",
            "600～900 nits"
          ],
          [
            "Panel Dimension(W*H*D)",
            "640mm*480mm*38mm"
          ],
          [
            "Panel Weight",
            "7.5KG±10%"
          ],
          [
            "Panel Material",
            "Die-casting Panel"
          ],
          [
            "Viewing Angle",
            "H：160° V：140°"
          ],
          [
            "Serviceability",
            "Front"
          ],
          [
            "Curve",
            "Optional"
          ]
        ]
      },
      {
        id: "gposter",
        name: "G-Poster Std 2",
        pitches: [
          1.53,
          1.86
        ],
        pricePerM2: 0,
        weightPerM2: 23.6,
        powerAvg: 180,
        powerMax: 450,
        cabinetW: 0.64,
        cabinetH: 1.92,
        type: "Poster",
        description: "Indoor LED poster, 640×1920 mm, pitches 1.53 / 1.86 mm. Foldable transport design.",
        badge: "Poster",
        cats: [
          "indoor",
          "popular"
        ],
        image: "assets/products/gloshine/gposter-hero.png",
        gallery: [
          "assets/products/gloshine/gposter-g1.png"
        ],
        sourceUrl: "https://gloshine.com/products/g-poster-std-2-series.html",
        lead: "G-Poster Std 2 Series Classic Foldable LED Poster,",
        specTable: [
          [
            "Model No.",
            "G-Poster Std 2 1.5",
            "G-Poster Std 2 1.8"
          ],
          [
            "Pixel Pitch",
            "1.53mm",
            "1.86mm"
          ],
          [
            "LED Type",
            "GOB",
            "GOB"
          ],
          [
            "Total Weight",
            "29kg",
            "29kg"
          ],
          [
            "LED Screen Dimension",
            "640*1920mm",
            "640*1920mm"
          ],
          [
            "Overall Dimension",
            "unfold: 668 2077 450mm folded: 668 1111.5 450mm",
            "unfold: 668 2077 450mm folded: 668 1111.5 450mm"
          ],
          [
            "Resolution",
            "416*1248",
            "344*1032"
          ],
          [
            "Brightness",
            "600 nits",
            "600 nits"
          ],
          [
            "Scan Rate",
            "1/52",
            "1/43"
          ],
          [
            "Refresh Rate",
            "3840Hz",
            "3840Hz"
          ],
          [
            "Max. Power Consumption",
            "520W/PCS",
            "500W/PCS"
          ],
          [
            "Contrast Rate",
            "4000:1"
          ],
          [
            "Gray Scale",
            "13~14 bit",
            "13~14 bit"
          ],
          [
            "OS",
            "Android",
            "Android"
          ]
        ]
      },
      {
        id: "gposterplus",
        name: "G-Poster Plus",
        pitches: [
          1.8,
          2.5
        ],
        pricePerM2: 0,
        weightPerM2: 24.6,
        powerAvg: 180,
        powerMax: 450,
        cabinetW: 0.656,
        cabinetH: 2.076,
        type: "Poster",
        description: "Indoor LED poster, 656×2076 mm, pitches 1.8 / 2.5 mm.",
        badge: "Poster",
        cats: [
          "indoor"
        ],
        image: "assets/products/gloshine/gposterplus-hero.png",
        gallery: [
          "assets/products/gloshine/gposterplus-g1.png"
        ],
        sourceUrl: "https://gloshine.com/products/g-poster-plus-series.html",
        lead: "G-Poster Plus Series Professional Commercial Digital Posters deliver a comprehensive digital display solution for commercial information presentation, brand image building, and spatial ambiance creation, thanks to their superior display performance, innovative industrial design, flexible deployment options, and intelligent management system. They are deeply tailored to modern commercial scenarios that demand high-quality visual presentation and efficient operational management.",
        specTable: [
          [
            "Model No.",
            "GP Plus 1.5",
            "GP Plus 1.8",
            "GP Plus 2.5"
          ],
          [
            "Pixel Pitch",
            "1.56mm",
            "1.87mm",
            "2.5mm"
          ],
          [
            "LED Type",
            "GOB",
            "GOB",
            "GOB"
          ],
          [
            "Overall Dimension",
            "617 * 2043 * 43mm",
            "617 * 2043 * 43mm",
            "617 * 2043 * 43mm"
          ],
          [
            "LED Screen Dimension",
            "600 * 2025mm",
            "600 * 2025mm",
            "600 * 2025mm"
          ],
          [
            "Total Weight",
            "31kg",
            "31kg",
            "31kg"
          ],
          [
            "Brightness",
            "500 nits",
            "500 nits",
            "500 nits"
          ],
          [
            "Scan Rate",
            "1/54",
            "1/45",
            "1/45"
          ],
          [
            "Refresh Rate",
            "3840Hz",
            "3840Hz",
            "3840Hz"
          ],
          [
            "Max. Power Consumption",
            "420W/PCS",
            "420W/PCS",
            "420W/PCS"
          ],
          [
            "Gray Scale",
            "14bit",
            "14bit",
            "14bit"
          ],
          [
            "OS",
            "Android",
            "Android",
            "Android"
          ]
        ]
      },
      {
        id: "arpro",
        name: "AR Pro",
        pitches: [
          1.9,
          2.6,
          2.9,
          3.9
        ],
        pricePerM2: 0,
        weightPerM2: 51.2,
        powerAvg: 220,
        powerMax: 550,
        cabinetW: 0.5,
        cabinetH: 0.5,
        type: "Rental",
        description: "Indoor & outdoor rental with GOB indoor / SMD+PC outdoor, 500×500 mm, front service, 3840/7680 Hz.",
        badge: "Rental",
        cats: [
          "rental",
          "indoor",
          "outdoor"
        ],
        image: "assets/products/gloshine/arpro-hero.png",
        gallery: [
          "assets/products/gloshine/arpro-g1.jpg"
        ],
        sourceUrl: "https://gloshine.com/products/ar-pro-series.html",
        lead: "conventional background screen. Paired with the integrated installation system, setup is completed effortlessly without complex modifications. ",
        specTable: [
          [
            "Application Scenario",
            "Indoor",
            "Outdoor"
          ],
          [
            "Model No.",
            "AR Pro1.9",
            "AR Pro2.6",
            "AR Pro2.9",
            "AR Pro3.9",
            "AR Pro2.9",
            "AR Pro3.9"
          ],
          [
            "Pixel Pitch",
            "1.9",
            "2.6",
            "2.9",
            "3.9",
            "2.9",
            "3.9"
          ],
          [
            "Packaging techinque",
            "GOB",
            "GOB",
            "GOB",
            "GOB",
            "SMD+PC",
            "SMD+PC"
          ],
          [
            "Panel Dimension",
            "500mm*500mm*91mm",
            "500mm*500mm*91mm",
            "500mm*500mm*91mm",
            "500mm*500mm*91mm",
            "500mm*500mm*91mm",
            "500mm*500mm*91mm"
          ],
          [
            "Panel Resolution",
            "256*256pixel",
            "192*192pixel",
            "168*168pixel",
            "128*128pixel",
            "168*168pixel",
            "128*128pixel"
          ],
          [
            "Scan Rate",
            "1/32",
            "1/24",
            "1/21",
            "1/16",
            "1/21",
            "1/16"
          ],
          [
            "Refresh Rate",
            "3840Hz/7680Hz"
          ],
          [
            "Panel Weight",
            "12.8kg±10%",
            "13kg±10%"
          ],
          [
            "Panel Material",
            "Die-Casting Aluminum"
          ],
          [
            "Viewing Angle",
            "H:160°/V:160°"
          ],
          [
            "IP Rating",
            "Front IP31",
            "Front IP65/Rear IP54"
          ],
          [
            "Serviceability",
            "Front Maintenance"
          ],
          [
            "Max Stacking/Hanging",
            "7.5m(Vertical Screen)"
          ]
        ]
      },
      {
        id: "cfpro",
        name: "CF Pro",
        pitches: [
          1.56,
          1.9,
          2.38,
          2.6,
          2.9,
          3.9
        ],
        pricePerM2: 0,
        weightPerM2: 34.0,
        powerAvg: 210,
        powerMax: 525,
        cabinetW: 0.5,
        cabinetH: 0.5,
        type: "Creative",
        description: "Flexible indoor LED for cylinders and creative shapes. 500×500 mm panels with tight curve locks.",
        badge: "Creative",
        cats: [
          "indoor",
          "rental"
        ],
        image: "assets/products/gloshine/cfpro-hero.png",
        gallery: [
          "assets/products/gloshine/cfpro-g2.png"
        ],
        sourceUrl: "https://gloshine.com/products/cf-pro.html",
        lead: "CF Pro Series Indoor Version，Fully Upgrated,Innovative Self-locking, Smoother Arc Adjustment ;Single Pannel Up To 45° ;Dual flexible modules,More Flatness;Patented Anti-collision Design;More Solid",
        specTable: [
          [
            "Model No.",
            "CFPro1.5（Indoor）",
            "CFPro1.9（Indoor）",
            "CFPro1.9(Indoor)",
            "CFPro1.9(Indoor)",
            "CFPro1.9(Indoor)",
            "CFPro2.38(Indoor)",
            "CFPro2.6(Indoor)",
            "CFPro2.9(Indoor)",
            "CFPro3.9(Indoor)"
          ],
          [
            "Pixel Pitch",
            "1.56mm",
            "1.9mm",
            "1.9mm",
            "1.9mm",
            "1.9mm",
            "2.38mm",
            "2.6mm",
            "2.9mm",
            "3.9mm"
          ],
          [
            "LED Type",
            "SMD1212",
            "SMD1212",
            "SMD1515+HOB",
            "SMD1212",
            "SMD1212",
            "SMD1515",
            "SMD1515",
            "SMD2020",
            "SMD2020"
          ],
          [
            "Packing process",
            "HOB",
            "2 in 1",
            "HOB",
            "S-SMT",
            "4 in 1",
            "/",
            "/",
            "/",
            "/"
          ],
          [
            "Pixel Density",
            "409600 pixel/㎡",
            "262144 pixel/㎡",
            "262144 pixel/㎡",
            "262144 pixel/㎡",
            "262144 pixel/㎡",
            "173056 pixel/㎡",
            "147456 pixel/㎡",
            "112896 pixel/㎡",
            "65536 pixel/㎡"
          ],
          [
            "Panel Dimension",
            "500mm*500mm*108mm"
          ],
          [
            "Panel Weight",
            "8.5kg±10%"
          ],
          [
            "Panel Material",
            "Die-Casting Panel"
          ]
        ]
      },
      {
        id: "cfpro2",
        name: "CF Pro II",
        pitches: [
          1.9,
          2.6,
          2.9,
          3.9
        ],
        pricePerM2: 0,
        weightPerM2: 34.0,
        powerAvg: 210,
        powerMax: 525,
        cabinetW: 0.5,
        cabinetH: 0.5,
        type: "Creative",
        description: "Indoor/outdoor flexible LED. 500×500 mm panels, curve to −22.5°, indoor and outdoor pitches.",
        badge: "Creative",
        cats: [
          "indoor",
          "rental",
          "outdoor"
        ],
        image: "assets/products/gloshine/cfpro2-hero.png",
        gallery: [
          "assets/products/gloshine/cfpro2-g1.jpg"
        ],
        sourceUrl: "https://gloshine.com/products/cf-pro-ii-series.html",
        lead: "Curface Pro II Series Indoor & Outdoor Flexible LED Display,Left and right 0°～±22.5° each, maximum curve 45°, effortless curvature.Curved ±90° is available for rapid right-angle or wider-angle splicing.",
        specTable: [
          [
            "Application Scenario",
            "Indoor",
            "Outdoor"
          ],
          [
            "Model No.",
            "CF ProⅡ1.9",
            "CF ProⅡ1.9",
            "CF ProⅡ2.6",
            "CF ProⅡ2.9",
            "CF ProⅡ3.9",
            "CF ProⅡ3.9"
          ],
          [
            "Pixel Pitch",
            "1.9",
            "1.9",
            "2.6",
            "2.9",
            "3.9",
            "3.9"
          ],
          [
            "LED Type",
            "2in1 Black LED",
            "SMD1515 Black LED",
            "S-SMT1515 Black LED",
            "SMD2020 Black LED",
            "SMD2020 Black LED",
            "SMD1921 Write/Black LED"
          ],
          [
            "Packaging techinque",
            "IMD",
            "HOB",
            "SMD",
            "SMD",
            "SMD",
            "SMD"
          ],
          [
            "Panel Dimension",
            "500mm*500mm*111mm",
            "500mm*500mm*111mm",
            "500mm*500mm*111mm",
            "500mm*500mm*111mm",
            "500mm*500mm*111mm",
            "500mm*500mm*111mm"
          ],
          [
            "Scan Rate",
            "1/32 or 1/16",
            "1/32 or 1/16",
            "1/24",
            "1/21",
            "1/16",
            "1/16"
          ],
          [
            "Refresh Rate",
            "3840Hz/7680Hz"
          ],
          [
            "Panel Weight",
            "8.5kg±10%",
            "8.8kg±10%"
          ],
          [
            "Panel Material",
            "Die-Casting Aluminum"
          ],
          [
            "Curve",
            "-22.5°/-20°/-17.5°/-15°/-12.5°/-10°/-7.5°/-5/-2.5°/0°/+2.5°/+5°/+7.5°/+10°/+12.5°/+15°+/20°+/22.5°"
          ],
          [
            "Max Stacking/Hanging",
            "5m"
          ]
        ]
      },
      {
        id: "rbb",
        name: "RB-B",
        pitches: [
          1.9,
          2.6,
          2.9,
          3.9
        ],
        pricePerM2: 0,
        weightPerM2: 28.8,
        powerAvg: 200,
        powerMax: 500,
        cabinetW: 0.5,
        cabinetH: 0.5,
        type: "Rental",
        description: "Indoor rental 500×500 mm (RB Plus-B 500×1000), 3840/7680 Hz, front/rear service.",
        badge: "Rental",
        cats: [
          "rental",
          "indoor"
        ],
        image: "assets/products/gloshine/rbb-hero.png",
        gallery: [
          "assets/products/gloshine/rbb-g1.jpg"
        ],
        sourceUrl: "https://gloshine.com/products/rb-b-series.html",
        lead: "RB-B Series High-Cost-Effectiveness LED Display. Exceptionally slim and lightweight, featuring a magnetic absorption design for easy maintenance and efficient installation/removal. Versatile configurations supported, including right-angle, curved, and cubic column shapes. Ideal for stages, auto shows, conferences, forums, fixed installations, and more. This high-value LED display meets all your visual presentation needs.",
        specTable: [
          [
            "Model No.",
            "RB-B1.9",
            "RB-B/RB PLUS-B2.6",
            "RB-B/RB PLUS-B2.9",
            "RB-B/RB PLUS-B3.9"
          ],
          [
            "Pixel Pitch",
            "1.9mm",
            "2.6mm",
            "2.9mm",
            "3.9mm"
          ],
          [
            "LED Type",
            "2 in 1",
            "SMD1515",
            "SMD2020",
            "SMD2020"
          ],
          [
            "Panel Dimension",
            "RB-B:500mm*500mm*76mm",
            "RB Plus-B:500mm*1000mm*76mm RB-B:500mm*500mm*76mm",
            "RB Plus-B:500mm*1000mm*76mm RB-B:500mm*500mm*76mm",
            "RB Plus-B:500mm*1000mm*76mm RB-B:500mm*500mm*76mm"
          ],
          [
            "Scan Rate",
            "1/32",
            "1/24",
            "1/21 or 1/28",
            "1/16"
          ],
          [
            "Refresh Rate",
            "3840Hz/7680Hz"
          ],
          [
            "Panel Weight",
            "RB-B:7.2kg±10% RB Plus-B:12.2kg±10% Dual Redundancy:8kg±10%"
          ],
          [
            "Panel Material",
            "Die-Casting Panel"
          ],
          [
            "Viewing Angle",
            "H:160°/V:140°"
          ],
          [
            "IP Rating",
            "IP30"
          ],
          [
            "Maintenance",
            "Front/Rear"
          ]
        ]
      },
      {
        id: "ur",
        name: "UR Carbon",
        pitches: [
          2.6,
          3.91
        ],
        pricePerM2: 0,
        weightPerM2: 22,
        powerAvg: 200,
        powerMax: 500,
        cabinetW: 0.5,
        cabinetH: 1.0,
        type: "Rental",
        description: "Ultra-light carbon-fiber 500×1000 mm panels, indoor IP30 and outdoor IP65 versions, hang to 20 m.",
        badge: "Rental",
        cats: [
          "rental",
          "outdoor"
        ],
        image: "assets/products/gloshine/ur-hero.png",
        gallery: [
          "assets/products/gloshine/ur-g2.jpg"
        ],
        sourceUrl: "https://gloshine.com/products/ur.html",
        lead: "Ultra-light carbon-fiber 500×1000 mm panels, indoor IP30 and outdoor IP65 versions, hang to 20 m.",
        specTable: [
          [
            "Model No.",
            "UR2(Indoor)",
            "UR3(Indoor)",
            "UR3(Outdoor)"
          ],
          [
            "Pixel Pitch",
            "2.60mm",
            "3.91mm",
            "3.91mm"
          ],
          [
            "LED Type",
            "SMD1515(black)",
            "SMD2020(black)",
            "SMD1921(black)"
          ],
          [
            "Pixel Density",
            "147456pixel/㎡",
            "65536pixel/㎡",
            "65536pixel/㎡"
          ],
          [
            "Color Temperature",
            "6500～9500K",
            "6500～9500K",
            "6500～9500K"
          ],
          [
            "Scan Rate",
            "1/16",
            "1/16",
            "1/16"
          ],
          [
            "Panel Dimension",
            "UR:500mm*1000mm*85.5mm (19.7\"*39.4\"*3.36) UR mini:500mm*500mm*85.5mm(19.7\"*19.7\"*3.36\")",
            "UR:500mm*1000mm*85.5mm (19.7\"*39.4\"*3.36) UR mini:500mm*500mm*85.5mm( 19.7\"*19.7\"*3.36\")",
            "UR:500mm*1000mm*85.5mm (19.7\"*39.4\"*3.36) UR mini:500mm*500mm*85.5mm(19.7\"*19.7\"*3.36\")"
          ],
          [
            "Panel Weight",
            "UR:10.5±10% UR mini:5.5±10%",
            "UR:10.5±10% UR mini:5.5±10%",
            "UR:10.5±10% UR mini:5.5±10%"
          ],
          [
            "Panel Material",
            "Die-casting Panel",
            "Die-casting Panel",
            "Die-casting Panel"
          ]
        ]
      },
      {
        id: "carbon",
        name: "Carbon II",
        pitches: [
          2.6,
          2.9,
          3.9,
          4.8,
          5.2
        ],
        pricePerM2: 0,
        weightPerM2: 19.6,
        powerAvg: 200,
        powerMax: 500,
        cabinetW: 0.5,
        cabinetH: 0.5,
        type: "Rental",
        description: "Magnesium/carbon ultra-light panels in 500×500, 500×1000, and 1000×500 sizes. Indoor and outdoor, 90° columns.",
        badge: "Rental",
        cats: [
          "rental",
          "indoor",
          "outdoor"
        ],
        image: "assets/products/gloshine/carbon-hero.png",
        gallery: [
          "assets/products/gloshine/carbon-g1.jpg",
          "assets/products/gloshine/carbon-g2.png",
          "assets/products/gloshine/carbon-g3.png"
        ],
        sourceUrl: "https://gloshine.com/products/carbon-.html",
        lead: "Carbon Ⅱ Series Carbon fiber ultra-thin HD screen,The perfect combination of carbon fiber and die -casting aluminum,High Gray Scale,Ultra Wide Viewing Angle,The 45°cutting-edged panel supports vertical splicing 、cube and cubic column shape.",
        specTable: [
          [
            "Application Scenario",
            "indoor",
            "outdoor"
          ],
          [
            "Model No.",
            "CB-S/CB-H/CB-VⅡ2.6",
            "CB-S/CB-H/CB-VⅡ2.9",
            "CB-S/CB-H/CB-VⅡ3.9",
            "CB-SⅡ2.9",
            "CB-S/CB-H/CB-VⅡ3.9",
            "CB-S/CB-H/CB-VⅡ4.8",
            "CB-S/CB-VⅡ5.2",
            "CB-HⅡ3.9-7.8"
          ],
          [
            "Pixel Pitch",
            "2.6mm",
            "2.9mm",
            "3.9mm",
            "2.9mm",
            "3.9mm",
            "4.8mm",
            "5.2mm",
            "3.9-7.8mm"
          ],
          [
            "Panel Dimension",
            "CB-SⅡ:500mm*500mm*74.5mm CB-VⅡ:500mm*1000mm*74.5mm CB-HⅡ:1000mm*500mm*74.5mm",
            "CB-SⅡ:500mm*500mm*74.5mm CB-VⅡ:500mm*1000mm*74.5mm CB-HⅡ:1000mm*500mm*74.5mm",
            "CB-SⅡ:500mm*500mm*74.5mm CB-VⅡ:500mm*1000mm*74.5mm CB-HⅡ:1000mm*500mm*74.5mm",
            "500mm*500mm*74.5mm",
            "CB-SⅡ:500mm*500mm*74.5mm CB-VⅡ:500mm*1000mm*74.5mm CB-HⅡ:1000mm*500mm*74.5mm",
            "CB-SⅡ:500mm*500mm*74.5mm CB-VⅡ:500mm*1000mm*74.5mm CB-HⅡ:1000mm*500mm*74.5mm",
            "CB-SⅡ:500mm*500mm*74.5mm CB-VⅡ:500mm*1000mm*74.5mm",
            "1000mm*500mm*74.5mm"
          ],
          [
            "Refresh Rate",
            "3840Hz/7680Hz"
          ],
          [
            "Gray Scale",
            "14-16Bit"
          ],
          [
            "Panel Weight",
            "CB-SⅡ：4.9kg±10%；CB-VⅡ: 8.5kg±10%；CB-HⅡ :8.2kg±10%"
          ],
          [
            "Working Voltage",
            "AC200-240V~50/60Hz or AC100-240V~50/60Hz"
          ],
          [
            "IP Rating",
            "IP30",
            "Front IP65/RearIP54"
          ],
          [
            "Serviceability",
            "Rear"
          ],
          [
            "Curve",
            "-7.5°/-5°/-2.5°/0°/+2.5°/+5°/+7.5°"
          ],
          [
            "Max Stacking/Hanging",
            "10m"
          ]
        ]
      },
      {
        id: "mvpro",
        name: "MV Pro",
        pitches: [
          1.2,
          1.5,
          1.9,
          2.3,
          2.6,
          2.9
        ],
        pricePerM2: 0,
        weightPerM2: 38.0,
        powerAvg: 200,
        powerMax: 500,
        cabinetW: 0.5,
        cabinetH: 0.5,
        type: "Rental",
        description: "XR / virtual-production indoor rental. 500×500×72 mm, 3840/7680 Hz, Brompton-ready, bevel curves.",
        badge: "XR",
        cats: [
          "rental",
          "indoor"
        ],
        image: "assets/products/gloshine/mvpro-hero.webp",
        gallery: [
          "assets/products/gloshine/mvpro-g2.jpg"
        ],
        sourceUrl: "https://gloshine.com/products/mv-pro.html",
        lead: "Our XR LED walls (120Hz HDR/DCI-P3) enable seamless virtual production, creating cinematic VFX, music video production,  and live broadcast environments, with modular panels for real-time scene switching.",
        specTable: [
          [
            "Model No.",
            "MV Pro 1.2",
            "MV Pro 1.5",
            "MV Pro 1.9",
            "MV Pro 1.9",
            "MV Pro 1.9",
            "MV Pro 2.3",
            "MV Pro 2.6",
            "MV Pro 2.6",
            "MV Pro 2.9"
          ],
          [
            "Plxel pitch",
            "1.27mm",
            "1.56mm",
            "1.95mm",
            "1.95mm",
            "1.95mm",
            "2.38mm",
            "2.60mm",
            "2.60mm",
            "2.97mm"
          ],
          [
            "LED type",
            "SMD1010",
            "SMD1212",
            "4 in 1",
            "2 in 1",
            "SMD1515",
            "SMD1515",
            "SMD1515",
            "S-SMT/SMD1515",
            "SMD2020"
          ],
          [
            "Packaging method",
            "GOB/HOB",
            "GOB/HOB",
            "/",
            "/",
            "GOB/HOB",
            "GOB/HOB",
            "/",
            "/",
            "/"
          ],
          [
            "Panel dimension (W*H*D)",
            "500*500*72mm(19.69*19.69*2.84\")"
          ],
          [
            "Panel weight",
            "9.5kg±10%(aluminum base)",
            "8.5kg±10%(plastic base)"
          ],
          [
            "Frame material",
            "Die-Casting Panel"
          ],
          [
            "Refresh rate",
            "3840Hz/7680Hz"
          ],
          [
            "Gray scale",
            "14-16bit"
          ],
          [
            "IP rating",
            "IP30"
          ],
          [
            "Curve",
            "only Bevel Panel:-7.5°/-5°/-2.5°/0°/2.5°/5°/7.5°"
          ],
          [
            "Max. stacking/hanging",
            "10m"
          ],
          [
            "Serviceability",
            "Front/Rear"
          ]
        ]
      },
      {
        id: "mt55",
        name: "MT55/62",
        pitches: [
          1.2,
          1.5,
          1.9,
          2.3
        ],
        pricePerM2: 0,
        weightPerM2: 35.2,
        powerAvg: 200,
        powerMax: 500,
        cabinetW: 0.5,
        cabinetH: 0.5,
        type: "Rental",
        description: "Indoor rental compatible with B-matrix style frames. Front/rear service, 3840/7680 Hz, hang to 8 m.",
        badge: "Rental",
        cats: [
          "rental",
          "indoor"
        ],
        image: "assets/products/gloshine/mt55-hero.png",
        gallery: [
          "assets/products/gloshine/mt55-g1.jpg"
        ],
        sourceUrl: "https://gloshine.com/products/mt5562-series.html",
        lead: "Indoor rental compatible with B-matrix style frames. Front/rear service, 3840/7680 Hz, hang to 8 m.",
        specTable: [
          [
            "Model No.",
            "MT55/62 1.2",
            "MT55/62 1.5",
            "MT55/62 1.9",
            "MT55/62 1.9",
            "MT55/62 1.9",
            "MT55/62 1.9",
            "MT55/62 2.3"
          ],
          [
            "Plxel Pitch",
            "1.29mm",
            "1.55mm",
            "1.93mm",
            "1.93mm",
            "1.93mm",
            "1.93mm",
            "2.38mm"
          ],
          [
            "LED Type",
            "SMD1010",
            "SMD1212",
            "SMD1515",
            "S-SMT 1212",
            "Two in one",
            "Mini Four in one",
            "SMD1515"
          ],
          [
            "GOB/HOB",
            "GOB/HOB",
            "GOB/HOB",
            "GOB/HOB",
            "/",
            "/",
            "/",
            "/"
          ],
          [
            "Scan Rate",
            "1/32",
            "1/16 or 1/40",
            "1/16 or 1/32",
            "1/8 or 1/16 or 1/32",
            "1/16 or 1/32",
            "1/32",
            "1/26"
          ],
          [
            "Panel Weight",
            "8.8kg±10%/19.84lb±10%"
          ],
          [
            "Panel Material",
            "Die-Casting Panel"
          ],
          [
            "Refresh Rate",
            "7680/3840Hz"
          ],
          [
            "Gray Scale",
            "14-16bit"
          ],
          [
            "IP Rating",
            "IP30"
          ],
          [
            "Curve",
            "/"
          ],
          [
            "Max Stacking/Hanging",
            "8m"
          ],
          [
            "Serviceability",
            "Front/Rear"
          ],
          [
            "Processing platform",
            "Novastar/Colorlight /Magnimage/Brompton"
          ],
          [
            "Certifications",
            "CE-EMC,CE-LVD,FCC,ETL"
          ]
        ]
      },
      {
        id: "mt2",
        name: "MT II",
        pitches: [
          2.3,
          2.8
        ],
        pricePerM2: 0,
        weightPerM2: 36.6,
        powerAvg: 210,
        powerMax: 525,
        cabinetW: 0.496,
        cabinetH: 0.496,
        type: "Creative",
        description: "Creative indoor 496×496 mm panels for curved and volume builds.",
        badge: "Creative",
        cats: [
          "indoor"
        ],
        image: "assets/products/gloshine/mt2-hero.png",
        gallery: [
          "assets/products/gloshine/mt2-g2.png",
          "assets/products/gloshine/mt2-g3.png"
        ],
        sourceUrl: "https://gloshine.com/products/mt-series.html",
        lead: "MT Edge Series Indoor HD LED Panel,Thin Panel,Flexible Module,Fast Installation,Variety of Shapes.",
        specTable: [
          [
            "Model No.",
            "MTⅡ2.3(Indoor)",
            "MTⅡ2.8(Indoor)"
          ],
          [
            "Pixel Pitch",
            "2.3mm",
            "2.8mm"
          ],
          [
            "LED Type",
            "SMD1515",
            "SMD2020"
          ],
          [
            "Panel Dimension(W*H*D)",
            "496*496*62mm/19.5\"x19.5\"x2.4\""
          ],
          [
            "Panel Weight",
            "9.0kg(±10%)/19.84lb(±10%)"
          ],
          [
            "Panel Material",
            "Die-Casting Panel"
          ],
          [
            "Max Power Consumption",
            "≤650w/m²"
          ],
          [
            "Ave Power Consumption",
            "≤325w/m²"
          ],
          [
            "Viewing Angle",
            "H:160° V:140°"
          ]
        ]
      },
      {
        id: "mtedge",
        name: "MT Edge",
        pitches: [
          1.55,
          1.93,
          2.38,
          2.82
        ],
        pricePerM2: 0,
        weightPerM2: 32.5,
        powerAvg: 210,
        powerMax: 525,
        cabinetW: 0.496,
        cabinetH: 0.496,
        type: "Creative",
        description: "Tight-curve indoor creative panels, 496×496 mm, curves up to ±80° on coarser pitches.",
        badge: "Creative",
        cats: [
          "indoor"
        ],
        image: "assets/products/gloshine/mtedge-hero.png",
        gallery: [
          "assets/products/gloshine/mtedge-g2.png"
        ],
        sourceUrl: "https://gloshine.com/products/mt-edge-series.html",
        lead: "MT Edge Series Indoor HD LED Panel,One panel\r\nFlexible module S shape Concave and convex shape,Max curved angle ±80° per panel,HD Image,Support Rear Maintenance.",
        specTable: [
          [
            "Model No.",
            "MT Edge1.5（Indoor）",
            "MT Edge1.9（Indoor）",
            "MT Edge1.9（Indoor）",
            "MT Edge1.9（Indoor）",
            "MT Edge2.3（Indoor）",
            "MT Edge2.8（Indoor）"
          ],
          [
            "Pixel Pitch",
            "1.55mm",
            "1.93mm",
            "1.93mm",
            "1.93mm",
            "2.38mm",
            "2.82mm"
          ],
          [
            "LED Type",
            "SMD1212+HOB",
            "SMD1515+HOB",
            "S-SMT 1212",
            "Two in one",
            "SMD1515",
            "SMD2020"
          ],
          [
            "Panel Dimension(W*H*D)",
            "496mm*496mm*62mm(19.53\"*19.53\"*2.44\")"
          ],
          [
            "Panel Weight",
            "8KG(17.64lb)±10%"
          ],
          [
            "Panel Material",
            "Die-casting Aluminum"
          ],
          [
            "IP Rating",
            "IP30"
          ],
          [
            "Max Stacking/Hanging",
            "5m"
          ],
          [
            "Serviceability",
            "Rear"
          ],
          [
            "Curve",
            "-40°-20°/0°/20°/40°(1.5&1.9)",
            "-80°/-60°/-40°-20°/0°/20°/40°/60°/80°(2.3&2.8)"
          ]
        ]
      },
      {
        id: "cs2",
        name: "CS II Creative",
        pitches: [
          2.6,
          2.97,
          3.91,
          4.81
        ],
        pricePerM2: 0,
        weightPerM2: 24.0,
        powerAvg: 210,
        powerMax: 525,
        cabinetW: 0.5,
        cabinetH: 0.5,
        type: "Creative",
        description: "Triangle and sector creative panels for indoor/outdoor sculptures and special shapes.",
        badge: "Creative",
        cats: [
          "indoor",
          "outdoor"
        ],
        image: "assets/products/gloshine/cs2-hero.png",
        gallery: [
          "assets/products/gloshine/cs2-g1.jpg"
        ],
        sourceUrl: "https://gloshine.com/products/cs-ii-series.html",
        lead: "Breaking through the traditional limitations of LED display design, it creates personalized and artistic exhibition spaces through seamless splicing. Effortlessly captivating the audience with a refreshing visual impact, this innovative display is specially designed for high-end events, stage performances, and exhibitions.",
        specTable: [
          [
            "Triangle Screen"
          ],
          [
            "Model No.",
            "CS II2.6(Indoor)",
            "CS II2.9(Indoor)",
            "CS II3.91(Indoor)",
            "CS II3.91(outdoor)",
            "CS II4.81(outdoor)"
          ],
          [
            "Pixel Pitch",
            "2.6mm",
            "2.97mm",
            "3.91mm",
            "3.91mm",
            "4.81mm"
          ],
          [
            "LED Type",
            "SMD1515",
            "SMD2020",
            "SMD2020",
            "SMD1921",
            "SMD1921"
          ],
          [
            "Pixel Density",
            "147456 pixel/m²",
            "112896 pixel/m²",
            "65536 pixel/m²",
            "65536 pixel/m²",
            "43264 pixel/m²"
          ],
          [
            "Scan Rate",
            "1/24",
            "1/21",
            "1/16",
            "1/16",
            "1/13"
          ],
          [
            "Panel Dimension",
            "500*500"
          ],
          [
            "Panel Weight",
            "6kg±10%",
            "6kg±10%",
            "6kg±10%",
            "6kg±10%",
            "6kg±10%"
          ],
          [
            "Panel Material",
            "Die-casting Panel"
          ],
          [
            "Viewing Angle",
            "H:160º V:140º"
          ],
          [
            "Refresh Rate",
            "3840Hz/7680Hz"
          ],
          [
            "Gray Scale",
            "14～16bit"
          ],
          [
            "IP Rating",
            "IP30",
            "front IP65/rear IP54"
          ],
          [
            "Max Stacking/Hanging Height",
            "10m"
          ],
          [
            "Curve",
            "Optional"
          ]
        ]
      },
      {
        id: "mr",
        name: "MR",
        pitches: [
          3.91,
          2.97,
          2.6,
          1.95,
          1.56,
          4.81
        ],
        pricePerM2: 0,
        weightPerM2: 44.0,
        powerAvg: 210,
        powerMax: 525,
        cabinetW: 0.5,
        cabinetH: 0.5,
        type: "Creative",
        description: "Creative / matrix LED series for hanging, rental, and fixed configurations.",
        badge: "Creative",
        cats: [
          "indoor"
        ],
        image: "assets/products/gloshine/mr-hero.png",
        gallery: [
          "assets/products/gloshine/mr-g1.png"
        ],
        sourceUrl: "https://gloshine.com/products/mr-series.html",
        lead: "Creative / matrix LED series for hanging, rental, and fixed configurations.",
        specTable: [
          [
            "Indoor"
          ],
          [
            "Model No.",
            "MR3.91",
            "MR2.97",
            "MR2.6",
            "MR1.95",
            "MR1.56"
          ],
          [
            "Pixel Pitch",
            "3.91mm",
            "2.97mm",
            "2.6mm",
            "1.95mm",
            "1.56mm"
          ],
          [
            "Scan Rate",
            "1/16",
            "1/16",
            "1/24 or 1/16",
            "1/16 or 1/32",
            "1/32"
          ],
          [
            "Panel Dimension",
            "250*500*splicing（9.84\"*19.7\"*splicing)"
          ],
          [
            "Panel Resolution",
            "64*128pixel",
            "84*168pixel",
            "96*192pixel",
            "128*256pixel",
            "160*320pixel"
          ],
          [
            "Panel Weight",
            "5.5KG±10％"
          ],
          [
            "Panel Material",
            "Die-casting Panel"
          ],
          [
            "Viewing Angle",
            "H:160º V:140º"
          ],
          [
            "Refresh Rate",
            "3840HZ/7680HZ"
          ],
          [
            "IP Rating",
            "IP30"
          ],
          [
            "Max Stacking",
            "10m"
          ],
          [
            "MaxHanging",
            "10m"
          ],
          [
            "Curve",
            "Optional"
          ]
        ]
      },
      {
        id: "ra2",
        name: "RA II",
        pitches: [
          1.57,
          1.56,
          1.98,
          2.6,
          2.97
        ],
        pricePerM2: 0,
        weightPerM2: 28,
        powerAvg: 170,
        powerMax: 425,
        cabinetW: 0.5,
        cabinetH: 0.5,
        type: "Fixed",
        description: "Ultra-thin indoor 500×500×40 mm panels (RA Plus 500×1000), HOB/GOB on fine pitches.",
        badge: null,
        cats: [
          "indoor"
        ],
        image: "assets/products/gloshine/ra2-hero.png",
        gallery: [
          "assets/products/gloshine/ra2-g1.png"
        ],
        sourceUrl: "https://gloshine.com/products/ra-series.html",
        lead: "Radiant series lighteight and versatile,high cost-effectiveness,full new generation  ultra-light small pixel pitch indoor rental LED screens.",
        specTable: [
          [
            "Model No.",
            "RA Ⅱ1.5(Indoor)",
            "RAⅡ1.9(Indoor)",
            "RA/RA PLUS Ⅱ2.6(Indoor)",
            "RA/RA PLUS Ⅱ2.9(Indoor)"
          ],
          [
            "Pixel Pitch",
            "1.57*1.56mm",
            "1.98mm",
            "2.6mm",
            "2.97mm"
          ],
          [
            "LED Type",
            "SMD1212",
            "SMD1515",
            "SMD1515",
            "SMD2020"
          ],
          [
            "Packaging techinque",
            "HOB/GOB",
            "HOB/GOB",
            "SMD",
            "SMD"
          ],
          [
            "Pixel Density",
            "407040/㎡",
            "254016/㎡",
            "147456/㎡",
            "112896/㎡"
          ],
          [
            "Color Temperature",
            "6500-9500k",
            "6500-9500k",
            "6500-9500k",
            "6500-9500k"
          ],
          [
            "Scan Rate",
            "1/53",
            "1/42",
            "1/32",
            "1/28"
          ],
          [
            "module Dimension",
            "500*125",
            "500*125",
            "500*125",
            "500*125"
          ],
          [
            "Panel Dimension",
            "500*500*40mm",
            "RA Ⅱ 500*500*40mm RA PLUS Ⅱ 500*1000*40mm",
            "RA Ⅱ 500*500*40mm RA PLUS Ⅱ 500*1000*40mm",
            "RA Ⅱ 500*500*40mm RA PLUS Ⅱ 500*1000*40mm"
          ]
        ]
      },
      {
        id: "zs3",
        name: "ZS III",
        pitches: [
          3.91,
          4.81,
          6.94
        ],
        pricePerM2: 0,
        weightPerM2: 22.0,
        powerAvg: 280,
        powerMax: 700,
        cabinetW: 0.5,
        cabinetH: 0.5,
        type: "Outdoor",
        description: "Outdoor die-cast magnesium panels, front IP65 / rear IP54, curve options, 10 m hang/stack.",
        badge: null,
        cats: [
          "outdoor"
        ],
        image: "assets/products/gloshine/zs3-hero.png",
        gallery: [
          "assets/products/gloshine/zs3-g1.jpg"
        ],
        sourceUrl: "https://gloshine.com/products/zs-iii-series.html",
        lead: "Outdoor die-cast magnesium panels, front IP65 / rear IP54, curve options, 10 m hang/stack.",
        specTable: [
          [
            "Model No.",
            "ZMⅢ3.9&ZSⅢ3.9",
            "ZMⅢ4.8&ZSⅢ4.8",
            "ZMⅢ6.9&ZSⅢ6.9",
            "ZMⅢ4.8&ZSⅢ4.8",
            "ZMⅢ6.9&ZSⅢ6.9"
          ],
          [
            "Pixel Pitch",
            "3.91mm",
            "4.81mm",
            "6.94mm",
            "4.81mm",
            "6.94mm"
          ],
          [
            "LED Type",
            "SMD1921White/Black",
            "SMD1921White/Black",
            "SMD1921White/Black",
            "SMD1921White/Black",
            "SMD1921White/Black"
          ],
          [
            "Scan Rate",
            "1/16",
            "1/13",
            "1/6",
            "1/13",
            "1/9"
          ],
          [
            "Refresh Rate",
            "3840Hz/7680Hz"
          ],
          [
            "Panel Weight",
            "5.5kg±10%/9.3kg±10%",
            "5.4kg±10%/9.1kg±10%",
            "5.3kg±10%/8.8kg±10%",
            "5.4kg±10%/9.1kg±10%",
            "5.3kg±10%/8.8kg±10%"
          ],
          [
            "Panel Material",
            "Die-Casting Magnesium"
          ],
          [
            "IP Rating",
            "Front IP65/Rear IP54"
          ],
          [
            "Serviceability",
            "Rear"
          ],
          [
            "Curve",
            "Curved panel：-10°/-7.5°/-5°/-2.5°/0°/2.5°/5°/7.5°/10°"
          ],
          [
            "Max Stacking/Hanging",
            "10m"
          ]
        ]
      },
      {
        id: "zspro",
        name: "ZS Pro II",
        pitches: [
          3.9,
          5.9
        ],
        pricePerM2: 0,
        weightPerM2: 27.6,
        powerAvg: 280,
        powerMax: 700,
        cabinetW: 0.5,
        cabinetH: 1.0,
        type: "Outdoor",
        description: "Outdoor 500×500 / 500×1000 mm panels, front/rear module service, IP65 front / IP54 rear.",
        badge: null,
        cats: [
          "outdoor"
        ],
        image: "assets/products/gloshine/zspro-hero.png",
        gallery: [
          "assets/products/gloshine/zspro-g1.jpg"
        ],
        sourceUrl: "https://gloshine.com/products/zs-pro-series.html",
        lead: "ZS PRO Ⅱ Series The 2nd Generation High-End Outdoor Rental LED Display Optional magnetic modules for fast front maintenance. Combined with rotary knob fixation, this dual-securement method can prevent misalignment during transportation and avoid the risk of falling from height.",
        specTable: [
          [
            "Model No.",
            "ZS ProⅡ3.9/ZM ProⅡ3.9",
            "ZS ProⅡ5.9/ZM ProⅡ5.9"
          ],
          [
            "Pixel Pitch",
            "3.9mm",
            "5.9mm"
          ],
          [
            "LED Type",
            "SMD1921/Black SMD1921",
            "SMD1921/Black SMD1921"
          ],
          [
            "Panel Dimension",
            "500mm*1000mm*90mm 500mm*500mm*90mm",
            "500mm*1000mm*90mm 500mm*500mm*90mm"
          ],
          [
            "Scan Rate",
            "1/16 or 1/8",
            "1/7"
          ],
          [
            "Panel Weight",
            "ZS ProⅡ:13.8kg±10%，ZM ProⅡ:9.5kg±10%"
          ],
          [
            "Panel Material",
            "Die-Casting Aluminum"
          ],
          [
            "IP Rating",
            "Front IP65/Rear IP54"
          ],
          [
            "Serviceability",
            "Module: Front/Rear Maintenance；Power Box: Rear Maintenance"
          ]
        ]
      },
      {
        id: "gp",
        name: "GP Outdoor",
        pitches: [
          2.97,
          3.91,
          4.81,
          6.25,
          7.81,
          10.42
        ],
        pricePerM2: 0,
        weightPerM2: 64.0,
        powerAvg: 300,
        powerMax: 750,
        cabinetW: 0.5,
        cabinetH: 0.5,
        type: "Outdoor",
        description: "Outdoor fixed/rental LED from Gloshine GP series, IP65-rated panels.",
        badge: null,
        cats: [
          "outdoor"
        ],
        image: "assets/products/gloshine/gp-hero.png",
        gallery: [
          "assets/products/gloshine/gp-g1.jpg"
        ],
        sourceUrl: "https://gloshine.com/products/gp-series.html",
        lead: "GP Series Outdoor Advertising LED DisplayDie-Cast Aluminum Module+Aluminum Profile Panel Frame",
        specTable: [
          [
            "Model No.",
            "GP2.9",
            "GP3.9",
            "GP4.8",
            "GP6.2",
            "GP7.8",
            "GP10.4"
          ],
          [
            "Pixel Pitch",
            "2.97mm",
            "3.91mm",
            "4.81mm",
            "6.25mm",
            "7.81mm",
            "10.42mm"
          ],
          [
            "Panel Resolution",
            "168×336pixel",
            "256×256pixel",
            "208×208pixel",
            "160×160pixel",
            "128×128pixel",
            "96×96pixel"
          ],
          [
            "Panel Size(mm)",
            "1000×1000×85mm",
            "1000×1000×84.5mm"
          ],
          [
            "Panel Weight(kg/panel)",
            "16kg",
            "25kg"
          ],
          [
            "Panel Material",
            "Aluminum Profile"
          ],
          [
            "IP Rating",
            "IP66"
          ],
          [
            "Visual Angle(H/V)",
            "H:140°/ V:120°"
          ],
          [
            "Refresh Rate",
            "3840Hz",
            "3840/7680Hz"
          ],
          [
            "MAX.Power Consumption",
            "550W/㎡",
            "550W/㎡"
          ],
          [
            "Ave.Power Consumption",
            "168W/㎡",
            "186W/㎡"
          ],
          [
            "Maintenance Method",
            "Front/Rear"
          ]
        ]
      },
      {
        id: "legend",
        name: "Legend",
        pitches: [
          2.97,
          3.91,
          4.81
        ],
        pricePerM2: 0,
        weightPerM2: 38.0,
        powerAvg: 280,
        powerMax: 700,
        cabinetW: 0.5,
        cabinetH: 0.5,
        type: "Outdoor",
        description: "Outdoor Legend / Legend Mini panels, front IP65 / rear IP54, modular curve, hang/stack to 10 m.",
        badge: null,
        cats: [
          "outdoor"
        ],
        image: "assets/products/gloshine/legend-hero.webp",
        gallery: [
          "assets/products/gloshine/legend-g1.png",
          "assets/products/gloshine/legend-g3.png"
        ],
        sourceUrl: "https://gloshine.com/products/le.html",
        lead: "LED stage screens are designed for outdoor events. IP65 waterproof, 4500nit, 160° viewing. Modular curved designs, touring frames. Get a quote for our wind/rain proof set up LED displays.",
        specTable: [
          [
            "Model No.",
            "LE2.97B(Indoor)",
            "LE2.97B(Outdoor)",
            "LE3.91B(Outdoor)",
            "LE4.81B(Outdoor)"
          ],
          [
            "Pixel Pitch",
            "2.97mm",
            "2.97mm",
            "3.91mm",
            "4.81mm"
          ],
          [
            "LED Type",
            "SMD2020",
            "SMD1415",
            "SMD1921",
            "SMD1921"
          ],
          [
            "Scan Rate",
            "1/21",
            "1/21",
            "1/16 or 1/8",
            "1/13 or 1/7"
          ],
          [
            "Panel Dimension",
            "LE mini:500mm*500mm*87mm LE:500mm*1000mm*87mm"
          ],
          [
            "Panel Weight",
            "LE mini:9.5kg±10% LE:14.7kg±10%"
          ],
          [
            "Panel Material",
            "Die-Casting Panel"
          ],
          [
            "Viewing Angle",
            "H:160°V:140°"
          ],
          [
            "Refresh Rate",
            "3840Hz/7680Hz"
          ],
          [
            "Gray Scale",
            "14-16bit"
          ],
          [
            "IP Rating",
            "IP31",
            "Front IP65,Rear IP54"
          ],
          [
            "Curve",
            "-10°/-7.5°/-5°/-2.5°/0°/2.5°/5°/7.5°/10°"
          ],
          [
            "Max Stacking/Hanging",
            "10m"
          ]
        ]
      }
    ]
  },
  bako: {
    name: 'BAKO',
    tagline: 'Fine pitch COB, rental, and outdoor LED',
    series: [
      {
        id: 'finepitch',
        name: 'Fine Pitch 600×337.5',
        pitches: [0.78, 0.93, 1.25, 1.56, 1.87],
        pricePerM2: 3200,
        weightPerM2: 20,
        powerAvg: 100,
        powerMax: 350,
        cabinetW: 0.600,
        cabinetH: 0.3375,
        cabinets: [{ w: 600, h: 337.5 }, { w: 600, h: 675 }],
        type: 'Fixed',
        description: 'Flip-chip COB indoor panels in 600 × 337.5 mm (or 600 × 675 mm). Common-cathode energy saving, 800 nits, 3840 Hz, 15,000:1 contrast.',
        badge: 'COB',
        cats: ['cob', 'indoor', 'popular'],
        image: 'assets/products/bako/finepitch.jpg',
        sourceUrl: 'https://www.szbako.com/product/fine-pitch-600337-5-series.html',
        lead: 'Fine Pitch 600 × 337.5 Series flip-chip COB for close-view indoor walls. Seamless 16:9 panels, super-high contrast, front IP65 on the LED face, common-cathode energy saving, and 4 kg panels only 35.5 mm thick.',
        specTable: [
          ['Pixel Pitch (mm)', 'P0.78', 'P0.93', 'P1.25', 'P1.56', 'P1.87'],
          ['Pixel', 'Real pixel', 'Real pixel', 'Real pixel', 'Real pixel', 'Real pixel'],
          ['Package', 'Flip-chip COB', 'Flip-chip COB', 'Flip-chip COB', 'Flip-chip COB', 'Flip-chip COB'],
          ['Module Size', '150 × 168.75 mm', '300 × 168.75 mm', '300 × 168.75 mm', '300 × 168.75 mm', '300 × 168.75 mm'],
          ['Module Resolution', '192 × 216', '320 × 180', '240 × 135', '192 × 108', '160 × 90'],
          ['Panel Resolution', '768 × 432', '640 × 360', '480 × 270', '384 × 216', '320 × 180'],
          ['Scan', '1/54', '1/54', '1/120', '1/108', '1/90'],
          ['Brightness', '800 nits', '800 nits', '800 nits', '800 nits', '800 nits'],
          ['Pixel Density (dots/m²)', '1,638,400', '1,137,777', '640,000', '409,600', '284,444'],
          ['Panel Size (W×H×D)', '600 × 337.5 × 35.5 mm or 600 × 675 × 35 mm'],
          ['Color Depth', '14 bit'],
          ['Refresh Rate', '3840 Hz'],
          ['Contrast Ratio', '15,000:1'],
          ['Viewing Angle', '170° / 170°'],
          ['Max Power', '350 W/m²'],
          ['Average Power', '100 W/m²'],
          ['Panel Weight', '4 kg (600 × 337.5 mm)'],
          ['Certification', 'CCC, TUV (CE), FCC']
        ]
      },
      {
        id: 'allinone',
        name: 'All-in-One COB',
        pitches: [0.78, 0.9, 1.25, 1.56, 1.87, 2.5],
        pricePerM2: 0,
        weightPerM2: 20,
        powerAvg: 100,
        powerMax: 350,
        cabinetW: 0.600,
        cabinetH: 0.3375,
        type: 'All-in-one',
        description: '108″ / 135″ / 162″ flip-chip COB conference walls. Floor stand or wall mount, wireless share to 4 devices, real or dynamic 4K.',
        badge: 'COB',
        cats: ['cob', 'indoor'],
        image: 'assets/products/bako/allinone.jpg',
        sourceUrl: 'https://www.szbako.com/product/all-in-one-series-cob.html',
        lead: 'All-in-One COB in 108″, 135″, and 162″. Flip-chip COB package, 3840 Hz, 15,000:1 contrast, IP54/IP50, eye-friendly low-blue light, and wireless screen share from computer, phone, or tablet — up to four devices at once.',
        specTable: [
          ['Size', '108″', '108″', '108″', '135″', '135″', '135″', '162″', '162″', '162″'],
          ['Pixel Pitch', 'P1.25 COB', 'P1.25 COB', 'P2.5 COB', 'P0.78 COB', 'P1.56 COB', 'P1.56 COB', 'P0.9 COB', 'P1.87 COB', 'P1.87 COB'],
          ['Application', 'Indoor', 'Indoor', 'Indoor', 'Indoor', 'Indoor', 'Indoor', 'Indoor', 'Indoor', 'Indoor'],
          ['Pixel Mode', 'Real', 'Dynamic', 'Dynamic', 'Real', 'Real', 'Dynamic', 'Real', 'Real', 'Real & virtual'],
          ['Refresh Rate', '3840 Hz'],
          ['Brightness', '600 nits'],
          ['Viewing Angle', '175° / 175°'],
          ['IP Grade (front/rear)', 'IP54 / IP50'],
          ['Contrast Ratio', '15,000:1'],
          ['Panel Size', '600 × 337.5 × 35 mm / 600 × 675 × 35 mm'],
          ['Showing Size', '2.4 × 1.35 m', '2.4 × 1.35 m', '2.4 × 1.35 m', '3.0 × 1.6875 m', '3.0 × 1.6875 m', '3.0 × 1.6875 m', '3.6 × 2.025 m', '3.6 × 2.025 m', '3.6 × 2.025 m'],
          ['Resolution', '1920 × 1080 real 2K', '3840 × 2160 dynamic 4K', '1920 × 1080 dynamic 2K', '3840 × 2160 real 4K', '1920 × 1080 real 2K', '3840 × 2160 dynamic 4K', '3840 × 2160 real 4K', '1920 × 1080 real 2K', '3840 × 2160 dynamic 4K'],
          ['Certification', 'TUV CE']
        ]
      },
      {
        id: 'rentalcob',
        name: 'Rental COB 500×500',
        pitches: [1.56, 1.95, 2.6],
        pricePerM2: 0,
        weightPerM2: 22,
        powerAvg: 200,
        powerMax: 500,
        cabinetW: 0.5,
        cabinetH: 0.5,
        type: 'Rental',
        description: 'Indoor/outdoor flip-chip COB rental, 500 × 500 mm, 73 mm thick. Indoor 600 nits / 3840 Hz; outdoor 3500 nits / 7680 Hz.',
        badge: 'COB',
        cats: ['cob', 'rental', 'indoor', 'outdoor'],
        image: 'assets/products/bako/rentalcob.jpg',
        sourceUrl: 'https://www.szbako.com/product/rental-cob-500500.html',
        lead: 'Rental COB 500 × 500 mm panels with flip-chip COB, common-cathode energy saving, and front IP65 on the LED face. Indoor P1.56 / P1.95 / P2.6 at 600 nits and 3840 Hz; outdoor versions at 3500 nits and 7680 Hz.',
        specTable: [
          ['Application', 'Indoor', 'Indoor', 'Indoor', 'Outdoor', 'Outdoor', 'Outdoor'],
          ['Pixel Pitch', 'P1.56', 'P1.95', 'P2.6', 'P1.56', 'P1.95', 'P2.6'],
          ['Scan', '1/54', '1/32', '1/32', '1/20', '1/16', '1/16'],
          ['Refresh Rate', '3840 Hz', '3840 Hz', '3840 Hz', '7680 Hz', '7680 Hz', '7680 Hz'],
          ['Grayscale', '14 bit', '14 bit', '14 bit', '16 bit', '16 bit', '16 bit'],
          ['Brightness', '600 nits', '600 nits', '600 nits', '3500 nits', '3500 nits', '3500 nits'],
          ['Module Size', '250 × 250 mm'],
          ['Panel Size', '500 × 500 mm'],
          ['Thickness', '73 mm'],
          ['Front Protection', 'IP65']
        ]
      },
      {
        id: 'diamond4',
        name: 'Diamond Series V4.0',
        pitches: [1.95, 2.6, 2.97, 3.91, 4.81],
        pricePerM2: 0,
        weightPerM2: 27,
        powerAvg: 200,
        powerMax: 680,
        cabinetW: 0.5,
        cabinetH: 0.5,
        cabinets: [{ w: 500, h: 500 }, { w: 500, h: 1000 }],
        type: 'Rental',
        description: 'Indoor/outdoor rental, 500 × 500 and 500 × 1000 mm die-cast panels. Curve 0–5° out / 0–20° in, 90° corners, mix panel sizes.',
        badge: 'Rental',
        cats: ['rental', 'indoor', 'outdoor'],
        image: 'assets/products/bako/diamond4.jpg',
        sourceUrl: 'https://www.szbako.com/product/diamond-series-v4-0.html',
        lead: 'Diamond Series V4.0 curved rental LED for indoor and outdoor events. 500 × 500 mm panels at 6.8 kg and 500 × 1000 mm at 12–13 kg, 90° corners, outward curve 0–5° and inward curve 0–20°, and mix-and-match panel sizes.',
        specTable: [
          ['Application', 'Indoor', 'Indoor', 'Indoor', 'Indoor', 'Outdoor', 'Outdoor', 'Outdoor'],
          ['Pixel Pitch', 'P1.95', 'P2.6', 'P2.97', 'P3.91', 'P2.97', 'P3.91', 'P4.81'],
          ['Pixel Density (dots/m²)', '262,144', '147,456', '112,896', '65,536', '112,896', '65,536', '43,264'],
          ['Panel Material', 'Die-casting aluminum'],
          ['Maintenance', 'Rear (module front service available)'],
          ['Module Size', '250 × 250 mm'],
          ['Panel Size', '500 × 500 / 500 × 1000 mm'],
          ['Panel Weight', '6.8 kg / 13 kg', '6.8 kg / 13 kg', '6.8 kg / 13 kg', '6.8 kg / 13 kg', '7.1 kg / 13.5 kg', '7.1 kg / 13.5 kg', '7.1 kg / 13.5 kg'],
          ['Brightness', '800–1200 nits', '800–1200 nits', '800–1200 nits', '800–1200 nits', '4500–5500 nits', '4500–5500 nits', '4500–5500 nits'],
          ['Refresh Rate', '≥ 3840 Hz'],
          ['Viewing Angle', 'H 160° / V 140°'],
          ['Max Power', '680 W/m²'],
          ['Average Power', '200 W/m²', '200 W/m²', '200 W/m²', '200 W/m²', '240 W/m²', '240 W/m²', '240 W/m²']
        ]
      },
      {
        id: 'flyingdrone',
        name: 'Flying Drone 2.0',
        pitches: [0.937, 1.25, 1.56, 1.87, 2.5],
        pricePerM2: 0,
        weightPerM2: 30,
        powerAvg: 150,
        powerMax: 450,
        cabinetW: 0.600,
        cabinetH: 0.3375,
        type: 'Fixed',
        description: 'UHD 16:9 fine-pitch indoor wall. 600 × 337.5 mm die-cast panels at 6 kg, 100% front service, ≥ 3840 Hz.',
        badge: null,
        cats: ['indoor', 'popular'],
        image: 'assets/products/bako/flyingdrone.jpg',
        sourceUrl: 'https://www.szbako.com/product/flying-drone-2-0-series.html',
        lead: 'Flying Drone 2.0 is BAKO’s UHD small-pitch indoor series. 600 × 337.5 mm panels at 6 kg, no-module-frame design, hidden cables, 100% front service, and wide viewing angles for control rooms, studios, and conference walls.',
        specTable: [
          ['Pixel Pitch', 'P0.937', 'P1.25', 'P1.56', 'P1.87', 'P2.5'],
          ['Lamp', 'IMD 4-in-1', 'SMD1010', 'SMD1212', 'SMD1415', 'SMD2020'],
          ['Pixel Density (dots/m²)', '1,137,778', '640,000', '409,600', '284,444', '160,000'],
          ['Service', 'Front'],
          ['Brightness', '500–800 nits'],
          ['Module Size', '300 × 168.75 mm', '300 × 168.75 mm', '300 × 168.75 mm', '150 × 337.5 mm', '150 × 337.5 mm'],
          ['Panel Material', 'Die-casting aluminum'],
          ['Panel Size', '600 × 337.5 mm'],
          ['Panel Weight', '6 kg'],
          ['Refresh Rate', '≥ 3840 Hz'],
          ['Average Power', '150 W/m²'],
          ['Max Power', '450 W/m²'],
          ['Viewing Angle', '160° / 140°']
        ]
      },
      {
        id: 'bakoposter',
        name: 'LED Poster',
        pitches: [1.75, 2, 2.5],
        pricePerM2: 0,
        weightPerM2: 0,
        powerAvg: 200,
        powerMax: 500,
        type: 'Poster',
        description: 'Indoor or outdoor movable LED poster, 45 kg aluminum panel. Hang, wall, base, or landscape. Indoor P1.75 / P2 / P2.5; outdoor P2.5.',
        badge: null,
        cats: ['indoor', 'outdoor'],
        image: 'assets/products/bako/poster.jpg',
        sourceUrl: 'https://www.szbako.com/product/led-poster-screens.html',
        lead: 'BAKO LED posters are self-contained indoor or outdoor advertising displays. Aluminum panels at 45 kg with 280 × 210 mm modules, 160° / 140° viewing, and hang, wall, base-standing, or landscape install.',
        specTable: [
          ['Application', 'Outdoor', 'Indoor', 'Indoor', 'Indoor'],
          ['Pixel Pitch (mm)', '2.5', '2.5', '2.0', '1.75'],
          ['Module Size', '280 × 210 mm'],
          ['Panel Material', 'Aluminum'],
          ['Viewing Angle', 'H 160° / V 140°'],
          ['Weight', '45 kg']
        ]
      },
      {
        id: 'spaceship',
        name: 'Spaceship Series 2.0',
        pitches: [1.86, 4, 5, 6.67, 6.8, 8, 8.33, 10, 10.7],
        pricePerM2: 0,
        weightPerM2: 40,
        powerAvg: 270,
        powerMax: 800,
        cabinetW: 0.96,
        cabinetH: 0.96,
        cabinets: [{ w: 960, h: 960 }, { w: 1280, h: 960 }, { w: 900, h: 900 }, { w: 1200, h: 900 }],
        type: 'Fixed',
        description: 'Outdoor DOOH and stadium perimeter. IP68 modules, front or rear service, 960 × 960 / 900 × 900 mm panels, high-temp die-cast frames.',
        badge: 'Outdoor',
        cats: ['outdoor'],
        image: 'assets/products/bako/spaceship.jpg',
        sourceUrl: 'https://www.szbako.com/product/spaceship-series-2-0.html',
        lead: 'Spaceship Series 2.0 is BAKO’s outdoor advertising and perimeter series. Die-cast module frames for high temperature, IP68 modules that can be immersed, front and rear service, and panel sizes 960 × 960, 1280 × 960, 900 × 900, and 1200 × 900 mm.',
        specTable: [
          ['Pixel Pitch', 'P1.86', 'P4', 'P5', 'P6.67', 'P8', 'P10', 'P6.8', 'P8.33', 'P10.7'],
          ['LED', 'SMD1111', 'SMD1515', 'SMD1921', 'SMD2727', 'SMD3535', 'SMD3535', 'SMD2727', 'SMD2727', 'SMD3535'],
          ['Pixel Density (dots/m²)', '289,444', '62,500', '40,000', '22,500', '15,625', '10,000', '21,609', '14,400', '8,649'],
          ['Service', 'Rear', 'Front/rear', 'Front/rear', 'Front/rear', 'Front/rear', 'Front/rear', 'Front/rear', 'Front/rear', 'Front/rear'],
          ['Brightness (nits)', '4000', '4500–5000', '6000–6500', '6000–6500', '6000–6500', '6500–7000', '6000–6500', '6500–7000', '6000–6500'],
          ['Module Size', '320 × 320 mm', '320 × 320 mm', '320 × 320 mm', '320 × 320 mm', '320 × 320 mm', '320 × 320 mm', '300 × 300 mm', '300 × 300 mm', '300 × 300 mm'],
          ['Panel Size', '960 × 960 mm', '960 × 960 mm', '960 × 960 mm', '960 × 960 mm', '960 × 960 mm', '960 × 960 mm', '900 × 900 mm', '900 × 900 mm', '900 × 900 mm'],
          ['Panel Weight', '37 kg', '37 kg', '37 kg', '37 kg', '37 kg', '37 kg', '35 kg', '35 kg', '35 kg'],
          ['Protection', 'IP68 module'],
          ['Average Power', '270 W/m²'],
          ['Max Power', '800 W/m²']
        ]
      },
      {
        id: 'sphere',
        name: 'Spherical LED',
        pitches: [3],
        pricePerM2: 0,
        weightPerM2: 0,
        powerAvg: 270,
        powerMax: 680,
        type: 'Creative',
        description: 'CNC spherical LED, 1500 mm diameter, P3 SMD1515, magnetic modules, 360° viewing. Floor, hoist, or embedded install.',
        badge: 'Creative',
        cats: ['indoor'],
        image: 'assets/products/bako/sphere.jpg',
        sourceUrl: 'https://www.szbako.com/product/spherical-led-screen.html',
        lead: 'BAKO spherical LED with a CNC-machined surface and magnetic modules. 1500 mm diameter, P3 SMD1515, about 111,111 dots/m², 800 nits, 2880–3840 Hz, and floor, hoist, inlaid, or embedded mounting.',
        specTable: [
          ['Pixel Pitch', '3 mm ±10%'],
          ['LED Package', 'SMD1515'],
          ['Sphere Diameter', '1500 mm'],
          ['Pixel Density', 'About 111,111 dots/m²'],
          ['Module Gap', '≤ 0.3 mm'],
          ['Module Fixing', 'Magnetic'],
          ['Contrast', '3000:1'],
          ['Weight', '223 kg'],
          ['Scan', '1/24'],
          ['Brightness', '≥ 800 nits'],
          ['Refresh Rate', '2880–3840 Hz'],
          ['Grayscale', '14 bit'],
          ['Average Power', '270 W/m²'],
          ['Max Power', '680 W/m²'],
          ['Viewing Angle', '160° / 160°'],
          ['Maintenance', 'Front'],
          ['Protection', 'IP20'],
          ['Install', 'Hoist or fixed']
        ]
      },
      {
        id: 'bks',
        name: 'BK-S Stadium',
        pitches: [10],
        pricePerM2: 0,
        weightPerM2: 0,
        powerAvg: 270,
        powerMax: 800,
        type: 'Fixed',
        description: 'Sports perimeter LED, P10, 7000 nits, IP65/IP54, soft-mask player protection, adjustable tilt.',
        badge: 'Stadium',
        cats: ['outdoor'],
        image: 'assets/products/bako/bks.jpg',
        sourceUrl: 'https://www.szbako.com/product/stadium-screen.html',
        lead: 'BK-S Series stadium perimeter screens. Soft rubber sleeve and silicone mask to protect players, adjustable tilt so every seat can see the wall, IP65/IP54, P10 at 7000 nits.',
        specTable: [
          ['Product', 'Stadium screen'],
          ['Pixel Pitch', '10 mm'],
          ['Scan', '1/2'],
          ['Brightness', '7000 nits'],
          ['Module Size', '320 × 160 mm'],
          ['Protection', 'IP65 / IP54'],
          ['Average Power', '270 W/m²'],
          ['Max Power', '800 W/m²']
        ]
      },
      {
        id: 'uhdpro',
        name: 'UHD Pro Series',
        pitches: [1.25, 1.53, 1.86, 2, 2.5, 3.07],
        pricePerM2: 0,
        weightPerM2: 26,
        powerAvg: 180,
        powerMax: 450,
        cabinetW: 0.640,
        cabinetH: 0.480,
        type: 'Fixed',
        description: 'Indoor fixed 640 × 480 mm die-cast panels, 320 × 160 mm modules, 100% front service, 8 kg, 600–800 nits, ≥ 3840 Hz.',
        badge: null,
        cats: ['indoor'],
        image: 'assets/products/bako/uhdpro.jpg',
        sourceUrl: 'https://www.szbako.com/product/uhd-pro-series.html',
        lead: 'UHD Pro is BAKO’s indoor fixed 640 × 480 mm series. Standard 320 × 160 mm modules, 100% front service and front install, 8 kg die-cast panels, and pitches from P1.25 to P3.07.',
        specTable: [
          ['Pixel Pitch', 'P1.25', 'P1.53', 'P1.86', 'P2', 'P2.5', 'P3.07'],
          ['Density (dots/m²)', '640,000', '422,500', '288,906', '250,000', '160,000', '105,625'],
          ['Panel Resolution', '512 × 384', '416 × 312', '344 × 258', '320 × 240', '256 × 192', '208 × 156'],
          ['Module Size', '320 × 160 mm'],
          ['Panel Material', 'Die-casting aluminum'],
          ['Panel Size', '640 × 480 mm'],
          ['Panel Weight', '8 kg'],
          ['Brightness', '600–800 nits'],
          ['Refresh Rate', '≥ 3840 Hz']
        ]
      },
      {
        id: 'bakocarbon',
        name: 'Carbon Fiber Rental',
        pitches: [2.6, 3.91],
        pricePerM2: 0,
        weightPerM2: 21,
        powerAvg: 260,
        powerMax: 680,
        cabinetW: 0.5,
        cabinetH: 0.5,
        cabinets: [{ w: 500, h: 500 }, { w: 1000, h: 500 }],
        type: 'Rental',
        description: 'Ultra-light carbon rental: 500 × 500 mm at 5.3 kg, 1000 × 500 mm at 8.3 kg. Hang or stack, quick lock, auto eject.',
        badge: 'Rental',
        cats: ['rental', 'indoor'],
        image: 'assets/products/bako/carbon.jpg',
        sourceUrl: 'https://www.szbako.com/product/carbon-fiber-rental-display.html',
        lead: 'BAKO carbon-fiber rental panels, 30–40% lighter than conventional rental. 500 × 500 mm at 5.3 kg and 1000 × 500 mm at 8.3 kg, with quick lock, automatic ejection, lightweight handle, hang or stack, and locating pins so a panel can come out without stripping the wall.',
        specTable: [
          ['Pixel Pitch', 'P2.6', 'P3.91'],
          ['LED', 'SMD1515', 'SMD2020'],
          ['Panel Size', '500 × 500 / 1000 × 500 mm'],
          ['Panel Weight', '5.3 kg / 8.3 kg'],
          ['Pixel Density (dots/m²)', '147,456', '65,536'],
          ['Brightness', '600–800 nits', '600–900 nits'],
          ['Scan', '1/24', '1/16'],
          ['Panel Resolution', '192 × 192 / 384 × 192', '128 × 128 / 256 × 128'],
          ['Max Power', '680 W/m²'],
          ['Average Power', '260 W/m²']
        ]
      },
      {
        id: 'tpro',
        name: 'T-Pro Transparent',
        pitches: [2.8, 3.9, 5.2],
        pricePerM2: 0,
        weightPerM2: 21,
        powerAvg: 230,
        powerMax: 800,
        cabinetW: 1.0,
        cabinetH: 0.5,
        type: 'Transparent',
        description: 'Transparent rental, 66% transmittance, 1000 × 500 × 65 mm die-cast panels. Indoor 1000 nits / outdoor 4500 nits, IP65/IP54.',
        badge: 'Transparent',
        cats: ['rental', 'indoor', 'outdoor'],
        image: 'assets/products/bako/tpro.jpg',
        sourceUrl: 'https://www.szbako.com/product/t-pro-series.html',
        lead: 'T-Pro transparent rental with 66% transmittance for façades and glass. 500 × 125 mm modules in 1000 × 500 × 65 mm panels, about 10.5 kg, IP65/IP54 outdoor, and 38% lower energy than a conventional LED wall.',
        specTable: [
          ['Model', 'T-Pro 0205O', 'T-Pro 0307O', 'T-Pro 0510O', 'T-Pro 0205I', 'T-Pro 0307I'],
          ['Application', 'Outdoor', 'Outdoor', 'Outdoor', 'Indoor', 'Indoor'],
          ['Pixel Pitch (mm)', '2.8 × 5.6', '3.9 × 7.8', '5.2 × 10.4', '2.8 × 5.6', '3.9 × 7.8'],
          ['Module Size', '500 × 125 × 12 mm'],
          ['Panel Size', '1000 × 500 × 65 mm'],
          ['Panel Resolution', '352 × 88', '256 × 128', '192 × 96', '352 × 88', '256 × 128'],
          ['Panel Weight', '10.5 kg'],
          ['Brightness', '4500 nits', '4500 nits', '4500 nits', '1000 nits', '1000 nits'],
          ['Grayscale', '14–16 bit'],
          ['Max Power', '800 W/m²'],
          ['Average Power', '230 W/m²'],
          ['Viewing Angle', '160° / 160°'],
          ['Refresh Rate', '1920 / 3840 Hz'],
          ['Transmittance', '66%'],
          ['Protection', 'IP65 / IP54']
        ]
      },
      {
        id: 'indoor480',
        name: 'Indoor Fixed 480×480',
        pitches: [],
        pricePerM2: 0,
        weightPerM2: 28,
        powerAvg: 180,
        powerMax: 450,
        cabinetW: 0.480,
        cabinetH: 0.480,
        type: 'Fixed',
        description: 'High-end indoor 480 × 480 mm die-cast panels, 240 × 240 mm modules, 3840 Hz, fanless, front and rear service.',
        badge: null,
        cats: ['indoor'],
        image: 'assets/products/bako/indoorfixed.jpg',
        sourceUrl: 'https://www.szbako.com/product/high-end-indoor-fixed-series.html',
        lead: 'BAKO high-end indoor fixed 480 × 480 mm panels with 240 × 240 mm modules. Die-cast aluminum, CNC seamless joins, fanless, board-to-board hub (no cable transfer), four-corner anti-bump, and 100% front install with front or rear maintenance.',
        specTable: [
          ['Panel Size', '480 × 480 mm'],
          ['Module Size', '240 × 240 mm'],
          ['Refresh Rate', '3840 Hz'],
          ['Panel Material', 'Die-casting aluminum'],
          ['Maintenance', 'Front and rear'],
          ['Install', '100% front installation'],
          ['Cooling', 'Fanless']
        ]
      }
    ]
  },
  diao: {
    name: 'DIAO',
    tagline: 'Spectrum exclusive - value fixed install',
    series: [
      {
        id: 'pro',
        name: 'DIAO Pro Fixed',
        pitches: [1.5, 1.8, 2.5],
        pricePerM2: 980,
        weightPerM2: 30,
        powerAvg: 170,
        powerMax: 425,
        cabinetW: 0.500,
        cabinetH: 0.500,
        type: 'Fixed',
        description: 'Exclusive Spectrum fixed install with strong value.',
        badge: 'Exclusive',
        cats: ['indoor', 'popular'],
        image: 'assets/products/diao-pro.jpg'
      },
      {
        id: 'value',
        name: 'DIAO Value',
        pitches: [2.5, 3.0, 4.0],
        pricePerM2: 720,
        weightPerM2: 32,
        powerAvg: 200,
        powerMax: 500,
        cabinetW: 0.500,
        cabinetH: 0.500,
        type: 'Fixed',
        description: 'Budget-friendly fixed walls for commercial spaces.',
        badge: 'Exclusive',
        cats: ['outdoor'],
        image: 'assets/products/diao-value.jpg'
      }
    ]
  },
  element: {
    name: 'Element',
    tagline: 'Spectrum exclusive - rental & creative',
    series: [
      {
        id: 'rental',
        name: 'Element Rental',
        pitches: [2.6, 2.9, 3.9],
        pricePerM2: 1050,
        weightPerM2: 18,
        powerAvg: 210,
        powerMax: 525,
        cabinetW: 0.500,
        cabinetH: 0.500,
        type: 'Rental',
        description: 'Exclusive lightweight rental for events.',
        badge: 'Exclusive',
        cats: ['rental'],
        image: 'assets/products/element-rental.jpg'
      },
      {
        id: 'creative',
        name: 'Element Creative / XR',
        pitches: [1.9, 2.6],
        pricePerM2: 1380,
        weightPerM2: 19,
        powerAvg: 190,
        powerMax: 475,
        cabinetW: 0.500,
        cabinetH: 0.500,
        type: 'Creative',
        description: 'Creative and XR volumes with flexible form factors.',
        badge: 'Creative',
        cats: ['indoor'],
        image: 'assets/products/element-creative.jpg'
      }
    ]
  }
};

/** Extra mega-menu category tags so products.html?cat= indoor-rental etc. filter correctly. */
window.spectrumCatsFor = function (p) {
  var set = {};
  function add(c) {
    String(c || '').split(/\s+/).forEach(function (x) {
      if (x) set[x] = true;
    });
  }
  if (p && p.cats) {
    if (Array.isArray(p.cats)) p.cats.forEach(add);
    else add(p.cats);
  }
  var extra = {
    discovery: 'cob fixed-indoor',
    ledposter: 'posters',
    mvultra: 'indoor-rental',
    dnin: 'indoor-rental',
    dn: 'outdoor-rental outdoor-fixed',
    vanish: 'transparent outdoor-rental',
    vamax: 'transparent outdoor-rental',
    cbmax: 'transparent outdoor-rental',
    crmax: 'outdoor-rental',
    af2: 'cob fixed-indoor',
    aw: 'cob fixed-indoor',
    blade: 'fixed-indoor',
    gposter: 'posters',
    gposterplus: 'posters',
    arpro: 'indoor-rental outdoor-rental',
    cfpro: 'indoor-rental creative',
    cfpro2: 'indoor-rental outdoor-rental creative',
    rbb: 'indoor-rental creative',
    ur: 'indoor-rental outdoor-rental',
    carbon: 'indoor-rental outdoor-rental',
    mvpro: 'indoor-rental creative',
    mt55: 'indoor-rental creative',
    mt2: 'creative',
    mtedge: 'creative',
    cs2: 'creative',
    mr: 'creative',
    ra2: 'fixed-indoor',
    zs3: 'outdoor-fixed',
    zspro: 'outdoor-fixed outdoor-rental',
    gp: 'outdoor-fixed',
    legend: 'outdoor-rental',
    finepitch: 'cob fixed-indoor',
    allinone: 'cob fixed-indoor',
    rentalcob: 'cob indoor-rental outdoor-rental',
    diamond4: 'indoor-rental outdoor-rental',
    flyingdrone: 'fixed-indoor cob',
    bakoposter: 'posters',
    spaceship: 'outdoor-fixed',
    sphere: 'creative',
    bks: 'outdoor-fixed',
    uhdpro: 'fixed-indoor',
    bakocarbon: 'indoor-rental',
    tpro: 'transparent indoor-rental outdoor-rental',
    indoor480: 'fixed-indoor',
    pro: 'fixed-indoor',
    value: 'outdoor-fixed',
    rental: 'indoor-rental',
    creative: 'creative'
  };
  if (p && extra[p.id]) add(extra[p.id]);
  if (p && p.type === 'control') {
    add('control');
    if (p.subtype) add(p.subtype);
    if (p.subtype === 'receiving-card') add('receiving-cards');
  }
  return Object.keys(set);
};

/** Flat list helper for product cards */
window.SPECTRUM_PRODUCT_LIST = (function () {
  const list = [];
  const data = window.SPECTRUM_PRODUCTS;
  Object.keys(data).forEach(function (brandId) {
    const brand = data[brandId];
    brand.series.forEach(function (s) {
      list.push(Object.assign({}, s, {
        brandId: brandId,
        brandName: brand.name,
        pitchLabel: (s.pitches && s.pitches.length)
          ? s.pitches[0] + (s.pitches.length > 1 ? '–' + s.pitches[s.pitches.length - 1] : '') + ' mm'
          : '',
        priceLabel: (function () {
          var n = (s.type === 'control') ? (Number(s.priceEach) || 0) : (Number(s.pricePerM2) || 0);
          return n ? ('From $' + n.toLocaleString()) : 'Request quote';
        })()
      }));
    });
  });
  return list;
})();

/** Lookup by brandId + series id */
window.getSpectrumSeries = function (brandId, seriesId) {
  const brand = window.SPECTRUM_PRODUCTS[brandId];
  if (!brand) return null;
  return brand.series.find(function (s) { return s.id === seriesId; }) || null;
};
