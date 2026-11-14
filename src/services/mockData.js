// src/services/mockData.js
// Catálogo semilla y datos locales para funcionamiento offline / autónomo de Subligol

export const INITIAL_CATEGORIAS = [
  {
    id: 'cat-tazas',
    nombre: 'Tazas y Tazones',
    descripcion: 'Tazas de cerámica, mágicas, polímero y vidrio esmerilado para sublimación',
    icono: 'Coffee',
    imagen: 'https://images.unsplash.com/photo-1514432324607-a09d9b4aefdd?auto=format&fit=crop&w=800&q=80'
  },
  {
    id: 'cat-textiles',
    nombre: 'Poleras y Textiles',
    descripcion: 'Poleras tacto algodón, polerones, tote bags y jockey listos para estampar',
    icono: 'Shirt',
    imagen: 'https://images.unsplash.com/photo-1521572267360-ee0c2909d518?auto=format&fit=crop&w=800&q=80'
  },
  {
    id: 'cat-botellas',
    nombre: 'Botellas y Shakers',
    descripcion: 'Botellas de aluminio, térmicas con doble pared y botellas deportivas',
    icono: 'FlaskConical',
    imagen: 'https://images.unsplash.com/photo-1602143407151-7111542de6e8?auto=format&fit=crop&w=800&q=80'
  },
  {
    id: 'cat-regalos',
    nombre: 'Papelería y Regalos',
    descripcion: 'Agendas personalizadas, llaveros MDF, mousepads ergonómicos y puzzles',
    icono: 'Gift',
    imagen: 'https://images.unsplash.com/photo-1583847268964-b28dc8f51f92?auto=format&fit=crop&w=800&q=80'
  },
  {
    id: 'cat-insumos',
    nombre: 'Insumos y Blancos',
    descripcion: 'Cajas para tazas, cintas térmicas, papel de sublimación y tintas especiales',
    icono: 'Package',
    imagen: 'https://images.unsplash.com/photo-1586528116311-ad8dd3c8310d?auto=format&fit=crop&w=800&q=80'
  }
]

