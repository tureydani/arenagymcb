import { Model, DataTypes } from 'sequelize';
import sequelize from '../sequelize';

export class RegistroMembresia extends Model {}

RegistroMembresia.init(
  {
    id_registro: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    id_cliente: DataTypes.INTEGER,
    id_membresia: DataTypes.INTEGER,
    fecha_inicio: DataTypes.DATEONLY,
    fecha_fin: DataTypes.DATEONLY,
    precio: DataTypes.DECIMAL(10, 2),
    limite_asistencias: DataTypes.INTEGER,
    registrado_por: DataTypes.INTEGER,
    created_at: DataTypes.DATE,
    anulado: DataTypes.BOOLEAN,
    motivo_anulacion: DataTypes.TEXT,
    anulado_por: DataTypes.INTEGER,
    anulado_at: DataTypes.DATE,
  },
  {
    sequelize,
    modelName: 'RegistroMembresia',
    tableName: 'registro_membresias',
    timestamps: false,
  }
);

export default RegistroMembresia;
