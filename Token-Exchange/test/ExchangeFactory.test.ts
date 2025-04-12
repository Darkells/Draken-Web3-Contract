import { beforeEach, describe, it } from "node:test";
import { strict as assert } from "node:assert";
import { network } from "hardhat";
import { parseEther, getAddress } from "viem";

describe("ExchangeFactory", async function () {
    const { viem } = await network.connect();
    const [wallet, other] = await viem.getWalletClients();

    let factory: any;
    let token0: any;
    let token1: any;
    const TOTAL_SUPPLY = parseEther("10000");

    beforeEach(async () => {
        // Deploy factory with wallet as feeToSetter
        factory = await viem.deployContract("ExchangeFactory", [wallet.account.address]);

        // Deploy test tokens
        token0 = await viem.deployContract("ERC20", [TOTAL_SUPPLY]);
        token1 = await viem.deployContract("ERC20", [TOTAL_SUPPLY]);
    });

    it("should have correct initial state", async () => {
        const feeToSetter = await factory.read.feeToSetter();
        const feeTo = await factory.read.feeTo();
        const allPairsLength = await factory.read.allPairsLength();

        assert.equal(getAddress(feeToSetter), getAddress(wallet.account.address), "FeeToSetter mismatch");
        assert.equal(getAddress(feeTo), getAddress("0x0000000000000000000000000000000000000000"), "FeeTo should be zero address");
        assert.equal(allPairsLength, BigInt(0), "AllPairsLength should be zero");
    });

    it("should create pair", async () => {
        // Create pair
        await factory.write.createPair([token0.address, token1.address]);

        // Get pair address
        const pairAddress = await factory.read.getPair([token0.address, token1.address]);
        assert.notEqual(getAddress(pairAddress), getAddress("0x0000000000000000000000000000000000000000"), "Pair address should not be zero");

        // Verify pair exists in both directions
        const reversePairAddress = await factory.read.getPair([token1.address, token0.address]);
        assert.equal(getAddress(pairAddress), getAddress(reversePairAddress), "Pair addresses should match in both directions");

        // Verify allPairs length
        const allPairsLength = await factory.read.allPairsLength();
        assert.equal(allPairsLength, BigInt(1), "AllPairsLength should be one");

        // Verify pair is in allPairs array
        const pairFromArray = await factory.read.allPairs([BigInt(0)]);
        assert.equal(getAddress(pairFromArray), getAddress(pairAddress), "Pair should be in allPairs array");
    });

    it("should not create pair with identical addresses", async () => {
        try {
            await factory.write.createPair([token0.address, token0.address]);
            assert.fail("Should have thrown");
        } catch (error: any) {
            assert.ok(error.message.includes("Exchange: IDENTICAL_ADDRESSES"), "Should throw IDENTICAL_ADDRESSES error");
        }
    });

    it("should not create pair with zero address", async () => {
        try {
            await factory.write.createPair([token0.address, "0x0000000000000000000000000000000000000000"]);
            assert.fail("Should have thrown");
        } catch (error: any) {
            assert.ok(error.message.includes("Exchange: ZERO_ADDRESS"), "Should throw ZERO_ADDRESS error");
        }
    });

    it("should not create pair twice", async () => {
        // Create pair first time
        await factory.write.createPair([token0.address, token1.address]);

        // Try to create pair again
        try {
            await factory.write.createPair([token0.address, token1.address]);
            assert.fail("Should have thrown");
        } catch (error: any) {
            assert.ok(error.message.includes("Exchange: PAIR_EXISTS"), "Should throw PAIR_EXISTS error");
        }
    });

    it("should set feeTo", async () => {
        // Set feeTo
        await factory.write.setFeeTo([other.account.address], { account: wallet.account });

        // Verify feeTo was set
        const feeTo = await factory.read.feeTo();
        assert.equal(getAddress(feeTo), getAddress(other.account.address), "FeeTo should be set to other address");
    });

    it("should not set feeTo if not feeToSetter", async () => {
        try {
            await factory.write.setFeeTo([other.account.address], { account: other.account });
            assert.fail("Should have thrown");
        } catch (error: any) {
            assert.ok(error.message.includes("Exchange: FORBIDDEN"), "Should throw FORBIDDEN error");
        }
    });

    it("should set feeToSetter", async () => {
        // Set feeToSetter
        await factory.write.setFeeToSetter([other.account.address], { account: wallet.account });

        // Verify feeToSetter was set
        const feeToSetter = await factory.read.feeToSetter();
        assert.equal(getAddress(feeToSetter), getAddress(other.account.address), "FeeToSetter should be set to other address");
    });

    it("should not set feeToSetter if not current feeToSetter", async () => {
        try {
            await factory.write.setFeeToSetter([other.account.address], { account: other.account });
            assert.fail("Should have thrown");
        } catch (error: any) {
            assert.ok(error.message.includes("Exchange: FORBIDDEN"), "Should throw FORBIDDEN error");
        }
    });
}); 