export const INITIAL_PRODUCTOS = [
  {
    id: 'prod-001',
    sku: 'TAZA-BLA-11',
    nombre: 'Taza Cerámica Blanca 11oz Calidad AAA',
    descripcion: 'Taza blanca estándar de 11 oz con polímero de alta absorción para acabados fotográficos nítidos.',
    descripcion_larga: 'Diseñada especialmente para sublimación profesional. El recubrimiento de polímero premium grado AAA asegura colores vivos, alta resistencia a lavados continuos y microondas. Ideal para merchandising corporativo, eventos familiares o regalos personalizados.',
    categoria_id: 'cat-tazas',
    categoria_nombre: 'Tazas y Tazones',
    temporada: 'General',
    costo_unitario: 1200,
    precio_venta: 4500,
    stock_actual: 42,
    stock_minimo: 10,
    activo: true,
    destacado: true,
    imagen_url: 'https://images.unsplash.com/photo-1514432324607-a09d9b4aefdd?auto=format&fit=crop&w=800&q=80',
    imagenes_galeria: [
      'https://images.unsplash.com/photo-1514432324607-a09d9b4aefdd?auto=format&fit=crop&w=800&q=80',
      'https://images.unsplash.com/photo-1577937927133-66ef06acdf18?auto=format&fit=crop&w=800&q=80'
    ],
    especificaciones: {
      material: 'Cerámica con recubrimiento polimérico AAA',
      capacidad: '11 oz (325 ml)',
      temperatura_sublimacion: '180°C - 200°C',
      tiempo_estampado: '180 segundos',
      presion: 'Media - Fuerte'
    }
  },
  {
    id: 'prod-002',
    sku: 'TAZA-MAG-11',
    nombre: 'Taza Mágica Termosensible Negra 11oz',
    descripcion: 'Taza negra mate que revela la fotografía impresa al contacto con líquidos calientes.',
    descripcion_larga: 'Fabricada con pigmentos termosensibles de última generación. En frío permanece en un sobrio color negro satinado y al verter café, té o agua hirviendo, revela gradualmente el diseño sublimado. Una de las opciones más solicitadas para fechas conmemorativas.',
    categoria_id: 'cat-tazas',
    categoria_nombre: 'Tazas y Tazones',
    temporada: 'Día de la Madre',
    costo_unitario: 2200,
    precio_venta: 7500,
    stock_actual: 8,
    stock_minimo: 10, // Stock crítico para pruebas
    activo: true,
    destacado: true,
    imagen_url: 'https://images.unsplash.com/photo-1517256064527-09c73fc73e38?auto=format&fit=crop&w=800&q=80',
    imagenes_galeria: [
      'https://images.unsplash.com/photo-1517256064527-09c73fc73e38?auto=format&fit=crop&w=800&q=80',
      'https://images.unsplash.com/photo-1577937927133-66ef06acdf18?auto=format&fit=crop&w=800&q=80'
    ],
    especificaciones: {
      material: 'Cerámica termosensible negro mate',
      capacidad: '11 oz (325 ml)',
      temperatura_sublimacion: '185°C',
      tiempo_estampado: '190 segundos',
      presion: 'Media'
    }
  },
  {
    id: 'prod-003',
    sku: 'POL-BLA-M',
    nombre: 'Polera Tacto Algodón Spun Blanca Talla M',
    descripcion: 'Polera 100% poliéster hilado con tacto idéntico al algodón peinado, sin brillo sintético.',
    descripcion_larga: 'Confeccionada con tela poliéster spun de 180 grs. Permite una sublimación que penetra directamente en las fibras, logrando que el estampado sea imperceptible al tacto e indeleble a los lavados. Cuello reforzado y costuras dobles.',
    categoria_id: 'cat-textiles',
    categoria_nombre: 'Poleras y Textiles',
    temporada: 'General',
    costo_unitario: 2800,
    precio_venta: 8990,
    stock_actual: 25,
    stock_minimo: 5,
    activo: true,
    destacado: true,
    imagen_url: 'https://images.unsplash.com/photo-1521572267360-ee0c2909d518?auto=format&fit=crop&w=800&q=80',
    imagenes_galeria: [
      'https://images.unsplash.com/photo-1521572267360-ee0c2909d518?auto=format&fit=crop&w=800&q=80',
      'https://images.unsplash.com/photo-1583743814966-8936f5b7be1a?auto=format&fit=crop&w=800&q=80'
    ],
    especificaciones: {
      material: '100% Poliéster Spun 180 grs',
      talla: 'M (Ancho 51cm x Largo 71cm)',
      temperatura_sublimacion: '195°C',
      tiempo_estampado: '50 - 60 segundos',
      presion: 'Media'
    }
  },
  {
    id: 'prod-004',
    sku: 'POL-BLA-L',
    nombre: 'Polera Tacto Algodón Spun Blanca Talla L',
    descripcion: 'Prenda cómoda de alta durabilidad para sublimación full print o estampados centrados.',
    descripcion_larga: 'Excelente caída y respirabilidad. Compatible con tintas de sublimación de alta densidad para obtener negros profundos y gama de colores saturados.',
    categoria_id: 'cat-textiles',
    categoria_nombre: 'Poleras y Textiles',
    temporada: 'General',
    costo_unitario: 2900,
    precio_venta: 8990,
    stock_actual: 18,
    stock_minimo: 5,
    activo: true,
    destacado: false,
    imagen_url: 'https://images.unsplash.com/photo-1583743814966-8936f5b7be1a?auto=format&fit=crop&w=800&q=80',
    imagenes_galeria: [
      'https://images.unsplash.com/photo-1583743814966-8936f5b7be1a?auto=format&fit=crop&w=800&q=80'
    ],
    especificaciones: {
      material: '100% Poliéster Spun 180 grs',
      talla: 'L (Ancho 54cm x Largo 74cm)',
      temperatura_sublimacion: '195°C',
      tiempo_estampado: '55 segundos',
      presion: 'Media'
    }
  },
  {
    id: 'prod-005',
    sku: 'BOT-ALU-600',
    nombre: 'Botella Deportiva Aluminio 600ml Plateada',
    descripcion: 'Botella liviana con mosquetón metálico para enganchar en mochilas escolares o de trekking.',
    descripcion_larga: 'Botella libre de BPA con tapa a rosca antigoteo y boquilla ergonómica. Recubrimiento especial para sublimación en prensa de tazas o resistencia cilíndrica delgada.',
    categoria_id: 'cat-botellas',
    categoria_nombre: 'Botellas y Shakers',
    temporada: 'Escolar',
    costo_unitario: 2500,
    precio_venta: 6990,
    stock_actual: 30,
    stock_minimo: 6,
    activo: true,
    destacado: true,
    imagen_url: 'https://images.unsplash.com/photo-1602143407151-7111542de6e8?auto=format&fit=crop&w=800&q=80',
    imagenes_galeria: [
      'https://images.unsplash.com/photo-1602143407151-7111542de6e8?auto=format&fit=crop&w=800&q=80'
    ],
    especificaciones: {
      material: 'Aluminio anodizado grado alimentario',
      capacidad: '600 ml',
      temperatura_sublimacion: '180°C',
      tiempo_estampado: '120 segundos',
      presion: 'Media'
    }
  },
  {
    id: 'prod-006',
    sku: 'BOT-TER-500',
    nombre: 'Botella Térmica Doble Pared Inox 500ml Blanca',
    descripcion: 'Mantiene bebidas frías por 24 horas y calientes por 12 horas. Acabado blanco brillo.',
    descripcion_larga: 'Aislación al vacío con acero inoxidable 304. Máxima resistencia a golpes y libre de condensación exterior. Proporciona una terminación visual de alta gama con sublimación envolvente.',
    categoria_id: 'cat-botellas',
    categoria_nombre: 'Botellas y Shakers',
    temporada: 'Verano',
    costo_unitario: 4200,
    precio_venta: 11990,
    stock_actual: 15,
    stock_minimo: 4,
    activo: true,
    destacado: true,
    imagen_url: 'https://images.unsplash.com/photo-1544816155-12df9643f363?auto=format&fit=crop&w=800&q=80',
    imagenes_galeria: [
      'https://images.unsplash.com/photo-1544816155-12df9643f363?auto=format&fit=crop&w=800&q=80'
    ],
    especificaciones: {
      material: 'Acero Inoxidable 304 doble capa al vacío',
      capacidad: '500 ml',
      temperatura_sublimacion: '185°C',
      tiempo_estampado: '150 segundos',
      presion: 'Media - Fuerte'
    }
  },
  {
    id: 'prod-007',
    sku: 'NAV-MDF-01',
    nombre: 'Adorno Navideño Colgante MDF Sublimable',
    descripcion: 'Colgante decorativo para árbol de navidad con cordón dorado y brillo gloss.',
    descripcion_larga: 'Madera MDF prensada tratada con resina de poliéster. Permite estampar retratos familiares, nombres o logos con gran definición de detalle.',
    categoria_id: 'cat-regalos',
    categoria_nombre: 'Papelería y Regalos',
    temporada: 'Navidad',
    costo_unitario: 450,
    precio_venta: 1990,
    stock_actual: 0, // Agotado para probar alertas y estado en UI
    stock_minimo: 10,
    activo: true,
    destacado: false,
    imagen_url: 'https://images.unsplash.com/photo-1512474932049-78ac69eed10c?auto=format&fit=crop&w=800&q=80',
    imagenes_galeria: [
      'https://images.unsplash.com/photo-1512474932049-78ac69eed10c?auto=format&fit=crop&w=800&q=80'
    ],
    especificaciones: {
      material: 'MDF 3mm con barniz de poliéster',
      diametro: '8 cm',
      temperatura_sublimacion: '190°C',
      tiempo_estampado: '60 segundos',
      presion: 'Fuerte'
    }
  },
  {
    id: 'prod-008',
    sku: 'REG-PUZ-A4',
    nombre: 'Puzzle Rompecabezas Sublimable Cartón A4',
    descripcion: 'Puzzle de 120 piezas con base de cartón rígido y acabado perlado de alto contraste.',
    descripcion_larga: 'Ideal para recuerdos fotográficos, propuestas originales o regalos infantiles. Se entrega armado sobre plancha protectora listo para prensar.',
    categoria_id: 'cat-regalos',
    categoria_nombre: 'Papelería y Regalos',
    temporada: 'Día del Niño',
    costo_unitario: 1100,
    precio_venta: 4990,
    stock_actual: 22,
    stock_minimo: 8,
    activo: true,
    destacado: false,
    imagen_url: 'https://images.unsplash.com/photo-1588702547923-7093a6c3ba33?auto=format&fit=crop&w=800&q=80',
    imagenes_galeria: [
      'https://images.unsplash.com/photo-1588702547923-7093a6c3ba33?auto=format&fit=crop&w=800&q=80'
    ],
    especificaciones: {
      material: 'Cartón prensado perlado 2mm',
      tamano: 'A4 (20 x 29 cm) - 120 piezas',
      temperatura_sublimacion: '185°C',
      tiempo_estampado: '50 segundos',
      presion: 'Media'
    }
  },
  {
    id: 'prod-009',
    sku: 'REG-MOU-REC',
    nombre: 'Mousepad Ergonómico Rectangular Antideslizante',
    descripcion: 'Mousepad de tela de microfibra suave sobre base de caucho natural antideslizante.',
    descripcion_larga: 'Excelente precisión para mouse ópticos y gamers. La superficie textil blanca recibe la tinta con absoluta fidelidad cromática sin desteñir por roce continuo.',
    categoria_id: 'cat-regalos',
    categoria_nombre: 'Papelería y Regalos',
    temporada: 'General',
    costo_unitario: 800,
    precio_venta: 3490,
    stock_actual: 35,
    stock_minimo: 10,
    activo: true,
    destacado: true,
    imagen_url: 'https://images.unsplash.com/photo-1615663245857-ac93bb7c39e7?auto=format&fit=crop&w=800&q=80',
    imagenes_galeria: [
      'https://images.unsplash.com/photo-1615663245857-ac93bb7c39e7?auto=format&fit=crop&w=800&q=80'
    ],
    especificaciones: {
      material: 'Tela microfibra + base goma EVA / Caucho',
      dimensiones: '22 cm x 18 cm x 3 mm',
      temperatura_sublimacion: '190°C',
      tiempo_estampado: '45 segundos',
      presion: 'Fuerte'
    }
  },
  {
    id: 'prod-010',
    sku: 'INS-PAP-A4',
    nombre: 'Resma Papel de Sublimación Premium Secado Rápido A4',
    descripcion: 'Pack 100 hojas de papel transfer de 100 grs con transferencia térmica superior al 98%.',
    descripcion_larga: 'Papel microporoso formulado para evitar sombras y migración de tinta. Secado instantáneo al imprimir, reduciendo manchas por arrastre en los rodillos.',
    categoria_id: 'cat-insumos',
    categoria_nombre: 'Insumos y Blancos',
    temporada: 'General',
    costo_unitario: 3500,
    precio_venta: 6990,
    stock_actual: 14,
    stock_minimo: 5,
    activo: true,
    destacado: false,
    imagen_url: 'https://images.unsplash.com/photo-1586528116311-ad8dd3c8310d?auto=format&fit=crop&w=800&q=80',
    imagenes_galeria: [
      'https://images.unsplash.com/photo-1586528116311-ad8dd3c8310d?auto=format&fit=crop&w=800&q=80'
    ],
    especificaciones: {
      formato: 'A4 (21 x 29.7 cm)',
      gramaje: '100 grs/m²',
      contenido: '100 hojas',
      compatibilidad: 'Plotters y EPSON EcoTank'
    }
  },
  {
    id: 'prod-011',
    sku: 'INS-CIN-06',
    nombre: 'Cinta Térmica Alta Temperatura 6mm x 33m',
    descripcion: 'Cinta adhesiva de poliimida resistente hasta 260°C. No deja residuos de pegamento.',
    descripcion_larga: 'Fija con seguridad los diseños sobre tazas, telas y metales durante el prensado térmico sin manchar ni derretirse.',
    categoria_id: 'cat-insumos',
    categoria_nombre: 'Insumos y Blancos',
    temporada: 'General',
    costo_unitario: 900,
    precio_venta: 2200,
    stock_actual: 50,
    stock_minimo: 12,
    activo: true,
    destacado: false,
    imagen_url: 'https://images.unsplash.com/photo-1589939705384-5185137a7f0f?auto=format&fit=crop&w=800&q=80',
    imagenes_galeria: [
      'https://images.unsplash.com/photo-1589939705384-5185137a7f0f?auto=format&fit=crop&w=800&q=80'
    ],
    especificaciones: {
      resistencia: 'Hasta 260°C continuos',
      medidas: '6 mm de ancho x 33 metros de largo',
      material: 'Film Poliimida color ámbar'
    }
  },
  {
    id: 'prod-012',
    sku: 'TEX-JOC-TRU',
    nombre: 'Jockey Trucker Frente Blanco Malla Colores',
    descripcion: 'Gorro tipo camionero con esponja frontal acolchada para sublimación y broche ajustable.',
    descripcion_larga: 'Estructura rígida de 5 paneles con frente 100% poliéster blanco puro. Perfecto para eventos, comparsas, fiestas patrias y promociones corporativas.',
    categoria_id: 'cat-textiles',
    categoria_nombre: 'Poleras y Textiles',
    temporada: 'Fiestas Patrias',
    costo_unitario: 1500,
    precio_venta: 4990,
    stock_actual: 19,
    stock_minimo: 6,
    activo: true,
    destacado: true,
    imagen_url: 'https://images.unsplash.com/photo-1588850561407-ed78c282e89b?auto=format&fit=crop&w=800&q=80',
    imagenes_galeria: [
      'https://images.unsplash.com/photo-1588850561407-ed78c282e89b?auto=format&fit=crop&w=800&q=80'
    ],
    especificaciones: {
      material: 'Frente poliéster espumado + malla respirable',
      ajuste: 'Broche plástico snapback',
      temperatura_sublimacion: '185°C',
      tiempo_estampado: '40 segundos',
      presion: 'Fuerte con horma para gorros'
    }
  }
]

