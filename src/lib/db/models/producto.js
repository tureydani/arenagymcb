import { Model, DataTypes } from 'sequelize';
import sequelize from '../sequelize';

export class Producto extends Model {}

Producto.init(
  {
    id_producto: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    nombre: DataTypes.STRING(80),
    precio: DataTypes.DECIMAL(10, 2),
    stock: DataTypes.INTEGER,
    precio_mayoreo: DataTypes.DECIMAL(10, 2),
    cantidad_mayoreo: DataTypes.INTEGER,
    activo: DataTypes.BOOLEAN,
  },
  {
    sequelize,
    modelName: 'Producto',
    tableName: 'productos',
    timestamps: false,
  }
);

export default Producto;
