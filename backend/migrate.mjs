import mysql from 'mysql2/promise';
import { config } from 'dotenv';
import { resolve } from 'path';

config({ path: resolve(process.cwd(), '.env.local') });

const pool = mysql.createPool({
    host: process.env.DB_HOST,
    port: Number(process.env.DB_PORT) || 3306,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
});

await pool.query(`
    CREATE TABLE IF NOT EXISTS tipos_justificativa (
        id INT AUTO_INCREMENT PRIMARY KEY,
        nome VARCHAR(100) NOT NULL,
        campos JSON NOT NULL,
        ativo BOOLEAN NOT NULL DEFAULT TRUE
    )
`);

console.log('Tabela tipos_justificativa criada com sucesso.');
await pool.end();
