/**
 * Generador de carga k6 de Subligol (INFB8091 Desempeño de Sistemas, guía cap. 5).
 *
 * Simula usuarios concurrentes con cuatro perfiles (guía, tabla 5.2) contra la
 * API propia y aplica uno de los escenarios de la tabla 5.3.
 *
 * Uso (normalmente a través de carga/ejecutar.sh, que guarda los reportes):
 *   k6 run -e ESCENARIO=humo   -e BASE_URL=http://localhost:3000 carga/k6/escenarios.js
 *   k6 run -e ESCENARIO=normal -e CONTRASENA_CLIENTES=... carga/k6/escenarios.js
 *
 * Variables de entorno (-e):
 *   ESCENARIO            humo | piloto | baja | normal | estres   (por defecto: humo)
 *   BASE_URL             origen del sitio (por defecto: la VM de Azure)
 *   CONTRASENA_CLIENTES  contraseña de test001..test200 (SEED_CONTRASENA_CLIENTES).
 *                        Sin ella, todos los compradores compran como invitado.
 *   PROPORCION_INVITADO  fracción de compradores que compran sin cuenta (0..1, por defecto 0)
 *   CALENTAMIENTO        duración del calentamiento previo, excluido del análisis
 *                        (por defecto 1m; 0 en humo)
 *   ESTRES_ESCALONES     iteraciones/s de cada meseta del estrés (por defecto "20,50,100,150")
 *   ESTRES_MESETA        duración de cada meseta (por defecto 2m30s)
 *   MAX_VUS              VUs máximos del estrés (por defecto 1000)
 *   PERFIL               fuerza un perfil (navegante | buscador | abandono | comprador);
 *                        solo para depurar: sin él, los perfiles se sortean por peso
 *   SALIDA_JSON          archivo del resumen JSON (lo define ejecutar.sh)
 */
import http from 'k6/http'
import { check, group, sleep } from 'k6'
import { SharedArray } from 'k6/data'
import { Counter, Trend } from 'k6/metrics'
import exec from 'k6/execution'
import { textSummary } from 'https://jslib.k6.io/k6-summary/0.1.0/index.js'

// ---------------------------------------------------------------------------
// Configuración
// ---------------------------------------------------------------------------
const ESCENARIO = (__ENV.ESCENARIO || 'humo').toLowerCase()
const BASE_URL = (__ENV.BASE_URL || 'https://subligol-utem.chilecentral.cloudapp.azure.com').replace(/\/+$/, '')
const API = `${BASE_URL}/api`
const CONTRASENA = __ENV.CONTRASENA_CLIENTES || ''
const PROPORCION_INVITADO = CONTRASENA ? Number(__ENV.PROPORCION_INVITADO || 0) : 1
const CALENTAMIENTO = __ENV.CALENTAMIENTO ?? (ESCENARIO === 'humo' ? '0' : '1m')
const ESCALONES = (__ENV.ESTRES_ESCALONES || '20,50,100,150').split(',').map(Number)
const MESETA = __ENV.ESTRES_MESETA || '2m30s'
const MAX_VUS = Number(__ENV.MAX_VUS || 1000)
const PERFIL = (__ENV.PERFIL || '').toLowerCase()

/** Cuentas de prueba (una por VU; ver carga/k6/datos/usuarios.csv). */
const USUARIOS = new SharedArray('usuarios', () =>
  open('./datos/usuarios.csv').split('\n').slice(1).map((l) => l.trim()).filter(Boolean)
)

/** Términos de búsqueda presentes en los nombres del seed. */
const TERMINOS = ['taza', 'polera', 'botella', 'navidad', 'mousepad', 'llavero', 'cojín', 'jockey', 'agenda', 'anime', 'fútbol', 'mascotas']
const ORDENES = ['destacado', 'precio_asc', 'precio_desc', 'nombre_asc', 'stock_desc']

const JSON_CT = { 'Content-Type': 'application/json' }

// ---------------------------------------------------------------------------
// Métricas propias (además de las de k6: http_req_duration, http_reqs, ...)
// ---------------------------------------------------------------------------
const duracionCheckout = new Trend('duracion_checkout', true)
const comprasOk = new Counter('compras_ok')
const comprasSinStock = new Counter('compras_sin_stock')
const comprasCarritoVacio = new Counter('compras_carrito_vacio')

// ---------------------------------------------------------------------------
// Escenarios (guía, tabla 5.3)
// ---------------------------------------------------------------------------
/** Escalones del estrés: subida de 30 s y meseta en cada nivel (guía 6.5). */
function etapasEstres() {
  const etapas = []
  for (const tasa of ESCALONES) {
    etapas.push({ duration: '30s', target: tasa }, { duration: MESETA, target: tasa })
  }
  etapas.push({ duration: '1m', target: 0 })
  return etapas
}

