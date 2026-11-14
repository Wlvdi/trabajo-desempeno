# Guía Paso a Paso: Configurar tu Base de Datos en Supabase (Subligol)

¡Excelente! Como ya tienes tu cuenta y proyecto creados en Supabase, solo te tomará **2 minutos** dejar toda la base de datos lista y funcionando con este instructivo.

---

## Paso 1: Abrir el Editor SQL en Supabase

1. Entra a tu proyecto en [Supabase Dashboard](https://supabase.com/dashboard).
2. En el menú lateral izquierdo, busca el ícono de **SQL Editor** (parece una pequeña terminal `>_` o una hoja con código).
3. Haz clic en el botón verde **"New query"** (Nueva consulta).

---

## Paso 2: Ejecutar el Script Completo

1. Abre en tu editor el archivo que acabamos de crear en tu proyecto:  
   👉 [database/00_script_completo_subligol.sql](file:///d:/Mi%20directorio/Proyectos/subligol/database/00_script_completo_subligol.sql)
2. Selecciona todo el contenido (`Ctrl + A`) y cópialo (`Ctrl + C`).
3. Pégalo en el editor SQL de Supabase.
4. Presiona el botón verde **"Run"** (o presiona `Ctrl + Enter`).

> [!NOTE]
> Deberías ver un mensaje en verde que dice: `Success. No rows returned` (o las filas de los productos de prueba). ¡Eso significa que todas las tablas, triggers, vistas y políticas de seguridad se crearon correctamente!

---

## Paso 3: Verificar visualmente tus Tablas

1. En el menú lateral izquierdo de Supabase, haz clic en **Table Editor** (el ícono de hoja de cálculo / tabla).
2. Verás que ahora tienes 7 tablas creadas:
   * `categorias` (con las categorías base de sublimación ya cargadas).
   * `productos` (con productos demo de diferentes temporadas: General, Escolar, Día de la Madre, Navidad).
   * `compras` y `detalle_compras` (listas para recibir entradas de inventario).
   * `ventas` y `detalle_ventas` (listas para recibir salidas de pedidos).
   * `audit_logs` (con los primeros logs generados automáticamente al crear los productos).

---

## Paso 4: Probar la Automatización y los Logs (Opcional pero Recomendado)

Si quieres ver cómo el inventario se descuenta solo y cómo el sistema rechaza cualquier intento de alterar los logs:
1. En **SQL Editor**, crea una nueva consulta ("New query").
2. Copia y pega el contenido de:  
   👉 [database/test_verificacion_integridad.sql](file:///d:/Mi%20directorio/Proyectos/subligol/database/test_verificacion_integridad.sql)
3. Ejecútalo para comprobar cómo compras y ventas actualizan el stock de inmediato.

---

## Paso 5: Copiar las credenciales para la Aplicación Web

Para que conectemos nuestra futura aplicación frontend con esta base de datos, necesitaremos dos datos de tu proyecto:
1. En el menú lateral izquierdo, haz clic en el ícono de engranaje **Project Settings** (abajo a la izquierda).
2. Haz clic en la pestaña **API** (o **Data API**).
3. Copia dos valores:
   * **Project URL** (comienza con `https://xxxx.supabase.co`)
   * **Project API keys -> anon / public** (es una clave larga)

*(Guárdalas a mano, las usaremos cuando inicialicemos el frontend).*