// Funciones para gestionar el almacén local cuando no hay Supabase
const LOCAL_STORAGE_PROD_KEY = 'subligol_products_local'
const LOCAL_STORAGE_ORDERS_KEY = 'subligol_orders_local'

export function getLocalProductos() {
  const saved = localStorage.getItem(LOCAL_STORAGE_PROD_KEY)
  if (!saved) {
    localStorage.setItem(LOCAL_STORAGE_PROD_KEY, JSON.stringify(INITIAL_PRODUCTOS))
    return INITIAL_PRODUCTOS
  }
  try {
    return JSON.parse(saved)
  } catch {
    return INITIAL_PRODUCTOS
  }
}

export function saveLocalProductos(productos) {
  localStorage.setItem(LOCAL_STORAGE_PROD_KEY, JSON.stringify(productos))
}

export function getLocalOrders() {
  const saved = localStorage.getItem(LOCAL_STORAGE_ORDERS_KEY)
  if (!saved) return []
  try {
    return JSON.parse(saved)
  } catch {
    return []
  }
}

export function saveLocalOrder(order) {
  const orders = getLocalOrders()
  const updated = [order, ...orders]
  localStorage.setItem(LOCAL_STORAGE_ORDERS_KEY, JSON.stringify(updated))
  return order
}
