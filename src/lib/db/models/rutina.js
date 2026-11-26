import { Model, DataTypes } from 'sequelize';
import sequelize from '../sequelize';

export class Rutina extends Model {}

Rutina.init(
  {
    id_rutina: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    id_cliente: DataTypes.INTEGER,
    id_entrenador: DataTypes.INTEGER,
    nombre: DataTypes.STRING(80),
    objetivo: DataTypes.STRING(120),
    origen: DataTypes.STRING(12),
    id_propuesta: DataTypes.INTEGER,
    estado: DataTypes.STRING(10),
    fecha_inicio: DataTypes.DATEONLY,
    fecha_fin: DataTypes.DATEONLY,
    created_at: DataTypes.DATE,
  },
  {
    sequelize,
    modelName: 'Rutina',
    tableName: 'rutinas',
    timestamps: false,
  }
);

export default Rutina;