const PERFILES = {
  humo: { executor: 'constant-vus', vus: 1, duration: '30s' },
  piloto: {
    executor: 'ramping-vus',
    startVUs: 0,
    stages: [{ duration: '1m', target: 10 }, { duration: '1m30s', target: 10 }, { duration: '30s', target: 0 }]
  },
  baja: {
    executor: 'ramping-vus',
    startVUs: 0,
    stages: [{ duration: '1m', target: 5 }, { duration: '5m', target: 5 }, { duration: '1m', target: 0 }]
  },
  normal: {
    executor: 'ramping-vus',
    startVUs: 0,
    stages: [{ duration: '2m', target: 30 }, { duration: '10m', target: 30 }, { duration: '2m', target: 0 }]
  },
  estres: {
    // Modelo abierto: fija la tasa de llegada de sesiones aunque el servidor se
    // ponga lento (evita la omisión coordinada; guía 5.4).
    executor: 'ramping-arrival-rate',
    startRate: 5,
    timeUnit: '1s',
    preAllocatedVUs: 100,
    maxVUs: MAX_VUS,
    stages: etapasEstres()
  }
}

const PERFILES_USUARIO = ['navegante', 'buscador', 'abandono', 'comprador']
if (PERFIL && !PERFILES_USUARIO.includes(PERFIL)) {
  throw new Error(`PERFIL desconocido: "${PERFIL}". Usa: ${PERFILES_USUARIO.join(', ')}`)
}
if (!(PROPORCION_INVITADO >= 0 && PROPORCION_INVITADO <= 1)) {
  throw new Error(`PROPORCION_INVITADO debe estar entre 0 y 1 (recibido: ${__ENV.PROPORCION_INVITADO})`)
}

if (!PERFILES[ESCENARIO]) {
  throw new Error(`ESCENARIO desconocido: "${ESCENARIO}". Usa: ${Object.keys(PERFILES).join(', ')}`)
}

const hayCalentamiento = CALENTAMIENTO && CALENTAMIENTO !== '0'
const escenarios = {
  [ESCENARIO]: {
    ...PERFILES[ESCENARIO],
    exec: 'usuario',
    startTime: hayCalentamiento ? CALENTAMIENTO : '0s',
    // escenario va aquí (no solo en options.tags): con tags por escenario, k6 v2 no aplica las generales.
    tags: { fase: 'medicion', escenario: ESCENARIO }
  }
}
if (hayCalentamiento) {
  // Carga baja previa (servicio "en frío"); se excluye del análisis (guía 4.4 y 6.3.1).
  escenarios.calentamiento = {
    executor: 'constant-vus',
    vus: 2,
    duration: CALENTAMIENTO,
    exec: 'usuario',
    tags: { fase: 'calentamiento', escenario: ESCENARIO }
  }
}

export const options = {
  scenarios: escenarios,
  // SLO del sistema. Solo cuentan las peticiones de la medición, no el calentamiento.
  // En el estrés se ESPERA que fallen: ahí está el punto de saturación.
  thresholds: {
    'http_req_failed{fase:medicion}': ['rate<0.01'],
    'http_req_duration{fase:medicion}': ['p(95)<800', 'p(99)<1500'],
    'http_req_duration{fase:medicion,pagina:detalle}': ['p(95)<1000'],
    'duracion_checkout{fase:medicion}': ['p(95)<2000'],
    'checks{fase:medicion}': ['rate>0.99'],
    // Umbrales informativos (siempre se cumplen): solo hacen que el resumen JSON
    // incluya los percentiles POR PÁGINA (guía 6.4.1). k6 solo resume las
    // submétricas que tienen un umbral.
    ...Object.fromEntries(
      ['home', 'listado', 'busqueda', 'detalle', 'carrito', 'login', 'checkout', 'orden'].map((p) => [
        `http_req_duration{fase:medicion,pagina:${p}}`,
        ['max>=0']
      ])
    ),
    'http_req_failed{fase:medicion,pagina:checkout}': ['rate>=0']
  },
  summaryTrendStats: ['avg', 'min', 'med', 'p(90)', 'p(95)', 'p(99)', 'max', 'count'],
  tags: { escenario: ESCENARIO },
  // Las páginas con id se agrupan por su nombre (tag name), no por URL.
  discardResponseBodies: false,
  userAgent: 'k6-subligol-carga (INFB8091)'
}

// ---------------------------------------------------------------------------
// Ayudantes
// ---------------------------------------------------------------------------
/** Pausa aleatoria entre min y max segundos (think time). */
const pausa = (min, max) => sleep(min + Math.random() * (max - min))
const elegir = (lista) => lista[Math.floor(Math.random() * lista.length)]
const entero = (min, max) => min + Math.floor(Math.random() * (max - min + 1))

