import { Model, DataTypes } from 'sequelize';
import sequelize from '../sequelize';

export class DetalleVenta extends Model {}

DetalleVenta.init(
  {
    id_detalle: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    id_venta: DataTypes.INTEGER,
    id_producto: DataTypes.INTEGER,
    cantidad: DataTypes.INTEGER,
    precio_unitario: DataTypes.DECIMAL(10, 2),
    es_mayoreo: DataTypes.BOOLEAN,
    // Columna GENERATED ALWAYS AS (cantidad * precio_unitario) STORED en la
    // DB: solo lectura, nunca se envía en un create/update.
    subtotal: DataTypes.DECIMAL(10, 2),
  },
  {
    sequelize,
    modelName: 'DetalleVenta',
    tableName: 'detalle_ventas',
    timestamps: false,
  }
);

export default DetalleVenta;
