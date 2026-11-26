import { Model, DataTypes } from 'sequelize';
import sequelize from '../sequelize';

// Vista de solo lectura (arena_gym_schema.sql): ingresos por canal, egresos
// y el efectivo esperado ya calculado para cada jornada. El cierre de caja
// (PATCH /api/jornadas-caja/:id/cerrar) la usa para no reimplementar en JS
// la suma de pagos/ventas/movimientos que ya hace la vista en SQL.
export class VJornadaResumen extends Model {}

VJornadaResumen.init(
  {
    id_jornada: { type: DataTypes.INTEGER, primaryKey: true },
    estado: DataTypes.STRING(10),
    fecha_apertura: DataTypes.DATE,
    fecha_cierre: DataTypes.DATE,
    saldo_inicial_efectivo: DataTypes.DECIMAL(10, 2),
    ingresos_efectivo: DataTypes.DECIMAL(10, 2),
    ingresos_qr: DataTypes.DECIMAL(10, 2),
    ingresos_transferencia: DataTypes.DECIMAL(10, 2),
    ingresos_tarjeta: DataTypes.DECIMAL(10, 2),
    otros_ingresos_efectivo: DataTypes.DECIMAL(10, 2),
    egresos_efectivo: DataTypes.DECIMAL(10, 2),
    efectivo_esperado_calculado: DataTypes.DECIMAL(10, 2),
    efectivo_contado: DataTypes.DECIMAL(10, 2),
    diferencia: DataTypes.DECIMAL(10, 2),
  },
  {
    sequelize,
    modelName: 'VJornadaResumen',
    tableName: 'v_jornada_resumen',
    timestamps: false,
  }
);

export default VJornadaResumen;
