require("dotenv").config();
import { TestHelper } from "./TestHelper";
import testInputs from "./testInputs";
import { validateCart, buildLineItems, computeTotals } from "../Services/Stripe/catalog";
import { Election } from "@equal-vote/star-vote-shared/domain_model/Election";
import { pricingConfig } from "@equal-vote/star-vote-shared/config";

// ─── Unit tests for catalog pure functions ────────────────────────────────────

const baseElection = (voterLimit: number): Election => ({
    election_id: "test",
    title: "test",
    state: "draft",
    frontend_url: "",
    owner_id: "owner",
    races: [],
    settings: { voter_access: "open", voter_authentication: { ip_address: true } },
    voter_limit: voterLimit,
} as unknown as Election);

describe("catalog – validateCart", () => {
    test("rejects unknown product type", () => {
        const err = validateCart([{ type: "unknown_product" as any, quantity: 1 }], baseElection(100));
        expect(err).not.toBeNull();
        expect(err!.type).toBe("unknown_product");
    });

    test("rejects voter_limit_block when new limit would exceed 5000", () => {
        const election = baseElection(4900); // 4900 + 1*200 = 5100 > 5000
        const err = validateCart([{ type: "voter_limit_block", quantity: 1 }], election);
        expect(err).not.toBeNull();
    });

    test("accepts voter_limit_block that brings limit to exactly 5000", () => {
        const election = baseElection(4800); // 4800 + 1*200 = 5000 exactly
        const err = validateCart([{ type: "voter_limit_block", quantity: 1 }], election);
        expect(err).toBeNull();
    });

    test("accepts a valid multi-block purchase", () => {
        const election = baseElection(100);
        const err = validateCart([{ type: "voter_limit_block", quantity: 3 }], election);
        expect(err).toBeNull();
    });
});

describe("catalog – buildLineItems", () => {
    test("returns one line item per cart item with price_data", () => {
        const items = buildLineItems([{ type: "voter_limit_block", quantity: 2 }]);
        expect(items).toHaveLength(1);
        expect(items[0].type).toBe("voter_limit_block");
        expect(items[0].quantity).toBe(2);
        expect(items[0].price_data.unit_amount).toBe(pricingConfig.PRICE_PER_BLOCK_CENTS);
        expect(items[0].price_data.currency).toBe("usd");
    });
});

describe("catalog – computeTotals", () => {
    test("computes amount_cents and voter_count_granted correctly", () => {
        const totals = computeTotals([{ type: "voter_limit_block", quantity: 3 }]);
        expect(totals.amount_cents).toBe(3 * pricingConfig.PRICE_PER_BLOCK_CENTS);
        expect(totals.voter_count_granted).toBe(3 * pricingConfig.BLOCK_SIZE);
    });
});

// ─── Integration tests for POST /API/Election/:id/CheckoutSession ─────────────

const th = new TestHelper();

afterEach(() => {
    jest.clearAllMocks();
    th.afterEach();
});

describe("POST /Election/:id/CheckoutSession", () => {
    beforeAll(() => {
        jest.clearAllMocks();
    });

    var electionId = "";

    test("Owner creates an election", async () => {
        const res = await th.createElection(
            { ...testInputs.Election1, state: "draft", voter_limit: 100 } as any,
            testInputs.user1token
        );
        expect(res.statusCode).toBe(200);
        electionId = res.election.election_id;
        th.testComplete();
    });

    test("Unauthenticated user receives 401", async () => {
        const res = await th.postRequest(
            `/API/Election/${electionId}/CheckoutSession`,
            { items: [{ type: "voter_limit_block", quantity: 1 }] },
            null
        );
        expect(res.statusCode).toBe(401);
        th.testComplete();
    });

    test("Non-owner receives 401", async () => {
        const res = await th.postRequest(
            `/API/Election/${electionId}/CheckoutSession`,
            { items: [{ type: "voter_limit_block", quantity: 1 }] },
            testInputs.user2token
        );
        expect(res.statusCode).toBe(401);
        th.testComplete();
    });

    test("Owner with unknown product type receives 400", async () => {
        const res = await th.postRequest(
            `/API/Election/${electionId}/CheckoutSession`,
            { items: [{ type: "donation_block", quantity: 1 }] },
            testInputs.user1token
        );
        expect(res.statusCode).toBe(400);
        th.testComplete();
    });

    test("Owner with quantity that would exceed 5000 voter limit receives 400", async () => {
        // voter_limit starts at 100; 25 blocks * 200 = 5000 more would make 5100 > 5000
        const res = await th.postRequest(
            `/API/Election/${electionId}/CheckoutSession`,
            { items: [{ type: "voter_limit_block", quantity: 25 }] },
            testInputs.user1token
        );
        expect(res.statusCode).toBe(400);
        th.testComplete();
    });

    test("Owner with valid cart receives 200 with checkout URL", async () => {
        const res = await th.postRequest(
            `/API/Election/${electionId}/CheckoutSession`,
            { items: [{ type: "voter_limit_block", quantity: 3 }] },
            testInputs.user1token
        );
        expect(res.statusCode).toBe(200);
        expect(res.body.url).toMatch(/^https:\/\//);
        th.testComplete();
    });
});
