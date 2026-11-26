import { Model, DataTypes } from 'sequelize';
import sequelize from '../sequelize';

export class Evaluacion extends Model {}

Evaluacion.init(
  {
    id_evaluacion: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    id_cliente: DataTypes.INTEGER,
    id_entrenador: DataTypes.INTEGER,
    fecha: DataTypes.DATEONLY,
    peso_kg: DataTypes.DECIMAL(5, 2),
    altura_cm: DataTypes.DECIMAL(5, 2),
    pecho_cm: DataTypes.DECIMAL(5, 2),
    cintura_cm: DataTypes.DECIMAL(5, 2),
    cadera_cm: DataTypes.DECIMAL(5, 2),
    brazo_cm: DataTypes.DECIMAL(5, 2),
    muslo_cm: DataTypes.DECIMAL(5, 2),
    enfoque: DataTypes.STRING(20),
    dias_disponibles: DataTypes.SMALLINT,
    minutos_por_sesion: DataTypes.SMALLINT,
    restricciones: DataTypes.TEXT,
    observaciones: DataTypes.TEXT,
    created_at: DataTypes.DATE,
  },
  {
    sequelize,
    modelName: 'Evaluacion',
    tableName: 'evaluaciones',
    timestamps: false,
  }
);

export default Evaluacion;
