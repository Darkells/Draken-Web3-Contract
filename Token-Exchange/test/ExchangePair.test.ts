import { beforeEach, describe, it } from "node:test";
import { strict as assert } from "node:assert";
import { network } from "hardhat";
import { parseEther, getAddress } from "viem";

describe("ExchangePair", async function () {
    const { viem } = await network.connect();
    const [wallet, other] = await viem.getWalletClients();

    let factory: any;
    let token0: any;
    let token1: any;
    let pair: any;
    const MINIMUM_LIQUIDITY = BigInt(10) ** BigInt(3);
    const TOTAL_SUPPLY = parseEther("10000");
    const TEST_AMOUNT = parseEther("100");

    beforeEach(async () => {
        // Deploy factory
        factory = await viem.deployContract("ExchangeFactory", [wallet.account.address]);

        // Deploy test tokens
        token0 = await viem.deployContract("ERC20", [TOTAL_SUPPLY]);
        token1 = await viem.deployContract("ERC20", [TOTAL_SUPPLY]);

        // Sort tokens by address
        const [tokenA, tokenB] = getAddress(token0.address) < getAddress(token1.address) 
            ? [token0, token1] 
            : [token1, token0];
        token0 = tokenA;
        token1 = tokenB;

        // Create pair
        await factory.write.createPair([token0.address, token1.address]);
        const pairAddress = await factory.read.getPair([token0.address, token1.address]);
        pair = await viem.getContractAt("ExchangePair", pairAddress);
    });

    it("should have correct initial state", async () => {
        const factoryAddress = await pair.read.factory();
        const token0Address = await pair.read.token0();
        const token1Address = await pair.read.token1();
        
        // Compare addresses after normalizing them
        assert.equal(getAddress(factoryAddress), getAddress(factory.address), "Factory address mismatch");
        assert.equal(getAddress(token0Address), getAddress(token0.address), "Token0 address mismatch");
        assert.equal(getAddress(token1Address), getAddress(token1.address), "Token1 address mismatch");
        assert.equal(await pair.read.MINIMUM_LIQUIDITY(), MINIMUM_LIQUIDITY, "Minimum liquidity mismatch");
    });

    it("should mint initial liquidity", async () => {
        // Transfer tokens to pair first
        await token0.write.transfer([pair.address, TEST_AMOUNT], { account: wallet.account });
        await token1.write.transfer([pair.address, TEST_AMOUNT], { account: wallet.account });

        // Add liquidity
        await pair.write.mint([wallet.account.address], { account: wallet.account });

        // Check reserves
        const [reserve0, reserve1] = await pair.read.getReserves();
        assert.equal(reserve0, TEST_AMOUNT, "Reserve0 mismatch");
        assert.equal(reserve1, TEST_AMOUNT, "Reserve1 mismatch");

        // Check LP token balance
        const lpBalance = await pair.read.balanceOf([wallet.account.address]);
        assert.ok(lpBalance > BigInt(0), "LP balance should be positive");
    });

    it("should swap tokens", async () => {
        // First add liquidity
        await token0.write.transfer([pair.address, TEST_AMOUNT], { account: wallet.account });
        await token1.write.transfer([pair.address, TEST_AMOUNT], { account: wallet.account });
        await pair.write.mint([wallet.account.address], { account: wallet.account });

        // Get reserves before swap
        const [reserve0, reserve1] = await pair.read.getReserves();
        
        // Calculate expected output amount using constant product formula
        const amountIn = parseEther("1");
        const amountInWithFee = amountIn * BigInt(997);
        const numerator = amountInWithFee * reserve1;
        const denominator = reserve0 * BigInt(1000) + amountInWithFee;
        const expectedOutput = numerator / denominator;

        // Transfer tokens for swap
        await token0.write.transfer([pair.address, amountIn], { account: wallet.account });

        // Perform swap - note the order of parameters: amount0Out, amount1Out, to, data
        await pair.write.swap([BigInt(0), expectedOutput, wallet.account.address, "0x"], { account: wallet.account });

        // Check reserves
        const [newReserve0, newReserve1] = await pair.read.getReserves();
        const expectedReserve0 = reserve0 + amountIn;
        const expectedReserve1 = reserve1 - expectedOutput;
        
        assert.equal(newReserve0, expectedReserve0, `New reserve0 mismatch: expected ${expectedReserve0}, got ${newReserve0}`);
        assert.equal(newReserve1, expectedReserve1, `New reserve1 mismatch: expected ${expectedReserve1}, got ${newReserve1}`);
    });

    it("should burn liquidity", async () => {
        // First add liquidity
        await token0.write.transfer([pair.address, TEST_AMOUNT], { account: wallet.account });
        await token1.write.transfer([pair.address, TEST_AMOUNT], { account: wallet.account });
        await pair.write.mint([wallet.account.address], { account: wallet.account });

        // Get initial balances
        const initialBalance0 = await token0.read.balanceOf([wallet.account.address]);
        const initialBalance1 = await token1.read.balanceOf([wallet.account.address]);

        // Transfer LP tokens to pair for burning
        const lpBalance = await pair.read.balanceOf([wallet.account.address]);
        await pair.write.transfer([pair.address, lpBalance], { account: wallet.account });

        // Burn liquidity
        await pair.write.burn([wallet.account.address], { account: wallet.account });

        // Check final balances
        const finalBalance0 = await token0.read.balanceOf([wallet.account.address]);
        const finalBalance1 = await token1.read.balanceOf([wallet.account.address]);
        assert.ok(finalBalance0 > initialBalance0, "Final balance0 should be greater than initial");
        assert.ok(finalBalance1 > initialBalance1, "Final balance1 should be greater than initial");
    });

    it("should handle fees correctly", async () => {
        // Set fee to
        await factory.write.setFeeTo([other.account.address], { account: wallet.account });

        // Add initial liquidity
        await token0.write.transfer([pair.address, TEST_AMOUNT], { account: wallet.account });
        await token1.write.transfer([pair.address, TEST_AMOUNT], { account: wallet.account });
        await pair.write.mint([wallet.account.address], { account: wallet.account });

        // Get reserves before swap
        const [reserve0, reserve1] = await pair.read.getReserves();
        
        // Calculate expected output amount using constant product formula
        const amountIn = parseEther("1");
        const amountInWithFee = amountIn * BigInt(997);
        const numerator = amountInWithFee * reserve1;
        const denominator = reserve0 * BigInt(1000) + amountInWithFee;
        const expectedOutput = numerator / denominator;

        // Perform some swaps to generate fees
        await token0.write.transfer([pair.address, amountIn], { account: wallet.account });
        await pair.write.swap([BigInt(0), expectedOutput, wallet.account.address, "0x"], { account: wallet.account });

        // Add more liquidity to trigger fee minting
        await token0.write.transfer([pair.address, TEST_AMOUNT], { account: wallet.account });
        await token1.write.transfer([pair.address, TEST_AMOUNT], { account: wallet.account });
        await pair.write.mint([wallet.account.address], { account: wallet.account });

        // Check if fee recipient received LP tokens
        const feeRecipientBalance = await pair.read.balanceOf([other.account.address]);
        assert.ok(feeRecipientBalance > BigInt(0), "Fee recipient should have LP tokens");
    });

    it("should handle price accumulators", async () => {
        // Add initial liquidity
        await token0.write.transfer([pair.address, TEST_AMOUNT], { account: wallet.account });
        await token1.write.transfer([pair.address, TEST_AMOUNT], { account: wallet.account });
        await pair.write.mint([wallet.account.address], { account: wallet.account });

        // Get initial price accumulators
        const initialPrice0 = await pair.read.price0CumulativeLast();
        const initialPrice1 = await pair.read.price1CumulativeLast();

        // Get reserves before swap
        const [reserve0, reserve1] = await pair.read.getReserves();
        
        // Calculate expected output amount using constant product formula
        const amountIn = parseEther("1");
        const amountInWithFee = amountIn * BigInt(997);
        const numerator = amountInWithFee * reserve1;
        const denominator = reserve0 * BigInt(1000) + amountInWithFee;
        const expectedOutput = numerator / denominator;

        // Perform some swaps
        await token0.write.transfer([pair.address, amountIn], { account: wallet.account });
        await pair.write.swap([BigInt(0), expectedOutput, wallet.account.address, "0x"], { account: wallet.account });

        // Get final price accumulators
        const finalPrice0 = await pair.read.price0CumulativeLast();
        const finalPrice1 = await pair.read.price1CumulativeLast();

        assert.ok(finalPrice0 > initialPrice0, "Price0 accumulator should increase");
        assert.ok(finalPrice1 > initialPrice1, "Price1 accumulator should increase");
    });
}); 