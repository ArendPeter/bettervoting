import { randomUUID } from 'crypto';
import ServiceLocator from '../../ServiceLocator';
import Logger from '../../Services/Logging/Logger';
import { IElectionRequest } from '../../IRequest';
import { Response, NextFunction } from 'express';
import { BadRequest, Unauthorized } from '@curveball/http-errors';
import { permissions } from '@equal-vote/star-vote-shared/domain_model/permissions';
import { expectPermission } from '../controllerUtils';
import { CartItem, validateCart, buildLineItems, computeTotals } from '../../Services/Stripe/catalog';

const className = 'createCheckoutSessionController';

const createCheckoutSession = async (req: IElectionRequest, res: Response, next: NextFunction) => {
    Logger.info(req, `${className} election_id=${req.election.election_id}`);

    expectPermission(req.user_auth.roles, permissions.canEditElection);

    const userId: string = req.user?.sub;
    if (!userId) {
        throw new Unauthorized('User must be authenticated');
    }

    const items: CartItem[] = req.body?.items;
    if (!Array.isArray(items) || items.length === 0) {
        throw new BadRequest('Request body must include a non-empty items array');
    }

    const validationErr = validateCart(items, req.election);
    if (validationErr) {
        throw new BadRequest(validationErr.message);
    }

    const lineItems = buildLineItems(items);
    const { amount_cents, voter_count_granted } = computeTotals(items);

    const stripeCheckoutSessionsDb = ServiceLocator.stripeCheckoutSessionsDb();
    const stripeService = ServiceLocator.stripeService();

    const electionId = req.election.election_id;
    const frontendUrl = process.env.FRONTEND_URL || req.election.frontend_url || 'https://bettervoting.com';

    // Use a UUID placeholder so we can insert the row before creating the Stripe
    // session, then swap in the real session ID once Stripe responds.
    const placeholder = `pending_${randomUUID()}`;

    await stripeCheckoutSessionsDb.insert(
        {
            election_id: electionId,
            user_id: userId,
            line_items: lineItems,
            amount_cents,
            voter_count_granted,
            stripe_checkout_session_id: placeholder,
            status: 'pending',
            created_date: new Date().toISOString(),
        },
        req,
    );

    const inserted = await stripeCheckoutSessionsDb.getByStripeSessionId(placeholder, req);
    const rowId = inserted?.id ?? 0;

    const { sessionId, url } = await stripeService.createCheckoutSession(
        {
            lineItems,
            electionId,
            userId,
            checkoutSessionRowId: rowId,
            successUrl: `${frontendUrl}/${electionId}/admin/voters?payment=success`,
            cancelUrl: `${frontendUrl}/${electionId}/admin/voters?payment=cancelled`,
        },
        req,
    );

    await stripeCheckoutSessionsDb.updateStripeSessionId(placeholder, sessionId, req);

    Logger.info(req, `${className} created Stripe session ${sessionId} for election ${electionId}`);
    res.json({ url });
};

export { createCheckoutSession };
