import { config } from '../config/env.js';
import type { OGxMessage, IDPMessage } from '../types/ogws.types.js';

/**
 * Serviço para encaminhamento de mensagens via HTTP POST
 * Recebe mensagens OGx, converte para formato IDP e faz POST na Forward API
 * (core-isadatapro-orbcomm-middleware)
 */
class MessageForwarderService {
    private messagesSent = 0;
    private errors = 0;

    /**
     * Recebe uma mensagem OGx, converte para IDP e faz POST na Forward API
     */
    async forwardOGxMessage(ogxMessage: OGxMessage): Promise<void> {
        if (!config.FORWARD_API_ENABLED) {
            console.log('[FORWARD] Forward API desabilitada, ignorando');
            return;
        }

        // Converte OGx → IDP
        const idpMessage = this.convertOGxToIDP(ogxMessage);

        const body = {
            account_id: config.FORWARD_ACCOUNT_ID,
            Messages: [idpMessage],
        };

        console.log(`[FORWARD] Encaminhando mensagem ID=${ogxMessage.ID} MobileID=${ogxMessage.MobileID} para ${config.FORWARD_API_URL}`);

        try {
            const response = await fetch(config.FORWARD_API_URL, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(body),
            });

            if (!response.ok) {
                const text = await response.text();
                throw new Error(`HTTP ${response.status}: ${text}`);
            }

            this.messagesSent++;
            console.log(`[FORWARD] Mensagem ID=${ogxMessage.ID} encaminhada com sucesso`);
        } catch (error) {
            this.errors++;
            console.error('[FORWARD] Erro ao encaminhar mensagem:', error);
        }
    }

    /**
     * Converte mensagem OGx para formato IDP
     * - RawPayload: Base64 string → array de bytes
     * - Adiciona CustomerID e MobileOwnerID se ausentes
     */
    private convertOGxToIDP(msg: OGxMessage): IDPMessage {
        // Converte RawPayload de Base64 para array de bytes
        let rawPayloadBytes: number[] = [];
        if (typeof msg.RawPayload === 'string' && msg.RawPayload.length > 0) {
            rawPayloadBytes = Array.from(Buffer.from(msg.RawPayload, 'base64'));
            console.log(`[CONVERT OGx→IDP] RawPayload: base64 "${msg.RawPayload}" → ${rawPayloadBytes.length} bytes [${rawPayloadBytes.join(',')}]`);
        } else if (Array.isArray(msg.RawPayload)) {
            // Edge case: RawPayload já veio como array de bytes
            rawPayloadBytes = msg.RawPayload as unknown as number[];
            console.log(`[CONVERT OGx→IDP] RawPayload já é byte array: ${rawPayloadBytes.length} bytes`);
        }

        const idpMessage: IDPMessage = {
            ID: msg.ID,
            SIN: msg.SIN,
            MobileID: msg.MobileID,
            Transport: msg.Transport,
            CustomerID: msg.CustomerID ?? 0,
            MessageUTC: msg.MessageUTC,
            RawPayload: rawPayloadBytes,
            ReceiveUTC: msg.ReceiveUTC,
            RegionName: msg.RegionName,
            MobileOwnerID: msg.MobileOwnerID ?? config.FORWARD_ACCOUNT_ID,
            OTAMessageSize: msg.OTAMessageSize,
        };

        return idpMessage;
    }

    /**
     * Retorna o estado atual do serviço de encaminhamento
     */
    getState(): { enabled: boolean; url: string; messagesSent: number; errors: number } {
        return {
            enabled: config.FORWARD_API_ENABLED,
            url: config.FORWARD_API_URL,
            messagesSent: this.messagesSent,
            errors: this.errors,
        };
    }
}

export const messageForwarderService = new MessageForwarderService();
