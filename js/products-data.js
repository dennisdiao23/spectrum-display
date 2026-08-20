/**
 * Spectrum Display - Single source of truth for product catalog
 * Edit this file to update Project Designer, Products page, and product details.
 * Add image: 'assets/products/yourfile.jpg' for product photos.
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
    tagline: 'Rental, transparent & outdoor',
    series: [
      {
        id: 'mvultra',
        name: 'MV Ultra (Rental)',
        pitches: [1.5, 1.9, 2.6],
        pricePerM2: 1450,
        weightPerM2: 22,
        powerAvg: 200,
        powerMax: 500,
        cabinetW: 0.500,
        cabinetH: 0.500,
        type: 'Rental',
        description: 'Fast-deploy rental panels for events and touring.',
        badge: 'Rental',
        cats: ['rental', 'popular'],
        image: 'assets/products/mvultra.jpg'
      },
      {
        id: 'dn',
        name: 'DN Outdoor',
        pitches: [2.6, 2.97, 3.91],
        pricePerM2: 1280,
        weightPerM2: 35,
        powerAvg: 280,
        powerMax: 700,
        cabinetW: 0.500,
        cabinetH: 0.500,
        type: 'Outdoor',
        description: 'High-brightness outdoor facades and DOOH.',
        badge: null,
        cats: ['outdoor'],
        image: 'assets/products/dn.jpg'
      }
    ]
  },
  bako: {
    name: 'BAKO',
    tagline: 'Ultra-fine pitch COB',
    series: [
      {
        id: 'finepitch',
        name: 'Fine Pitch COB 600x337.5',
        pitches: [0.93, 1.25, 1.56, 1.87],
        pricePerM2: 3200,
        weightPerM2: 25,
        powerAvg: 120,
        powerMax: 300,
        cabinetW: 0.600,
        cabinetH: 0.3375,
        type: 'Fixed',
        description: 'Control-room grade micro pitch COB cabinets.',
        badge: null,
        cats: ['cob', 'indoor', 'popular'],
        image: 'assets/products/finepitch.jpg'
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
        pitchLabel: s.pitches[0] + '–' + s.pitches[s.pitches.length - 1] + ' mm',
        priceLabel: 'From $' + s.pricePerM2.toLocaleString()
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
