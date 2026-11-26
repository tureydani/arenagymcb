import { Model, DataTypes } from 'sequelize';
import sequelize from '../sequelize';

export class Meta extends Model {}

Meta.init(
  {
    id_meta: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    id_cliente: DataTypes.INTEGER,
    id_entrenador: DataTypes.INTEGER,
    tipo_medida: DataTypes.STRING(10),
    valor_inicial: DataTypes.DECIMAL(5, 2),
    valor_objetivo: DataTypes.DECIMAL(5, 2),
    valor_actual: DataTypes.DECIMAL(5, 2),
    fecha_objetivo: DataTypes.DATEONLY,
    estado: DataTypes.STRING(10),
    created_at: DataTypes.DATE,
  },
  {
    sequelize,
    modelName: 'Meta',
    tableName: 'metas',
    timestamps: false,
  }
);

export default Meta;
