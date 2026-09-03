import Stripe from 'stripe';
import { CatalogLineItem } from './catalog';
import Logger from '../Logging/Logger';
import { ILoggingContext } from '../Logging/ILogger';

export interface CheckoutSessionParams {
    lineItems: CatalogLineItem[];
    electionId: string;
    userId: string;
    checkoutSessionRowId: number;
    successUrl: string;
    cancelUrl: string;
}

export interface CheckoutSessionResult {
    sessionId: string;
    url: string;
}

export default class StripeService {
    private _client: Stripe;

    constructor() {
        const key = process.env.STRIPE_SECRET_KEY;
        if (!key) {
            throw new Error('STRIPE_SECRET_KEY is not configured');
        }
        this._client = new Stripe(key);
    }

    async createCheckoutSession(
        params: CheckoutSessionParams,
        ctx: ILoggingContext,
    ): Promise<CheckoutSessionResult> {
        Logger.debug(ctx, `StripeService.createCheckoutSession election_id=${params.electionId}`);

        const session = await this._client.checkout.sessions.create({
            mode: 'payment',
            submit_type: 'pay',
            client_reference_id: params.electionId,
            metadata: {
                election_id: params.electionId,
                user_id: params.userId,
                checkout_session_row_id: String(params.checkoutSessionRowId),
            },
            line_items: params.lineItems.map(item => ({
                price_data: item.price_data,
                quantity: item.quantity,
            })),
            custom_text: {
                after_submit: {
                    message: 'This is a program service fee paid to Equal Vote. It is not a charitable donation and is not tax-deductible.',
                },
            },
            success_url: params.successUrl,
            cancel_url: params.cancelUrl,
        });

        if (!session.url) {
            throw new Error('Stripe did not return a checkout URL');
        }

        return { sessionId: session.id, url: session.url };
    }
}
