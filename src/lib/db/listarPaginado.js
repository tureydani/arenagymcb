import { Op } from 'sequelize';

/**
 * Listado paginado + búsqueda por ILIKE sobre varios campos, común a todos
 * los endpoints de listado. `camposBusqueda` son nombres de columna del
 * propio modelo (no de asociaciones).
 */
export async function listarPaginado(Model, { page, limit, q, camposBusqueda = [], where = {}, order, scope }) {
  const pagina = Math.max(1, Number(page) || 1);
  const tamano = Math.min(100, Math.max(1, Number(limit) || 20));

  const condiciones = { ...where };
  if (q && camposBusqueda.length > 0) {
    condiciones[Op.or] = camposBusqueda.map((campo) => ({ [campo]: { [Op.iLike]: `%${q}%` } }));
  }

  const modeloConScope = scope ? Model.scope(scope) : Model;

  const { count, rows } = await modeloConScope.findAndCountAll({
    where: condiciones,
    order: order || [[Model.primaryKeyAttribute, 'DESC']],
    limit: tamano,
    offset: (pagina - 1) * tamano,
  });

  return { data: rows, total: count, page: pagina, limit: tamano };
}
