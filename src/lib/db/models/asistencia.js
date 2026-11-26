import { Model, DataTypes } from 'sequelize';
import sequelize from '../sequelize';

export class Asistencia extends Model {}

Asistencia.init(
  {
    id_asistencia: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    id_cliente: DataTypes.INTEGER,
    id_registro: DataTypes.INTEGER,
    fecha_hora: DataTypes.DATE,
    // `fecha` es GENERATED ALWAYS STORED (fecha_hora en hora Bolivia) en la
    // DB: solo lectura, nunca se envía en un create.
    fecha: DataTypes.DATEONLY,
    metodo: DataTypes.STRING(7),
    id_personal: DataTypes.INTEGER,
    anulado: DataTypes.BOOLEAN,
    motivo_anulacion: DataTypes.TEXT,
    anulado_por: DataTypes.INTEGER,
    anulado_at: DataTypes.DATE,
  },
  {
    sequelize,
    modelName: 'Asistencia',
    tableName: 'asistencias',
    timestamps: false,
  }
);

export default Asistencia;
