import { Model, DataTypes } from 'sequelize';
import sequelize from '../sequelize';

export class Venta extends Model {}

Venta.init(
  {
    id_venta: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    id_jornada: DataTypes.INTEGER,
    id_cliente: DataTypes.INTEGER,
    canal_cobro: DataTypes.STRING(15),
    total: DataTypes.DECIMAL(10, 2),
    fecha_venta: DataTypes.DATE,
    id_personal: DataTypes.INTEGER,
    anulado: DataTypes.BOOLEAN,
    motivo_anulacion: DataTypes.TEXT,
    anulado_por: DataTypes.INTEGER,
    anulado_at: DataTypes.DATE,
  },
  {
    sequelize,
    modelName: 'Venta',
    tableName: 'ventas',
    timestamps: false,
  }
);

export default Venta;
