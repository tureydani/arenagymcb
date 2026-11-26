import { Model, DataTypes } from 'sequelize';
import sequelize from '../sequelize';

export class Maquina extends Model {}

Maquina.init(
  {
    id_maquina: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    nombre: DataTypes.STRING(80),
    grupo_muscular: DataTypes.STRING(40),
    descripcion: DataTypes.TEXT,
    imagen_url: DataTypes.TEXT,
    operativa: DataTypes.BOOLEAN,
    activo: DataTypes.BOOLEAN,
  },
  {
    sequelize,
    modelName: 'Maquina',
    tableName: 'maquinas',
    timestamps: false,
  }
);

export default Maquina;
