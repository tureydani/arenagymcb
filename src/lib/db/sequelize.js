import { Sequelize } from 'sequelize';

// En serverless (Vercel), cada invocación puede reutilizar el contenedor entre
// llamadas "calientes". Cacheamos la instancia en globalThis para no crear una
// nueva conexión/pool en cada invocación.
const globalForSequelize = globalThis;

function createSequelize() {
  return new Sequelize(
    process.env.DB_NAME,
    process.env.DB_USER,
    process.env.DB_PASS,
    {
      host: process.env.DB_HOST,
      port: process.env.DB_PORT || 5432,
      dialect: 'postgres',
      logging: false,
      dialectOptions: process.env.DB_SSL === 'true'
        ? { ssl: { require: true, rejectUnauthorized: false } }
        : {},
      // Con el Transaction Pooler de Supabase cada invocación serverless no
      // necesita (ni debe) mantener un pool grande de conexiones propio.
      pool: {
        max: 2,
        min: 0,
        acquire: 30000,
        idle: 5000,
      },
    }
  );
}

const sequelize = globalForSequelize.__sequelize || createSequelize();

if (!globalForSequelize.__sequelize) {
  globalForSequelize.__sequelize = sequelize;
}

export default sequelize;
