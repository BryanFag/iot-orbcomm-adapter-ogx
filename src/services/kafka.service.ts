import { Kafka, Producer, logLevel } from 'kafkajs';
import { config } from '../config/env.js';
import type { SendMessageOGx } from '../types/ogws.types.js';

/**
 * Serviço Kafka Producer
 * Publica mensagens convertidas (IDP→OGx) no tópico send.message.ogx
 */
class KafkaProducerService {
    private kafka: Kafka | null = null;
    private producer: Producer | null = null;
    private isConnected = false;
    private messagesSent = 0;
    private errors = 0;

    /**
     * Inicializa a conexão com o Kafka (Producer)
     */
    async connect(): Promise<void> {
        if (!config.KAFKA_ENABLED) {
            console.log('[KAFKA-PRODUCER] Kafka producer desabilitado via configuracao');
            return;
        }

        console.log('');
        console.log('═══════════════════════════════════════════════════════');
        console.log('[KAFKA-PRODUCER] CONECTANDO AO KAFKA');
        console.log('═══════════════════════════════════════════════════════');
        console.log(`Broker: ${config.KAFKA_BROKER}`);
        console.log(`Topic: ${config.KAFKA_TOPIC_SEND}`);

        try {
            this.kafka = new Kafka({
                clientId: 'iot-isadatapro-ogx-middleware',
                brokers: [config.KAFKA_BROKER],
                logLevel: logLevel.WARN,
                retry: {
                    initialRetryTime: 1000,
                    retries: 5,
                },
            });

            this.producer = this.kafka.producer();
            await this.producer.connect();
            this.isConnected = true;

            console.log('[SUCCESS] Producer conectado ao Kafka');
            console.log('═══════════════════════════════════════════════════════');
            console.log('');
        } catch (error) {
            this.errors++;
            console.log('[ERROR] Erro ao conectar producer ao Kafka:', error);
            console.log('═══════════════════════════════════════════════════════');
            console.log('');
        }
    }

    /**
     * Desconecta do Kafka
     */
    async disconnect(): Promise<void> {
        if (this.producer && this.isConnected) {
            await this.producer.disconnect();
            this.isConnected = false;
            console.log('[KAFKA-PRODUCER] Desconectado do Kafka');
        }
    }

    /**
     * Publica uma mensagem convertida (formato OGx) no tópico send.message.ogx
     */
    async publishSendMessage(message: SendMessageOGx): Promise<void> {
        if (!config.KAFKA_ENABLED || !this.isConnected || !this.producer) {
            console.warn('[KAFKA-PRODUCER] Producer nao conectado, mensagem nao publicada');
            return;
        }

        try {
            const kafkaMessage = {
                key: message.DestinationID,
                value: JSON.stringify(message),
                timestamp: Date.now().toString(),
            };

            await this.producer.send({
                topic: config.KAFKA_TOPIC_SEND,
                messages: [kafkaMessage],
            });

            this.messagesSent++;
            console.log(`[KAFKA-PRODUCER] Mensagem para ${message.DestinationID} publicada no topic ${config.KAFKA_TOPIC_SEND}`);
        } catch (error) {
            this.errors++;
            console.error(`[KAFKA-PRODUCER] Erro ao publicar mensagem:`, error);
        }
    }

    /**
     * Retorna o estado atual do serviço Kafka Producer
     */
    getState(): { enabled: boolean; connected: boolean; topic: string; messagesSent: number; errors: number } {
        return {
            enabled: config.KAFKA_ENABLED,
            connected: this.isConnected,
            topic: config.KAFKA_TOPIC_SEND,
            messagesSent: this.messagesSent,
            errors: this.errors,
        };
    }
}

export const kafkaProducerService = new KafkaProducerService();
