import { CheckoutSessionParams, CheckoutSessionResult } from '../StripeService';
import { ILoggingContext } from '../../Logging/ILogger';
import Logger from '../../Logging/Logger';

export default class StripeService {
    public _sessions: Array<CheckoutSessionParams & { sessionId: string; url: string }> = [];
    private _nextId = 1;

    async createCheckoutSession(
        params: CheckoutSessionParams,
        ctx: ILoggingContext,
    ): Promise<CheckoutSessionResult> {
        Logger.debug(ctx, `MockStripeService.createCheckoutSession election_id=${params.electionId}`);
        const sessionId = `cs_test_mock_${this._nextId++}`;
        const url = `https://checkout.stripe.com/pay/${sessionId}`;
        this._sessions.push({ ...params, sessionId, url });
        return { sessionId, url };
    }
}
