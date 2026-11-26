// Registro central de modelos y sus relaciones.
// Se va ampliando a medida que se construyen las vistas correspondientes.
import Personal from './personal';
import Cliente from './cliente';
import Membresia from './membresia';
import RegistroMembresia from './registroMembresia';
import VMembresiasVigentes from './vMembresiasVigentes';
import JornadaCaja from './jornadaCaja';
import MovimientoCaja from './movimientoCaja';
import VJornadaResumen from './vJornadaResumen';
import Producto from './producto';
import Maquina from './maquina';
import Pago from './pago';
import Venta from './venta';
import DetalleVenta from './detalleVenta';
import Asistencia from './asistencia';
import Evaluacion from './evaluacion';
import Meta from './meta';
import Rutina from './rutina';
import RutinaEjercicio from './rutinaEjercicio';
import RegistroCumplimiento from './registroCumplimiento';

// Con Turbopack, este módulo puede re-ejecutarse en caliente sin que las
// clases de Sequelize (mutables a nivel de módulo) se reinicien, así que
// `belongsTo`/`hasMany` deben ser idempotentes o la segunda ejecución
// lanza SequelizeAssociationError por alias duplicado.
if (!RegistroMembresia.associations.cliente) {
  RegistroMembresia.belongsTo(Cliente, { foreignKey: 'id_cliente', as: 'cliente' });
  RegistroMembresia.belongsTo(Membresia, { foreignKey: 'id_membresia', as: 'membresia' });
}

if (!JornadaCaja.associations.movimientos) {
  JornadaCaja.hasMany(MovimientoCaja, { foreignKey: 'id_jornada', as: 'movimientos' });
  MovimientoCaja.belongsTo(JornadaCaja, { foreignKey: 'id_jornada', as: 'jornada' });
}

if (!Pago.associations.registro) {
  Pago.belongsTo(RegistroMembresia, { foreignKey: 'id_registro', as: 'registro' });
  Pago.belongsTo(JornadaCaja, { foreignKey: 'id_jornada', as: 'jornada' });
}

if (!Venta.associations.cliente) {
  Venta.belongsTo(Cliente, { foreignKey: 'id_cliente', as: 'cliente' });
  Venta.belongsTo(JornadaCaja, { foreignKey: 'id_jornada', as: 'jornada' });
  Venta.hasMany(DetalleVenta, { foreignKey: 'id_venta', as: 'detalles' });
  DetalleVenta.belongsTo(Venta, { foreignKey: 'id_venta', as: 'venta' });
  DetalleVenta.belongsTo(Producto, { foreignKey: 'id_producto', as: 'producto' });
}

if (!Asistencia.associations.cliente) {
  Asistencia.belongsTo(Cliente, { foreignKey: 'id_cliente', as: 'cliente' });
  Asistencia.belongsTo(RegistroMembresia, { foreignKey: 'id_registro', as: 'registro' });
}

if (!Evaluacion.associations.cliente) {
  Evaluacion.belongsTo(Cliente, { foreignKey: 'id_cliente', as: 'cliente' });
  Evaluacion.belongsTo(Personal, { foreignKey: 'id_entrenador', as: 'entrenador' });
}

if (!Meta.associations.cliente) {
  Meta.belongsTo(Cliente, { foreignKey: 'id_cliente', as: 'cliente' });
  Meta.belongsTo(Personal, { foreignKey: 'id_entrenador', as: 'entrenador' });
}

if (!Rutina.associations.cliente) {
  Rutina.belongsTo(Cliente, { foreignKey: 'id_cliente', as: 'cliente' });
  Rutina.belongsTo(Personal, { foreignKey: 'id_entrenador', as: 'entrenador' });
  Rutina.hasMany(RutinaEjercicio, { foreignKey: 'id_rutina', as: 'ejercicios' });
  RutinaEjercicio.belongsTo(Rutina, { foreignKey: 'id_rutina', as: 'rutina' });
  RutinaEjercicio.belongsTo(Maquina, { foreignKey: 'id_maquina', as: 'maquina' });
}

if (!RegistroCumplimiento.associations.ejercicio) {
  RegistroCumplimiento.belongsTo(RutinaEjercicio, { foreignKey: 'id_rutina_ejercicio', as: 'ejercicio' });
  RutinaEjercicio.hasMany(RegistroCumplimiento, { foreignKey: 'id_rutina_ejercicio', as: 'cumplimientos' });
}

export {
  Personal,
  Cliente,
  Membresia,
  RegistroMembresia,
  VMembresiasVigentes,
  JornadaCaja,
  MovimientoCaja,
  VJornadaResumen,
  Producto,
  Maquina,
  Pago,
  Venta,
  DetalleVenta,
  Asistencia,
  Evaluacion,
  Meta,
  Rutina,
  RutinaEjercicio,
  RegistroCumplimiento,
};
