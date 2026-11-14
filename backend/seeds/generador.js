/**
 * Generador determinista de datos semilla para Subligol.
 *
 * Con la misma semilla produce exactamente los mismos datos (incluidos los
 * UUID), para que las pruebas de carga sean reproducibles. No accede a la
 * base de datos: solo construye objetos en memoria.
 */

/**
 * Fecha de referencia por defecto: hoy a las 00:00 UTC. El historial de
 * ventas y compras se genera hacia atrás desde aquí, así la ventana de
 * "últimos 90 días" siempre tiene datos sin importar cuándo se siembre.
 * Solo se desplazan las fechas: productos, precios, cantidades y UUID son
 * idénticos para la misma semilla.
 * @param {Date} [ahora]
 * @returns {Date}
 */
export function fechaBaseHoy(ahora = new Date()) {
  return new Date(Date.UTC(ahora.getUTCFullYear(), ahora.getUTCMonth(), ahora.getUTCDate()))
}

export const TOTAL_PRODUCTOS = 500
export const TOTAL_CLIENTES = 200
export const TOTAL_VENTAS = 3000
export const TOTAL_COMPRAS = 120
export const TOTAL_DESTACADOS = 12

/**
 * Generador pseudoaleatorio mulberry32 (rápido y reproducible).
 * @param {number} semilla
 */
