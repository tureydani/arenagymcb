import { Model, DataTypes } from 'sequelize';
import sequelize from '../sequelize';

export class RutinaEjercicio extends Model {}

RutinaEjercicio.init(
  {
    id_rutina_ejercicio: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    id_rutina: DataTypes.INTEGER,
    dia: DataTypes.SMALLINT,
    orden: DataTypes.SMALLINT,
    id_maquina: DataTypes.INTEGER,
    ejercicio: DataTypes.STRING(100),
    series: DataTypes.SMALLINT,
    repeticiones: DataTypes.SMALLINT,
    descanso_seg: DataTypes.SMALLINT,
    notas: DataTypes.TEXT,
  },
  {
    sequelize,
    modelName: 'RutinaEjercicio',
    tableName: 'rutina_ejercicios',
    timestamps: false,
  }
);

export default RutinaEjercicio;
