import { Model, DataTypes } from 'sequelize';
import sequelize from '../sequelize';

export class Cliente extends Model {}

Cliente.init(
  {
    id_cliente: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    nombre: DataTypes.STRING(80),
    apellido: DataTypes.STRING(80),
    telefono: DataTypes.STRING(20),
    email: DataTypes.STRING(120),
    fecha_nacimiento: DataTypes.DATEONLY,
    foto_perfil_url: DataTypes.TEXT,
    password_hash: DataTypes.STRING(100),
    fcm_token: DataTypes.TEXT,
    consentimiento_at: DataTypes.DATE,
    consentimiento_version: DataTypes.STRING(20),
    consentimiento_revocado_at: DataTypes.DATE,
    ultimo_acceso: DataTypes.DATE,
    activo: DataTypes.BOOLEAN,
    registrado_por: DataTypes.INTEGER,
    created_at: DataTypes.DATE,
  },
  {
    sequelize,
    modelName: 'Cliente',
    tableName: 'clientes',
    timestamps: false,
    defaultScope: {
      attributes: { exclude: ['password_hash', 'fcm_token'] },
    },
  }
);

export default Cliente;
