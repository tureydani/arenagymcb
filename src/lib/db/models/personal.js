import { Model, DataTypes } from 'sequelize';
import sequelize from '../sequelize';

// Mapea la tabla `personal` de arena_gym_schema.sql.
// defaultScope excluye password_hash: usar Personal.unscoped() solo donde
// se necesite comparar el hash (login).
export class Personal extends Model {}

Personal.init(
  {
    id_personal: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    nombre: DataTypes.STRING(80),
    apellido: DataTypes.STRING(80),
    usuario: DataTypes.STRING(40),
    password_hash: DataTypes.STRING(100),
    telefono: DataTypes.STRING(20),
    roles: DataTypes.ARRAY(DataTypes.TEXT),
    activo: DataTypes.BOOLEAN,
    ultimo_acceso: DataTypes.DATE,
    created_at: DataTypes.DATE,
  },
  {
    sequelize,
    modelName: 'Personal',
    tableName: 'personal',
    timestamps: false,
    defaultScope: {
      attributes: { exclude: ['password_hash'] },
    },
  }
);

export default Personal;
