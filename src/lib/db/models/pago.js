import { Model, DataTypes } from 'sequelize';
import sequelize from '../sequelize';

export class Pago extends Model {}

Pago.init(
  {
    id_pago: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    id_registro: DataTypes.INTEGER,
    id_jornada: DataTypes.INTEGER,
    id_grupo_pago: DataTypes.UUID,
    monto: DataTypes.DECIMAL(10, 2),
    canal_cobro: DataTypes.STRING(15),
    fecha_pago: DataTypes.DATE,
    id_personal: DataTypes.INTEGER,
    observaciones: DataTypes.TEXT,
    anulado: DataTypes.BOOLEAN,
    motivo_anulacion: DataTypes.TEXT,
    anulado_por: DataTypes.INTEGER,
    anulado_at: DataTypes.DATE,
  },
  {
    sequelize,
    modelName: 'Pago',
    tableName: 'pagos',
    timestamps: false,
  }
);

export default Pago;
