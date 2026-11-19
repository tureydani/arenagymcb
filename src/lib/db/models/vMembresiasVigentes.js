import { Model, DataTypes } from 'sequelize';
import sequelize from '../sequelize';

// Vista de solo lectura (arena_gym_schema.sql): membresías activas con
// días restantes y asistencias usadas ya calculados. No se escribe acá;
// las altas/anulaciones van contra `registro_membresias`.
export class VMembresiasVigentes extends Model {}

VMembresiasVigentes.init(
  {
    id_registro: { type: DataTypes.INTEGER, primaryKey: true },
    id_cliente: DataTypes.INTEGER,
    nombre: DataTypes.STRING(80),
    apellido: DataTypes.STRING(80),
    telefono: DataTypes.STRING(20),
    plan: DataTypes.STRING(60),
    fecha_inicio: DataTypes.DATEONLY,
    fecha_fin: DataTypes.DATEONLY,
    dias_restantes: DataTypes.INTEGER,
    limite_asistencias: DataTypes.INTEGER,
    asistencias_usadas: DataTypes.INTEGER,
  },
  {
    sequelize,
    modelName: 'VMembresiasVigentes',
    tableName: 'v_membresias_vigentes',
    timestamps: false,
  }
);

export default VMembresiasVigentes;
