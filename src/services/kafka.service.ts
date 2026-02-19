import { Kafka, Producer, logLevel } from 'kafkajs';
import { config } from '../config/env.js';
import type { ReturnMessage } from '../types/ogws.types.js';

/**
 * Serviço para publicação de mensagens no Kafka
 */
class KafkaService {
    private kafka: Kafka | null = null;
    private producer: Producer | null = null;
    private isConnected = false;
    private messagesSent = 0;
    private errors = 0;

    /**
     * Inicializa a conexão com o Kafka
     */
    async connect(): Promise<void> {
        if (!config.KAFKA_ENABLED) {
            console.log('[KAFKA] Kafka desabilitado via configuracao');
            return;
        }

        console.log('');
        console.log('═══════════════════════════════════════════════════════');
        console.log('[KAFKA] CONECTANDO AO KAFKA');
        console.log('═══════════════════════════════════════════════════════');
        console.log(`Broker: ${config.KAFKA_BROKER}`);
        console.log(`Topic: ${config.KAFKA_TOPIC}`);

        try {
            this.kafka = new Kafka({
                clientId: 'iot-orbcomm-middleware',
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

            console.log('[SUCCESS] Conectado ao Kafka');
            console.log('═══════════════════════════════════════════════════════');
            console.log('');
        } catch (error) {
            this.errors++;
            console.log('[ERROR] Erro ao conectar ao Kafka:', error);
            console.log('[WARN] Mensagens serao apenas logadas, nao publicadas');
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
            console.log('[KAFKA] Desconectado do Kafka');
        }
    }

    /**
     * Publica uma mensagem no tópico Kafka
     */
    async publishMessage(message: ReturnMessage): Promise<void> {
        if (!config.KAFKA_ENABLED || !this.isConnected || !this.producer) {
            return;
        }

        try {
            const kafkaMessage = {
                key: message.MobileID,
                value: JSON.stringify({
                    id: message.ID,
                    mobileId: message.MobileID,
                    sin: message.SIN,
                    messageUTC: message.MessageUTC,
                    receiveUTC: message.ReceiveUTC,
                    payload: message.Payload || null,
                    rawPayload: message.RawPayload || null,
                    regionName: message.RegionName || null,
                    otaMessageSize: message.OTAMessageSize,
                    transport: message.Transport,
                    network: message.Network,
                    timestamp: new Date().toISOString(),
                }),
                timestamp: Date.now().toString(),
            };

            await this.producer.send({
                topic: config.KAFKA_TOPIC,
                messages: [kafkaMessage],
            });

            this.messagesSent++;
            console.log(`[KAFKA] Mensagem ${message.ID} publicada no topic ${config.KAFKA_TOPIC}`);
        } catch (error) {
            this.errors++;
            console.error(`[KAFKA] Erro ao publicar mensagem ${message.ID}:`, error);
        }
    }

    /**
     * Publica múltiplas mensagens no Kafka
     */
    async publishMessages(messages: ReturnMessage[]): Promise<void> {
        if (!config.KAFKA_ENABLED || !this.isConnected || !this.producer || messages.length === 0) {
            return;
        }

        console.log(`[KAFKA] Publicando ${messages.length} mensagem(ns) no Kafka...`);

        try {
            const kafkaMessages = messages.map(msg => ({
                key: msg.MobileID,
                value: JSON.stringify({
                    id: msg.ID,
                    mobileId: msg.MobileID,
                    sin: msg.SIN,
                    messageUTC: msg.MessageUTC,
                    receiveUTC: msg.ReceiveUTC,
                    payload: msg.Payload || null,
                    rawPayload: msg.RawPayload || null,
                    regionName: msg.RegionName || null,
                    otaMessageSize: msg.OTAMessageSize,
                    transport: msg.Transport,
                    network: msg.Network,
                    timestamp: new Date().toISOString(),
                }),
                timestamp: Date.now().toString(),
            }));

            await this.producer.send({
                topic: config.KAFKA_TOPIC,
                messages: kafkaMessages,
            });

            this.messagesSent += messages.length;
            console.log(`[KAFKA] ${messages.length} mensagem(ns) publicada(s) com sucesso`);
        } catch (error) {
            this.errors++;
            console.error('[KAFKA] Erro ao publicar mensagens em lote:', error);
            
            // Tenta publicar individualmente
            for (const msg of messages) {
                await this.publishMessage(msg);
            }
        }
    }

    /**
     * Retorna o estado atual do serviço Kafka
     */
    getState(): { enabled: boolean; connected: boolean; messagesSent: number; errors: number } {
        return {
            enabled: config.KAFKA_ENABLED,
            connected: this.isConnected,
            messagesSent: this.messagesSent,
            errors: this.errors,
        };
    }
}

export const kafkaService = new KafkaService();

