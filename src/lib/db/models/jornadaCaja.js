import { Model, DataTypes } from 'sequelize';
import sequelize from '../sequelize';

// Mapea `jornadas_caja`. `uq_jornada_abierta` (índice único parcial sobre
// estado='ABIERTA') garantiza en la DB que solo haya una jornada abierta a
// la vez: un segundo INSERT con estado ABIERTA viola esa unicidad.
export class JornadaCaja extends Model {}

JornadaCaja.init(
  {
    id_jornada: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    estado: DataTypes.STRING(10),
    fecha_apertura: DataTypes.DATE,
    id_personal_apertura: DataTypes.INTEGER,
    saldo_inicial_efectivo: DataTypes.DECIMAL(10, 2),
    fecha_cierre: DataTypes.DATE,
    id_personal_cierre: DataTypes.INTEGER,
    efectivo_esperado: DataTypes.DECIMAL(10, 2),
    efectivo_contado: DataTypes.DECIMAL(10, 2),
    diferencia: DataTypes.DECIMAL(10, 2),
    observaciones: DataTypes.TEXT,
  },
  {
    sequelize,
    modelName: 'JornadaCaja',
    tableName: 'jornadas_caja',
    timestamps: false,
  }
);

export default JornadaCaja;
