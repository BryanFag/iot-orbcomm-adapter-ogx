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
    PORT: parseInt(process.env.PORT || '3001', 10),
    HOST: process.env.HOST || '0.0.0.0',

    /**
     * Kafka
     */
    KAFKA_BROKER: process.env.KAFKA_BROKER || 'localhost:9092',
    KAFKA_TOPIC_RECEIVED: process.env.KAFKA_TOPIC_RECEIVED || 'received.message.ogx',
    KAFKA_TOPIC_TRANSLATE: process.env.KAFKA_TOPIC_TRANSLATE || 'translate.message.ogx',
    KAFKA_TOPIC_SEND: process.env.KAFKA_TOPIC_SEND || 'send.message.ogx',
    KAFKA_GROUP_ID: process.env.KAFKA_GROUP_ID || 'iot-isadatapro-ogx-middleware',
    KAFKA_ENABLED: process.env.KAFKA_ENABLED !== 'false',

    /**
     * Forward API (encaminhamento de mensagens recebidas para core-isadatapro-orbcomm-middleware)
     */
    FORWARD_API_URL: process.env.FORWARD_API_URL || 'http://localhost:8080/message',
    FORWARD_ACCOUNT_ID: parseInt(process.env.FORWARD_ACCOUNT_ID || '60003666', 10),
    FORWARD_API_ENABLED: process.env.FORWARD_API_ENABLED !== 'false',
};


/**
 * Valida se as variáveis obrigatórias estão configuradas
 */
export function validateEnv(): void {
    const required = ['KAFKA_BROKER'];
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
