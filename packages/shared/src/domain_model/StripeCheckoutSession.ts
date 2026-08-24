import { Uid } from "./Uid";

export type StripeCheckoutSessionProduct = 'voter_limit';
export type StripeCheckoutSessionStatus = 'pending' | 'paid';

export interface StripeCheckoutSession {
    id?: number;
    election_id: Uid;
    user_id: Uid;
    product: StripeCheckoutSessionProduct;
    amount_cents: number;
    voter_count_granted?: number;
    stripe_checkout_session_id: string;
    stripe_customer_id?: string;
    status: StripeCheckoutSessionStatus;
    created_date: string;
}
