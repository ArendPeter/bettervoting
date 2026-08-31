require('dotenv').config();
import { TestHelper } from './TestHelper';
import testInputs from './testInputs';
import ServiceLocator from '../ServiceLocator';
import { pricingConfig } from '@equal-vote/star-vote-shared/config';

const th = new TestHelper();

afterEach(() => {
    jest.clearAllMocks();
    th.afterEach();
});

const setupClosedElectionWithLimit = async (voterLimit: number) => {
    const response = await th.createElection(testInputs.IDRollElection, testInputs.user1token);
    expect(response.statusCode).toBe(200);
    const ID = response.election.election_id;
    // Directly patch voter_limit on the mock to test low-limit behavior
    const mockDb = ServiceLocator.electionsDb() as any;
    const election = mockDb.elections.find((e: any) => e.election_id === ID);
    election.voter_limit = voterLimit;
    return ID;
};

describe("Voter Limit Roll", () => {

    describe("Voter limit resolution uses election.voter_limit", () => {
        test("Adding voters within the limit succeeds", async () => {
            const ID = await setupClosedElectionWithLimit(3);
            const rolls = [{ voter_id: 'voter1' }, { voter_id: 'voter2' }];
            const response = await th.submitElectionRoll(ID, rolls, testInputs.user1token);
            expect(response.statusCode).toBe(200);
            th.testComplete();
        });

        test("Exceeding election.voter_limit returns 402 (not 400)", async () => {
            const ID = await setupClosedElectionWithLimit(2);
            // Fill the limit
            await th.submitElectionRoll(ID, [{ voter_id: 'voter1' }, { voter_id: 'voter2' }], testInputs.user1token);
            // One more should be blocked
            const response = await th.submitElectionRoll(ID, [{ voter_id: 'voter3' }], testInputs.user1token);
            expect(response.statusCode).toBe(402);
            th.testComplete();
        });
    });

    describe("PAYMENT_REQUIRED response shape", () => {
        test("Response body includes required fields with correct values", async () => {
            const limit = 2;
            const ID = await setupClosedElectionWithLimit(limit);
            await th.submitElectionRoll(ID, [{ voter_id: 'v1' }, { voter_id: 'v2' }], testInputs.user1token);
            const response = await th.submitElectionRoll(ID, [{ voter_id: 'v3' }, { voter_id: 'v4' }], testInputs.user1token);

            expect(response.statusCode).toBe(402);
            expect(response.body.code).toBe('PAYMENT_REQUIRED');
            expect(response.body.error).toContain(`limited to ${limit} voters`);
            expect(response.body.currentVoterLimit).toBe(limit);
            expect(response.body.requestedVoterCount).toBe(4); // 2 existing + 2 new
            expect(response.body.blockSize).toBe(pricingConfig.BLOCK_SIZE);
            expect(response.body.pricePerBlockCents).toBe(pricingConfig.PRICE_PER_BLOCK_CENTS);
            th.testComplete();
        });
    });

    describe("createElection sets voter_limit from pricingConfig", () => {
        test("New election gets voter_limit = FREE_TIER_LIMIT", async () => {
            const response = await th.createElection(testInputs.IDRollElection, testInputs.user1token);
            expect(response.statusCode).toBe(200);
            expect(response.election.voter_limit).toBe(pricingConfig.FREE_TIER_LIMIT);
            th.testComplete();
        });
    });
});

describe("Edit election does not change voter_limit", () => {
    test("Client-submitted voter_limit is discarded on edit", async () => {
        const createRes = await th.createElection(testInputs.Election1, testInputs.user1token);
        expect(createRes.statusCode).toBe(200);
        const ID = createRes.election.election_id;
        const originalLimit = createRes.election.voter_limit;

        // Try to submit an edit with a different voter_limit
        const electionWithChangedLimit = {
            ...testInputs.Election1,
            election_id: ID,
            voter_limit: 99999,
        };
        const editRes = await th.editElection(electionWithChangedLimit, testInputs.user1token);
        expect(editRes.statusCode).toBe(200);
        // voter_limit should NOT have changed
        expect(editRes.election.voter_limit).toBe(originalLimit);
        th.testComplete();
    });
});
