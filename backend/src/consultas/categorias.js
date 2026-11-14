/**
 * Consultas SQL de categorías.
 */

/**
 * Categorías con la cantidad de productos activos de cada una.
 * @param {import('pg').Pool} pool
 * @returns {Promise<{ id: string, nombre: string, descripcion: string | null, total_productos: number }[]>}
 */
export async function categoriasConConteo(pool) {
  const { rows } = await pool.query(
    `select c.id, c.nombre, c.descripcion, count(p.id)::int as total_productos
       from categorias c
       left join productos p on p.categoria_id = c.id and p.activo
      group by c.id
      order by c.nombre asc`
  )
  return rows
}
