import { Model, DataTypes } from 'sequelize';
import sequelize from '../sequelize';

// Mapea `movimientos_caja`. El trigger fn_exigir_jornada_abierta (BEFORE
// INSERT) rechaza el INSERT si `id_jornada` no referencia una jornada con
// estado ABIERTA — por eso la API siempre resuelve la jornada abierta
// actual antes de crear el movimiento, nunca confía en un id del cliente.
export class MovimientoCaja extends Model {}

MovimientoCaja.init(
  {
    id_movimiento: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    id_jornada: DataTypes.INTEGER,
    tipo: DataTypes.STRING(10),
    categoria: DataTypes.STRING(30),
    monto: DataTypes.DECIMAL(10, 2),
    concepto: DataTypes.TEXT,
    fecha_hora: DataTypes.DATE,
    id_personal: DataTypes.INTEGER,
    anulado: DataTypes.BOOLEAN,
    motivo_anulacion: DataTypes.TEXT,
    anulado_por: DataTypes.INTEGER,
    anulado_at: DataTypes.DATE,
  },
  {
    sequelize,
    modelName: 'MovimientoCaja',
    tableName: 'movimientos_caja',
    timestamps: false,
  }
);

export default MovimientoCaja;
