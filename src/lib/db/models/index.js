// Registro central de modelos y sus relaciones.
// Se va ampliando a medida que se construyen las vistas correspondientes.
import Personal from './personal';
import Cliente from './cliente';
import Membresia from './membresia';
import RegistroMembresia from './registroMembresia';
import VMembresiasVigentes from './vMembresiasVigentes';

RegistroMembresia.belongsTo(Cliente, { foreignKey: 'id_cliente', as: 'cliente' });
RegistroMembresia.belongsTo(Membresia, { foreignKey: 'id_membresia', as: 'membresia' });

export { Personal, Cliente, Membresia, RegistroMembresia, VMembresiasVigentes };
