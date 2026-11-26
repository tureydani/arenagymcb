import { Model, DataTypes } from 'sequelize';
import sequelize from '../sequelize';

export class RegistroCumplimiento extends Model {}

RegistroCumplimiento.init(
  {
    id_cumplimiento: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    id_rutina_ejercicio: DataTypes.INTEGER,
    fecha: DataTypes.DATEONLY,
    series_realizadas: DataTypes.SMALLINT,
    repeticiones_realizadas: DataTypes.SMALLINT,
    peso_usado_kg: DataTypes.DECIMAL(5, 1),
    completado: DataTypes.BOOLEAN,
    observaciones: DataTypes.TEXT,
    created_at: DataTypes.DATE,
  },
  {
    sequelize,
    modelName: 'RegistroCumplimiento',
    tableName: 'registros_cumplimiento',
    timestamps: false,
  }
);

export default RegistroCumplimiento;
