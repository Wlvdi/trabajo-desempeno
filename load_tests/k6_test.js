// load_tests/k6_test.js
// Script de prueba de carga sintética con K6 para Subligol (UTEM - Desempeño de Sistemas)
// Ejecución: k6 run k6_test.js
// O para exportar a HTML / JSON: k6 run --out json=resultados_k6.json k6_test.js

import http from 'k6/http';
import { check, sleep, group } from 'k6';
import { Trend, Rate, Counter } from 'k6/metrics';

// Métricas personalizadas
const ttfbTrend = new Trend('custom_ttfb');
const errorRate = new Rate('custom_error_rate');
const comprasCompletadas = new Counter('compras_completadas');
const carritosAbandonados = new Counter('carritos_abandonados');

// URL Base del sitio (Local o Desplegado en Cloudflare / Vercel)
const BASE_URL = __ENV.TARGET_URL || 'http://localhost:5173';

// 3 Escenarios según la variable de entorno SCENARIO: 'baja' | 'normal' | 'estres'
const scenarioType = __ENV.SCENARIO || 'normal';

let stagesConfig = [];

if (scenarioType === 'baja') {
  // Escenario 1: Carga Baja (Baseline / Smoke test)
  stagesConfig = [
    { duration: '30s', target: 5 },
    { duration: '1m', target: 5 },
    { duration: '15s', target: 0 },
  ];
} else if (scenarioType === 'estres') {
  // Escenario 3: Carga Pico / Estrés (Stress test para hallar punto de saturación)
  stagesConfig = [
    { duration: '30s', target: 20 },
    { duration: '1m', target: 80 },
    { duration: '2m', target: 150 }, // Pico de estrés
    { duration: '1m', target: 200 }, // Posible punto de quiebre
    { duration: '30s', target: 0 },
  ];
} else {
  // Escenario 2: Carga Sostenida Normal
  stagesConfig = [
    { duration: '30s', target: 15 },
    { duration: '2m', target: 40 }, // Carga sostenida
    { duration: '30s', target: 0 },
  ];
}

export const options = {
  stages: stagesConfig,
  thresholds: {
    // Requisitos de la Fase 2: Mediana y Percentiles p90, p95, p99
    http_req_duration: ['avg<1200', 'p(90)<1800', 'p(95)<2500', 'p(99)<3500'],
    http_req_failed: ['rate<0.05'], // Tasa de error < 5%
    custom_error_rate: ['rate<0.05'],
  },
};

export default function () {
  // Generar comportamiento aleatorio ponderado:
  // - 50% Navegador casual (Home -> Catálogo -> Detalle)
  // - 30% Comprador decidido (Catálogo -> Detalle -> Carrito -> Checkout)
  // - 20% Abandono de carrito (Detalle -> Carrito -> Salir)
  const randomRoll = Math.random();

  if (randomRoll < 0.50) {
    // -------------------------------------------------------------
    // Comportamiento 1: Navegador Casual (Navegación / Lectura)
    // -------------------------------------------------------------
    group('Comportamiento: Navegador Casual', function () {
      // 1. Home (Página 1: Carga Ligera)
      let resHome = http.get(`${BASE_URL}/`);
      check(resHome, {
        'Home status 200': (r) => r.status === 200,
      });
      errorRate.add(resHome.status >= 400);
      sleep(Math.random() * 2 + 1); // Think time 1-3s

      // 2. Catálogo (Página 2: Carga Pesada)
      let resCat = http.get(`${BASE_URL}/catalogo`);
      check(resCat, {
        'Catálogo status 200': (r) => r.status === 200,
      });
      errorRate.add(resCat.status >= 400);
      sleep(Math.random() * 2 + 1);

      // 3. Detalle de Producto aleatorio (Página 3: Ficha Focalizada)
      const prodIds = ['prod-001', 'prod-002', 'prod-003', 'prod-005'];
      const chosenProd = prodIds[Math.floor(Math.random() * prodIds.length)];
      let resProd = http.get(`${BASE_URL}/producto/${chosenProd}`);
      check(resProd, {
        'Detalle Producto status 200': (r) => r.status === 200,
      });
      errorRate.add(resProd.status >= 400);
      sleep(Math.random() * 2 + 1);
    });

  } else if (randomRoll < 0.80) {
    // -------------------------------------------------------------
    // Comportamiento 2: Comprador Decidido (Embudo Completo / Compra)
    // -------------------------------------------------------------
    group('Comportamiento: Comprador Decidido (Checkout Webpay)', function () {
      // 1. Búsqueda en catálogo
      let resSearch = http.get(`${BASE_URL}/catalogo?q=taza`);
      check(resSearch, { 'Búsqueda status 200': (r) => r.status === 200 });
      sleep(1);

      // 2. Detalle de producto
      let resProd = http.get(`${BASE_URL}/producto/prod-001`);
      check(resProd, { 'Detalle status 200': (r) => r.status === 200 });
      sleep(1.5);

      // 3. Carrito de compras
      let resCart = http.get(`${BASE_URL}/carrito`);
      check(resCart, { 'Carrito status 200': (r) => r.status === 200 });
      sleep(1);

      // 4. Checkout
      let resCheckout = http.get(`${BASE_URL}/checkout`);
      check(resCheckout, { 'Checkout status 200': (r) => r.status === 200 });
      sleep(2);

      // 5. Simular éxito de compra
      comprasCompletadas.add(1);
    });

  } else {
    // -------------------------------------------------------------
    // Comportamiento 3: Abandono de Carrito
    // -------------------------------------------------------------
    group('Comportamiento: Abandono de Carrito', function () {
      let resProd = http.get(`${BASE_URL}/producto/prod-002`);
      check(resProd, { 'Detalle status 200': (r) => r.status === 200 });
      sleep(1);

      let resCart = http.get(`${BASE_URL}/carrito`);
      check(resCart, { 'Carrito status 200': (r) => r.status === 200 });
      sleep(2);

      // Abandona la sesión
      carritosAbandonados.add(1);
    });
  }
}
