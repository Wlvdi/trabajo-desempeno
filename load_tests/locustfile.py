# load_tests/locustfile.py
# Script de Clientes Sintéticos con Locust (Python) para Subligol (UTEM)
# Ejecución: locust -f locustfile.py --host=http://localhost:5173
# Modo Headless: locust -f locustfile.py --headless -u 30 -r 5 --run-time 2m --host=http://localhost:5173

import random
from locust import HttpUser, task, between, tag

class SubligolClientUser(HttpUser):
    # Tiempo de espera realista entre acciones del usuario (1 a 3 segundos)
    wait_time = between(1, 3)

    @tag('navegacion')
    @task(5)
    def flujo_navegador_casual(self):
        """Usuario que visita la Home, revisa el catálogo y un producto."""
        # 1. Home (Página 1: Carga Ligera)
        self.client.get("/", name="[P1] Home")
        
        # 2. Catálogo (Página 2: Carga Pesada)
        self.client.get("/catalogo", name="[P2] Catalogo Completo")
        
        # 3. Detalle de Producto (Página 3: Ficha Focalizada)
        prods = ['prod-001', 'prod-002', 'prod-003', 'prod-005', 'prod-006']
        prod_id = random.choice(prods)
        self.client.get(f"/producto/{prod_id}", name="[P3] Detalle Producto")

    @tag('busqueda')
    @task(3)
    def flujo_busqueda(self):
        """Usuario que realiza búsquedas con filtros en el catálogo."""
        terminos = ['taza', 'polera', 'botella', 'mdf']
        termino = random.choice(terminos)
        self.client.get(f"/catalogo?q={termino}", name="[P2] Busqueda Catalogo")

    @tag('compra')
    @task(2)
    def flujo_comprador_decidido(self):
        """Usuario que recorre el embudo completo: Producto -> Carrito -> Checkout."""
        # Ver producto
        self.client.get("/producto/prod-001", name="[P3] Detalle Producto (Compra)")
        # Ir al carrito
        self.client.get("/carrito", name="[Embudo] Carrito de Compras")
        # Ir al checkout
        self.client.get("/checkout", name="[Embudo] Checkout")

    @tag('abandono')
    @task(2)
    def flujo_abandono_carrito(self):
        """Usuario que añade al carrito pero se retira sin pagar."""
        self.client.get("/producto/prod-003", name="[P3] Detalle Producto")
        self.client.get("/carrito", name="[Embudo] Abandono Carrito")