export function crearAzar(semilla) {
  let a = semilla >>> 0
  /** @returns {number} número en [0, 1) */
  const siguiente = () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
  return {
    siguiente,
    /** Entero en [min, max]. */
    entero: (min, max) => min + Math.floor(siguiente() * (max - min + 1)),
    /** Elemento al azar de una lista. */
    elegir: (lista) => lista[Math.floor(siguiente() * lista.length)],
    /** Elemento según pesos: [[valor, peso], ...]. */
    ponderado: (pares) => {
      const total = pares.reduce((s, [, p]) => s + p, 0)
      let r = siguiente() * total
      for (const [valor, peso] of pares) {
        r -= peso
        if (r < 0) return valor
      }
      return pares[pares.length - 1][0]
    },
    /** UUID v4 con formato válido, derivado de la semilla. */
    uuid: () => {
      const b = Array.from({ length: 16 }, () => Math.floor(siguiente() * 256))
      b[6] = (b[6] & 0x0f) | 0x40
      b[8] = (b[8] & 0x3f) | 0x80
      const h = b.map((x) => x.toString(16).padStart(2, '0')).join('')
      return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`
    }
  }
}

const img = (id) => `https://images.unsplash.com/photo-${id}?auto=format&fit=crop&w=800&q=80`

/**
 * Catálogo base: categorías, tipos de producto (con costo base en CLP),
 * imágenes y especificaciones por categoría.
 */
const CATALOGO = [
  {
    clave: 'TAZ',
    nombre: 'Tazas y Tazones',
    descripcion: 'Tazas de cerámica, mágicas, polímero y vidrio esmerilado',
    imagenes: [img('1514432324607-a09d9b4aefdd'), img('1517256064527-09c73fc73e38'), img('1577937927133-66ef06acdf18')],
    tipos: [
      ['Taza Cerámica Blanca 11oz', 1200], ['Taza Mágica Negra 11oz', 2200], ['Taza Cerámica 15oz', 1700],
      ['Tazón Polímero Infantil', 1100], ['Taza Vidrio Esmerilado', 2400], ['Taza Interior Color', 1600],
      ['Taza Enlozada', 2000], ['Taza Cónica 12oz', 1900]
    ],
    especificaciones: { material: 'Cerámica con recubrimiento polimérico AAA', temperatura_sublimacion: '180°C - 200°C', tiempo_estampado: '180 segundos' }
  },
  {
    clave: 'TEX',
    nombre: 'Poleras y Textiles',
    descripcion: 'Poleras tacto algodón, polerones, tote bags y jockey',
    imagenes: [img('1521572267360-ee0c2909d518'), img('1583743814966-8936f5b7be1a'), img('1588850561407-ed78c282e89b')],
    tipos: [
      ['Polera Tacto Algodón', 2800], ['Polerón Canguro', 7500], ['Tote Bag Lona', 1800], ['Jockey Malla', 1600],
      ['Delantal de Cocina', 2200], ['Cojín Satinado 40x40', 2500], ['Body Bebé', 2100]
    ],
    especificaciones: { material: '100% poliéster tacto algodón', temperatura_sublimacion: '190°C - 200°C', tiempo_estampado: '45 segundos' }
  },
  {
    clave: 'BOT',
    nombre: 'Botellas y Shakers',
    descripcion: 'Botellas de aluminio, térmicas y botellas deportivas',
    imagenes: [img('1602143407151-7111542de6e8'), img('1544816155-12df9643f363')],
    tipos: [
      ['Botella Aluminio 600ml', 2500], ['Botella Térmica 500ml', 4800], ['Shaker Deportivo 700ml', 2300],
      ['Vaso Térmico 20oz', 4200], ['Botella Infantil 350ml', 2000]
    ],
    especificaciones: { material: 'Aluminio con recubrimiento sublimable', temperatura_sublimacion: '180°C', tiempo_estampado: '60 segundos' }
  },
  {
    clave: 'REG',
    nombre: 'Papelería y Regalos',
    descripcion: 'Agendas personalizadas, llaveros, mousepads y puzzles',
    imagenes: [img('1512474932049-78ac69eed10c'), img('1588702547923-7093a6c3ba33'), img('1615663245857-ac93bb7c39e7')],
    tipos: [
      ['Mousepad Rectangular', 900], ['Llavero MDF', 350], ['Puzzle A4', 1300], ['Agenda A5', 2600],
      ['Adorno Colgante MDF', 450], ['Cuadro Aluminio 20x30', 3200], ['Posavasos Cerámica', 700]
    ],
    especificaciones: { material: 'MDF / aluminio / neopreno según modelo', temperatura_sublimacion: '180°C - 200°C', tiempo_estampado: '60 - 90 segundos' }
  },
  {
    clave: 'INS',
    nombre: 'Insumos y Blancos',
    descripcion: 'Cajas para tazas, cintas térmicas y papel de sublimación',
    imagenes: [img('1586528116311-ad8dd3c8310d'), img('1589939705384-5185137a7f0f'), img('1583847268964-b28dc8f51f92')],
    tipos: [
      ['Papel Sublimación A4 (100 hojas)', 3500], ['Cinta Térmica 10mm', 1500], ['Caja para Taza', 250],
      ['Tinta Sublimación 100ml', 4500], ['Teflón Protector 40x60', 2900], ['Funda Silicona para Taza', 3800]
    ],
    especificaciones: { uso: 'Insumo para sublimación', compatibilidad: 'Plancha y horno de sublimación' }
  }
]

const COLORES = ['Blanco', 'Negro', 'Rojo', 'Azul', 'Rosado', 'Verde', 'Amarillo', 'Gris', 'Celeste', 'Morado']

/** Diseño → temporada (las temporadas coinciden con los filtros de la tienda). */
const DISENOS = [
  ['Navidad', 'Navidad'], ['Día de la Madre', 'Día de la Madre'], ['Día del Padre', 'Día del Padre'],
  ['Día del Niño', 'Día del Niño'], ['Fiestas Patrias', 'Fiestas Patrias'], ['Escolar', 'Escolar'],
  ['Verano', 'Verano'], ['Fútbol', 'General'], ['Anime', 'General'], ['Mascotas', 'General'],
  ['Corporativo', 'General'], ['Minimalista', 'General'], ['Floral', 'General'], ['Frases', 'General']
]

const NOMBRES = ['Camila', 'Valentina', 'Sofía', 'Martina', 'Isidora', 'Fernanda', 'Javiera', 'Constanza', 'Catalina', 'Antonia',
  'Benjamín', 'Vicente', 'Martín', 'Matías', 'Joaquín', 'Agustín', 'Tomás', 'Cristóbal', 'Diego', 'Sebastián']
const APELLIDOS = ['González', 'Muñoz', 'Rojas', 'Díaz', 'Pérez', 'Soto', 'Contreras', 'Silva', 'Martínez', 'Sepúlveda',
  'Morales', 'Rodríguez', 'López', 'Fuentes', 'Hernández', 'Torres', 'Araya', 'Flores', 'Espinoza', 'Valenzuela']
const COMUNAS = [['Región Metropolitana', 'Santiago'], ['Región Metropolitana', 'Maipú'], ['Región Metropolitana', 'Puente Alto'],
  ['Región Metropolitana', 'Ñuñoa'], ['Región Metropolitana', 'La Florida'], ['Valparaíso', 'Viña del Mar'],
  ['Biobío', 'Concepción'], ['Coquimbo', 'La Serena'], ['Araucanía', 'Temuco'], ['Antofagasta', 'Antofagasta']]
const PROVEEDORES = ['Importadora SubliChile', 'Distribuidora Textil Sur', 'Insumos Gráficos Ltda.', 'MDF Corte Láser SpA']

/** Redondea un precio al estilo retail chileno (termina en 90). */
function precioRetail(valor) {
  return Math.max(990, Math.round(valor / 100) * 100 - 10)
}

/**
 * Genera todos los datos semilla.
 * @param {number} [semilla]
 * @param {Date} [fechaBase] fin del historial (por defecto, hoy 00:00 UTC)
 */
export function generarDatos(semilla = 2026, fechaBase = fechaBaseHoy()) {
  const azar = crearAzar(semilla)

  // --- Categorías -----------------------------------------------------------
  const categorias = CATALOGO.map((c) => ({ id: azar.uuid(), nombre: c.nombre, descripcion: c.descripcion }))

  // --- Productos ------------------------------------------------------------
  // Se recorren combinaciones tipo × color × diseño en orden pseudoaleatorio
  // hasta completar TOTAL_PRODUCTOS nombres únicos, repartidos entre categorías.
  const productos = []
  const nombresUsados = new Set()
  const contadorSku = new Map()
  let intentos = 0

  while (productos.length < TOTAL_PRODUCTOS) {
    if (++intentos > TOTAL_PRODUCTOS * 50) throw new Error('No se pudieron generar nombres únicos')
    const iCat = productos.length % CATALOGO.length
    const cat = CATALOGO[iCat]
    const [tipo, costoBase] = azar.elegir(cat.tipos)
    const color = azar.elegir(COLORES)
    const [diseno, temporada] = azar.elegir(DISENOS)
    const nombre = cat.clave === 'INS' ? `${tipo} ${color} – Pack ${diseno}` : `${tipo} ${color} – Diseño ${diseno}`
    if (nombresUsados.has(nombre)) continue
    nombresUsados.add(nombre)

    const n = (contadorSku.get(cat.clave) || 0) + 1
    contadorSku.set(cat.clave, n)

    const costo = Math.round((costoBase * (0.85 + azar.siguiente() * 0.4)) / 10) * 10
    const precio = precioRetail(costo * (2.2 + azar.siguiente() * 1.3))
    const cantidadImagenes = azar.entero(1, 4)
    const imagenes = Array.from({ length: cantidadImagenes }, (_, i) => cat.imagenes[(n + i) % cat.imagenes.length])

    productos.push({
      id: azar.uuid(),
      sku: `${cat.clave}-${String(n).padStart(4, '0')}`,
      nombre,
      descripcion: `${tipo} color ${color.toLowerCase()} con diseño ${diseno.toLowerCase()}, listo para sublimar.`,
      descripcion_larga:
        `${tipo} de la línea ${cat.nombre}. Color ${color.toLowerCase()} con diseño ${diseno.toLowerCase()}. ` +
        'Recubrimiento de alta absorción que asegura colores vivos y buena resistencia al uso diario. ' +
        'Ideal para regalos personalizados, emprendimientos y merchandising.',
      categoria_id: categorias[iCat].id,
      temporada,
      costo_unitario: costo,
      precio_venta: precio,
      stock_minimo: azar.entero(3, 15),
      stock_actual: 0, // se calcula más abajo
      activo: true,
      destacado: false,
      imagen_url: imagenes[0],
      imagenes,
      especificaciones: { ...cat.especificaciones, color, diseno }
    })
  }

  // Destacados: los primeros TOTAL_DESTACADOS de una permutación pseudoaleatoria.
  const indices = productos.map((_, i) => i)
  for (let i = indices.length - 1; i > 0; i--) {
    const j = Math.floor(azar.siguiente() * (i + 1))
    ;[indices[i], indices[j]] = [indices[j], indices[i]]
  }
  indices.slice(0, TOTAL_DESTACADOS).forEach((i) => (productos[i].destacado = true))

  // Stock final: ~3 % agotado, ~5 % crítico (1..stock_minimo), resto normal.
  for (const p of productos) {
    const r = azar.siguiente()
    if (r < 0.03) p.stock_actual = 0
    else if (r < 0.08) p.stock_actual = azar.entero(1, p.stock_minimo)
    else p.stock_actual = azar.entero(p.stock_minimo + 1, 120)
  }
  // Los destacados nunca quedan agotados (la home debe poder venderlos).
  productos.filter((p) => p.destacado && p.stock_actual === 0).forEach((p) => (p.stock_actual = p.stock_minimo + 10))

  // --- Usuarios -------------------------------------------------------------
  const clientes = Array.from({ length: TOTAL_CLIENTES }, (_, i) => ({
    id: azar.uuid(),
    email: `test${String(i + 1).padStart(3, '0')}@ejemplo.cl`,
    nombre: `${azar.elegir(NOMBRES)} ${azar.elegir(APELLIDOS)}`,
    rol: 'cliente'
  }))
  const admin = { id: azar.uuid(), email: 'admin@subligol.cl', nombre: 'Administración Subligol', rol: 'admin' }

  // --- Ventas históricas ----------------------------------------------------
  // Popularidad sesgada (tipo Zipf): pocos productos concentran muchas ventas,
  // así "más vendidos" tiene sentido en el detalle.
  const ranking = [...indices].reverse()
  const elegirProducto = () => productos[ranking[Math.floor(Math.pow(azar.siguiente(), 2.2) * ranking.length)]]

  const msDia = 24 * 60 * 60 * 1000
  const ventas = []
  for (let i = 0; i < TOTAL_VENTAS; i++) {
    const canal = azar.ponderado([['Web', 45], ['Instagram', 25], ['WhatsApp', 20], ['Presencial', 8], ['Otro', 2]])
    const fecha = new Date(fechaBase.getTime() - azar.siguiente() * 365 * msDia)
    const lineas = new Map()
    const cantidadLineas = azar.entero(1, 4)
    while (lineas.size < cantidadLineas) {
      const p = elegirProducto()
      if (lineas.has(p.id)) continue
      const maximo = p.sku.startsWith('INS') ? 10 : 3
      lineas.set(p.id, { producto_id: p.id, cantidad: azar.entero(1, maximo), precio_unitario: p.precio_venta })
    }
    const detalle = [...lineas.values()].map((l) => ({ ...l, subtotal: l.cantidad * l.precio_unitario }))
    const neto = detalle.reduce((s, l) => s + l.subtotal, 0)

    const venta = { id: azar.uuid(), fecha, canal_venta: canal, detalle, estado: 'PAGADO', costo_envio: 0 }
    if (canal === 'Web') {
      const cliente = azar.elegir(clientes)
      const [region, comuna] = azar.elegir(COMUNAS)
      venta.costo_envio = neto >= 30000 ? 0 : 3990
      venta.cliente_id = cliente.id
      venta.usuario_id = cliente.id
      venta.cliente_nombre = cliente.nombre
      venta.codigo = `SUB-${fecha.getUTCFullYear()}-${String(100000 + i).padStart(6, '0')}`
      venta.medio_pago = 'Webpay Plus'
      venta.codigo_autorizacion = `TBK-${String(azar.entero(0, 999999)).padStart(6, '0')}`
      venta.despacho = { region, comuna, direccion: `Calle ${azar.elegir(APELLIDOS)} ${azar.entero(100, 9999)}` }
    } else {
      venta.cliente_nombre = `${azar.elegir(NOMBRES)} ${azar.elegir(APELLIDOS)}`
      venta.usuario_id = admin.id
    }
    venta.total = neto + venta.costo_envio
    ventas.push(venta)
  }
  ventas.sort((a, b) => a.fecha - b.fecha)

  // --- Compras de reposición ------------------------------------------------
  const compras = []
  for (let i = 0; i < TOTAL_COMPRAS; i++) {
    const fecha = new Date(fechaBase.getTime() - azar.siguiente() * 365 * msDia)
    const lineas = new Map()
    const cantidadLineas = azar.entero(2, 6)
    while (lineas.size < cantidadLineas) {
      const p = azar.elegir(productos)
      if (lineas.has(p.id)) continue
      const cantidad = azar.entero(10, 60)
      lineas.set(p.id, { producto_id: p.id, cantidad, costo_unitario: p.costo_unitario, subtotal: cantidad * p.costo_unitario })
    }
    const detalle = [...lineas.values()]
    compras.push({
      id: azar.uuid(),
      fecha,
      proveedor: azar.elegir(PROVEEDORES),
      usuario_id: admin.id,
      detalle,
      total: detalle.reduce((s, l) => s + l.subtotal, 0)
    })
  }
  compras.sort((a, b) => a.fecha - b.fecha)

  return { categorias, productos, clientes, admin, ventas, compras }
}
