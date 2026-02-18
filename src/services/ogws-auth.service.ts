import { config } from '../config/env.js';


/**
 * Resposta de autenticação OGWS
 */
interface OGWSTokenResponse {
    token_type: string;
    expires_in: number;
    access_token: string;
}


/**
 * Serviço de autenticação OGWS
 * Gerencia tokens Bearer para acesso à API ORBCOMM
 * 5 minutos antes de expirar
 */
class OGWSAuthService {
    private token: string | null = null;
    private tokenExpiresAt: Date | null = null;
    private readonly TOKEN_REFRESH_MARGIN_MS = 5 * 60 * 1000;


    /**
     * Obtém um token Bearer válido
     * Renova automaticamente se estiver próximo da expiração
     */
    async getToken(): Promise<string> {
        if (this.isTokenValid()) {
            return this.token!;
        }

        await this.authenticate();
        return this.token!;
    }


    /**
     * Verifica se o token atual é válido
     */
    private isTokenValid(): boolean {
        if (!this.token || !this.tokenExpiresAt) {
            return false;
        }

        const now = new Date();
        const expirationWithMargin = new Date(
            this.tokenExpiresAt.getTime() - this.TOKEN_REFRESH_MARGIN_MS
        );

        return now < expirationWithMargin;
    }


    /**
     * Autentica na API OGWS e obtém novo token
     * Usa OAuth2 client_credentials flow
     */
    async authenticate(): Promise<void> {
        const url = `${config.OGWS_BASE_URL}/auth/token`;

        console.log('');
        console.log('═══════════════════════════════════════════════════════');
        console.log('[AUTH] AUTENTICACAO OGWS');
        console.log('═══════════════════════════════════════════════════════');
        console.log(`URL: ${url}`);
        console.log(`Access ID: ${config.OGWS_ACCESS_ID}`);
        console.log(`Grant Type: client_credentials`);

        /**
         * OGWS usa x-www-form-urlencoded para autenticação
         */
        try {
            const body = new URLSearchParams({
                grant_type: 'client_credentials',
                client_id: config.OGWS_ACCESS_ID,
                client_secret: config.OGWS_PASSWORD,
            });

            const response = await fetch(url, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded',
                },
                body: body.toString(),
            });

            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(`HTTP ${response.status}: ${errorText}`);
            }

            const data = (await response.json()) as OGWSTokenResponse;

            this.token = data.access_token;
            this.tokenExpiresAt = new Date(Date.now() + data.expires_in * 1000);

            console.log('───────────────────────────────────────────────────────');
            console.log('[SUCCESS] AUTENTICACAO BEM-SUCEDIDA');
            console.log('───────────────────────────────────────────────────────');
            console.log(`Token Type: ${data.token_type}`);
            console.log(`Token: ${this.token.substring(0, 50)}...`);
            console.log(`Expira em: ${data.expires_in} segundos (${Math.round(data.expires_in / 86400)} dias)`);
            console.log(`Valido ate: ${this.tokenExpiresAt.toISOString()}`);
            console.log('═══════════════════════════════════════════════════════');
            console.log('');
        } catch (error) {
            console.log('───────────────────────────────────────────────────────');
            console.log('[ERROR] ERRO NA AUTENTICACAO');
            console.log('───────────────────────────────────────────────────────');
            console.log(`Erro: ${error}`);
            console.log('═══════════════════════════════════════════════════════');
            throw error;
        }
    }


    /**
     * Invalida todos os tokens da conta
     */
    async invalidateToken(): Promise<void> {
        if (!this.token) return;

        try {
            const url = `${config.OGWS_BASE_URL}/auth/invalidate_tokens`;

            await fetch(url, {
                method: 'GET',
                headers: {
                    Authorization: `Bearer ${this.token}`,
                },
            });

            console.log('[INFO] Tokens invalidados com sucesso');
        } catch (error) {
            console.error('[WARN] Erro ao invalidar tokens:', error);
        } finally {
            this.token = null;
            this.tokenExpiresAt = null;
        }
    }


    /**
     * Retorna informações sobre o estado da autenticação
     */
    getAuthStatus(): { authenticated: boolean; expiresAt: string | null } {
        return {
            authenticated: this.isTokenValid(),
            expiresAt: this.tokenExpiresAt?.toISOString() || null,
        };
    }
}

export const ogwsAuthService = new OGWSAuthService();
