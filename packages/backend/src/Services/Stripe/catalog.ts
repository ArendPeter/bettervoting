import { pricingConfig } from '@equal-vote/star-vote-shared/config';
import { Election } from '@equal-vote/star-vote-shared/domain_model/Election';

export type CartItemType = 'voter_limit_block';

export interface CartItem {
    type: CartItemType;
    quantity: number;
}

export interface StripePriceData {
    currency: string;
    unit_amount: number;
    product_data: {
        name: string;
        description: string;
    };
}

export interface CatalogLineItem {
    type: CartItemType;
    blocks: number;
    price_data: StripePriceData;
    quantity: number;
}

export interface ValidationError {
    type: string;
    message: string;
}

const MAX_VOTER_LIMIT = 5000;

const voterLimitBlockEntry = {
    buildPriceData(quantity: number): StripePriceData {
        const voters = quantity * pricingConfig.BLOCK_SIZE;
        return {
            currency: 'usd',
            unit_amount: pricingConfig.PRICE_PER_BLOCK_CENTS,
            product_data: {
                name: `${pricingConfig.BLOCK_SIZE} Additional Voters`,
                description: `Increases your election's voter limit by ${voters} (${quantity} block${quantity !== 1 ? 's' : ''} of ${pricingConfig.BLOCK_SIZE})`,
            },
        };
    },

    validateItem(item: CartItem, election: Election): string | null {
        const newLimit = (election.voter_limit ?? pricingConfig.FREE_TIER_LIMIT) + item.quantity * pricingConfig.BLOCK_SIZE;
        if (newLimit > MAX_VOTER_LIMIT) {
            return `Adding ${item.quantity} block(s) would set voter_limit to ${newLimit}, exceeding the maximum of ${MAX_VOTER_LIMIT}`;
        }
        return null;
    },

    voterCountGranted(quantity: number): number {
        return quantity * pricingConfig.BLOCK_SIZE;
    },
};

const CATALOG: Record<CartItemType, typeof voterLimitBlockEntry> = {
    voter_limit_block: voterLimitBlockEntry,
};

export const KNOWN_PRODUCT_TYPES = Object.keys(CATALOG) as CartItemType[];

export function validateCart(items: CartItem[], election: Election): ValidationError | null {
    for (const item of items) {
        if (!CATALOG[item.type]) {
            return { type: item.type, message: `Unknown product type: ${item.type}` };
        }
        const entry = CATALOG[item.type];
        const err = entry.validateItem(item, election);
        if (err) {
            return { type: item.type, message: err };
        }
    }
    return null;
}

export function buildLineItems(items: CartItem[]): CatalogLineItem[] {
    return items.map(item => {
        const entry = CATALOG[item.type];
        return {
            type: item.type,
            blocks: item.quantity,
            price_data: entry.buildPriceData(item.quantity),
            quantity: item.quantity,
        };
    });
}

export function computeTotals(items: CartItem[]): { amount_cents: number; voter_count_granted: number } {
    let amount_cents = 0;
    let voter_count_granted = 0;
    for (const item of items) {
        const entry = CATALOG[item.type];
        amount_cents += pricingConfig.PRICE_PER_BLOCK_CENTS * item.quantity;
        voter_count_granted += entry.voterCountGranted(item.quantity);
    }
    return { amount_cents, voter_count_granted };
}