/** Parámetros de una petición con su página (tag) y, si corresponde, su nombre agrupado. */
const params = (pagina, extra = {}) => ({
  ...extra,
  tags: { pagina, name: extra.nombre || `${pagina}`, ...(extra.tags || {}) }
})

/** Lee JSON de una respuesta sin romper la iteración si viene vacía o con error. */
function json(res) {
  try {
    return res.json()
  } catch {
    return null
  }
}

// ---------------------------------------------------------------------------
// Datos compartidos: productos con stock y categorías (una vez, antes de la prueba)
// ---------------------------------------------------------------------------
export function setup() {
  const prep = { tags: { pagina: 'preparacion' } } // fuera de la medición
  const salud = http.get(`${API}/salud`, prep)
  if (salud.status !== 200) throw new Error(`La API no responde en ${API}/salud (HTTP ${salud.status})`)

  const productos = []
  for (let pagina = 1; pagina <= 5; pagina++) {
    const r = json(http.get(`${API}/productos?en_stock=true&limite=48&pagina=${pagina}&orden=stock_desc`, prep))
    for (const p of r?.items || []) productos.push(p.id)
  }
  const categorias = (json(http.get(`${API}/categorias`, prep)) || []).map((c) => c.id)
  if (productos.length === 0) throw new Error('No hay productos con stock: ejecuta npm run seed')

  if (!CONTRASENA) console.warn('[k6] Sin CONTRASENA_CLIENTES: los compradores comprarán como invitado.')
  console.log(`[k6] ${ESCENARIO} contra ${BASE_URL} | ${productos.length} productos | invitados: ${PROPORCION_INVITADO * 100}%`)
  return { productos, categorias }
}

// ---------------------------------------------------------------------------
// Páginas (una función por endpoint, con su tag "pagina")
// ---------------------------------------------------------------------------
function verHome() {
  const r = http.get(`${API}/home`, params('home'))
  check(r, { 'home 200': (x) => x.status === 200 })
}

function verListado(datos) {
  const categoria = Math.random() < 0.3 ? `&categoria=${elegir(datos.categorias)}` : ''
  const r = http.get(
    `${API}/productos?pagina=${entero(1, 10)}&limite=12&orden=${elegir(ORDENES)}${categoria}`,
    params('listado')
  )
  check(r, { 'listado 200': (x) => x.status === 200 })
  const items = json(r)?.items || []
  return items.length ? items.map((p) => p.id) : datos.productos
}

function verDetalle(id) {
  const r = http.get(`${API}/productos/${id}`, params('detalle', { nombre: 'GET /api/productos/:id' }))
  check(r, { 'detalle 200': (x) => x.status === 200 })
}

function buscar(termino, filtro = '') {
  const r = http.get(`${API}/buscar?q=${encodeURIComponent(termino)}&limite=12${filtro}`, params('busqueda'))
  check(r, { 'busqueda 200': (x) => x.status === 200 })
  return (json(r)?.items || []).map((p) => p.id)
}

/** Agrega al carrito. Devuelve el id del carrito anónimo (si no hay sesión). */
function agregarAlCarrito(productoId, { token, carritoId } = {}) {
  const headers = { ...JSON_CT }
  if (token) headers.Authorization = `Bearer ${token}`
  if (carritoId) headers['X-Carrito-Id'] = carritoId
  const r = http.post(`${API}/carrito/items`, JSON.stringify({ producto_id: productoId, cantidad: 1 }),
    params('carrito', { headers, nombre: 'POST /api/carrito/items', responseCallback: http.expectedStatuses(200, 409) }))
  check(r, { 'carrito agregar 200/409': (x) => x.status === 200 || x.status === 409 })
  return r.headers['X-Carrito-Id'] || carritoId
}

function verCarrito({ token, carritoId } = {}) {
  const headers = {}
  if (token) headers.Authorization = `Bearer ${token}`
  if (carritoId) headers['X-Carrito-Id'] = carritoId
  const r = http.get(`${API}/carrito`, params('carrito', { headers, nombre: 'GET /api/carrito' }))
  check(r, { 'carrito ver 200': (x) => x.status === 200 })
}

function iniciarSesion(email) {
  const r = http.post(`${API}/auth/login`, JSON.stringify({ email, contrasena: CONTRASENA }), params('login', { headers: JSON_CT }))
  check(r, { 'login 200': (x) => x.status === 200 })
  return json(r)?.token || null
}

