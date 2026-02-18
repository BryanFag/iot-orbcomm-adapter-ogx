import dotenv from 'dotenv';
import type { EnvConfig } from '../types/ogws.types.js';

dotenv.config();

/**
 * Configuração do ambiente
 * Lê as variáveis de ambiente do arquivo .env
 */
export const config: EnvConfig = {

    /**
     * Servidor
     */
    PORT: parseInt(process.env.PORT || '3000', 10),
    HOST: process.env.HOST || '0.0.0.0',

    /**
     * OGWS API
     */
    OGWS_BASE_URL  : process.env.OGWS_BASE_URL  || '',
    OGWS_ACCESS_ID : process.env.OGWS_ACCESS_ID || '',
    OGWS_PASSWORD  : process.env.OGWS_PASSWORD  || '',

    /**
     * Polling Time
     */
    POLLING_INTERVAL_SECONDS: parseInt(process.env.POLLING_INTERVAL_SECONDS || '60', 10),
};


/**
 * Valida se as variáveis obrigatórias estão configuradas
 */
export function validateEnv(): void {
    const required = ['OGWS_BASE_URL', 'OGWS_ACCESS_ID', 'OGWS_PASSWORD'];
    const missing  = required.filter(key => !process.env[key]);

    if (missing.length > 0) {
        console.error('');
        console.error('═══════════════════════════════════════════════════════');
        console.error('[ERROR] Variáveis de ambiente não configuradas!');
        console.error('═══════════════════════════════════════════════════════');
        console.error(`Faltando: ${missing.join(', ')}`);
        console.error('');
        console.error('Crie um arquivo .env na raiz do projeto com:');
        console.error('');
        missing.forEach(key => {
            console.error(`  ${key}=valor_aqui`);
        });
        console.error('');
        console.error('Ou copie o arquivo .env.example:');
        console.error('  cp .env.example .env');
        console.error('═══════════════════════════════════════════════════════');
        console.error('');
        process.exit(1);
    }
}
