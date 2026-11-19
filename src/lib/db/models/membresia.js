import { Model, DataTypes } from 'sequelize';
import sequelize from '../sequelize';

export class Membresia extends Model {}

Membresia.init(
  {
    id_membresia: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    nombre: DataTypes.STRING(60),
    descripcion: DataTypes.TEXT,
    duracion_dias: DataTypes.INTEGER,
    precio: DataTypes.DECIMAL(10, 2),
    limite_asistencias: DataTypes.INTEGER,
    activo: DataTypes.BOOLEAN,
  },
  {
    sequelize,
    modelName: 'Membresia',
    tableName: 'membresias',
    timestamps: false,
  }
);

export default Membresia;
