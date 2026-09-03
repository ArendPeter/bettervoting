import { Uid } from "./Uid";

export type StripeCheckoutSessionProduct = 'voter_limit_block';
export type StripeCheckoutSessionStatus = 'pending' | 'paid';

// A cart line item as stored in stripeCheckoutSessionsDB — a full snapshot of
// the Stripe price_data for that item, tagged with the internal product type.
// Phase 1 ships only 'voter_limit_block'; extra fields (e.g. blocks) are
// included in the snapshot via the catalog's buildLineItems output.
export interface StripeCheckoutSessionLineItem {
    type: StripeCheckoutSessionProduct;
    price_data: unknown;
    quantity: number;
    blocks?: number;
}

export interface StripeCheckoutSession {
    id?: number;
    election_id: Uid;
    user_id: Uid;
    line_items: StripeCheckoutSessionLineItem[];
    amount_cents: number;
    voter_count_granted?: number;
    stripe_checkout_session_id: string;
    stripe_customer_id?: string;
    status: StripeCheckoutSessionStatus;
    created_date: string;
}