/** Checkout con pago simulado. 409 (sin stock) y 400 (carrito vacío) son resultados de negocio, no fallas HTTP. */
function pagar({ token, carritoId, email }) {
  const headers = { ...JSON_CT }
  if (token) headers.Authorization = `Bearer ${token}`
  if (carritoId) headers['X-Carrito-Id'] = carritoId
  const despacho = {
    nombre: 'Carga', apellido: 'Sintética', telefono: '+56 9 1234 5678',
    region: 'Región Metropolitana', comuna: 'Santiago', direccion: 'Av. Prueba 123',
    ...(token ? {} : { email: email || 'invitado.k6@ejemplo.cl' })
  }
  const inicio = Date.now()
  const r = http.post(`${API}/checkout`, JSON.stringify({ medio_pago: 'mock', despacho }),
    params('checkout', { headers, responseCallback: http.expectedStatuses(201, 400, 409) }))
  duracionCheckout.add(Date.now() - inicio)
  check(r, { 'checkout 201/409': (x) => x.status === 201 || x.status === 409 })
  if (r.status === 201) comprasOk.add(1)
  else if (r.status === 409) comprasSinStock.add(1)
  else if (r.status === 400) comprasCarritoVacio.add(1)
  return r.status === 201 ? json(r) : null
}

function verOrden(orden, { token }) {
  const headers = token ? { Authorization: `Bearer ${token}` } : { 'X-Orden-Token': orden.token_consulta }
  const r = http.get(`${API}/ordenes/${orden.id}`, params('orden', { headers, nombre: 'GET /api/ordenes/:id' }))
  check(r, { 'orden 200': (x) => x.status === 200 })
}

// ---------------------------------------------------------------------------
// Perfiles de usuario (guía, tabla 5.2)
// ---------------------------------------------------------------------------
function navegante(datos) {
  group('navegante', () => {
    verHome(); pausa(2, 5)
    const ids = verListado(datos); pausa(2, 5)
    for (let i = 0, n = entero(1, 3); i < n; i++) {
      verDetalle(elegir(ids)); pausa(2, 5)
    }
  })
}

function buscador(datos) {
  group('buscador', () => {
    verHome(); pausa(1, 4)
    const termino = elegir(TERMINOS)
    let ids = buscar(termino); pausa(1, 4)
    const filtros = [`&categoria=${elegir(datos.categorias)}`, '&precio_max=10000', `&orden=${elegir(ORDENES)}`, '&en_stock=true']
    const filtrados = buscar(termino, elegir(filtros))
    if (filtrados.length) ids = filtrados
    pausa(1, 4)
    verDetalle(ids.length ? elegir(ids) : elegir(datos.productos))
  })
}

function abandono(datos) {
  group('abandono', () => {
    const id = elegir(datos.productos)
    verDetalle(id); pausa(2, 6)
    const carritoId = agregarAlCarrito(id); pausa(2, 6)
    verCarrito({ carritoId })
    // Se va sin pagar.
  })
}

function comprador(datos) {
  group('comprador', () => {
    const invitado = Math.random() < PROPORCION_INVITADO
    // Cuenta distinta por VU (con más de 200 VUs compradores simultáneos pueden coincidir).
    const email = USUARIOS[(exec.vu.idInTest - 1) % USUARIOS.length]
    const token = invitado ? null : iniciarSesion(email)
    if (!invitado && !token) return
    pausa(2, 5)
    const id = elegir(datos.productos)
    verDetalle(id); pausa(2, 5)
    const carritoId = agregarAlCarrito(id, { token }); pausa(2, 5)
    const orden = pagar({ token, carritoId: token ? null : carritoId, email: invitado ? `invitado.vu${exec.vu.idInTest}@ejemplo.cl` : null })
    if (orden) {
      pausa(1, 3)
      verOrden(orden, { token })
    }
  })
}

/** Cada iteración es una sesión de un usuario sintético con un perfil sorteado por peso. */
export function usuario(datos) {
  if (PERFIL) return { navegante, buscador, abandono, comprador }[PERFIL](datos)
  const p = Math.random()
  if (p < 0.5) navegante(datos)
  else if (p < 0.75) buscador(datos)
  else if (p < 0.9) abandono(datos)
  else comprador(datos)
}

export default usuario

// ---------------------------------------------------------------------------
// Resumen: consola + JSON con marca de tiempo (guía 5.7)
// ---------------------------------------------------------------------------
export function handleSummary(data) {
  const salida = __ENV.SALIDA_JSON || `carga/resultados/${ESCENARIO}-${new Date().toISOString().replace(/[:.]/g, '-')}.json`
  return {
    stdout: textSummary(data, { indent: ' ', enableColors: true }),
    [salida]: JSON.stringify(data, null, 2)
  }
}
