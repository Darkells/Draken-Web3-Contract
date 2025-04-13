import { beforeEach, describe, it } from "node:test";
import { strict as assert } from "node:assert";
import { network } from "hardhat";
import { keccak256, AbiCoder, toUtf8Bytes } from "ethers";
import { signTypedData } from "viem/actions";

const abiCoder = new AbiCoder();
const TOTAL_SUPPLY = BigInt(10000) * BigInt(10n ** 18n);
const TEST_AMOUNT = BigInt(10) * BigInt(10n ** 18n);

describe("ExchangeERC20", async function () {
    const {viem} = await network.connect();
    const [wallet, spender] = await viem.getWalletClients();

    let token: any;
    beforeEach(async () => {
        token = await viem.deployContract("ERC20", [TOTAL_SUPPLY]);
    });

    it("should do something", async () => {
        assert.equal(await token.read.name(), "Exchange LP Token");
        assert.equal(await token.read.symbol(), "EX-LP");
        assert.equal(await token.read.decimals(), 18);
        assert.equal(await token.read.totalSupply(), TOTAL_SUPPLY);
        assert.equal(await token.read.balanceOf([wallet.account.address]), TOTAL_SUPPLY);
        
        const domainSeparator = keccak256(
            abiCoder.encode(
                ['bytes32', 'bytes32', 'bytes32', 'uint256', 'address'],
                [
                    keccak256(toUtf8Bytes('EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)')),
                    keccak256(toUtf8Bytes('Exchange LP Token')),
                    keccak256(toUtf8Bytes('1')),
                    BigInt(31337), // Hardhat default chainId
                    token.address
                ]
            )
        );
        assert.equal(await token.read.DOMAIN_SEPARATOR(), domainSeparator);
        assert.equal(await token.read.PERMIT_TYPEHASH(), keccak256(toUtf8Bytes('Permit(address owner,address spender,uint256 value,uint256 nonce,uint256 deadline)')));
    });

    it("approve", async () => {
        await token.write.approve([spender.account.address, TEST_AMOUNT], { account: wallet.account });
        assert.equal(await token.read.allowance([wallet.account.address, spender.account.address]), TEST_AMOUNT);
    });

    it("transfer", async () => {
        await token.write.transfer([spender.account.address, TEST_AMOUNT], { account: wallet.account });
        assert.equal(await token.read.balanceOf([wallet.account.address]), TOTAL_SUPPLY - TEST_AMOUNT);
        assert.equal(await token.read.balanceOf([spender.account.address]), TEST_AMOUNT);
    });

    it("transferFrom", async () => {
        // First approve
        await token.write.approve([spender.account.address, TEST_AMOUNT], { account: wallet.account });
        
        // Then transferFrom
        await token.write.transferFrom([wallet.account.address, spender.account.address, TEST_AMOUNT], { account: spender.account });
        
        assert.equal(await token.read.balanceOf([wallet.account.address]), TOTAL_SUPPLY - TEST_AMOUNT);
        assert.equal(await token.read.balanceOf([spender.account.address]), TEST_AMOUNT);
        assert.equal(await token.read.allowance([wallet.account.address, spender.account.address]), BigInt(0));
    });

    it("permit", async () => {
        const deadline = BigInt(Math.floor(Date.now() / 1000) + 3600);
        const nonce = await token.read.nonces([wallet.account.address]);
        
        // Get the correct PERMIT_TYPEHASH from the contract
        const PERMIT_TYPEHASH = await token.read.PERMIT_TYPEHASH();
        
        // Encode the permit data
        const permitData = abiCoder.encode(
            ['bytes32', 'address', 'address', 'uint256', 'uint256', 'uint256'],
            [
                PERMIT_TYPEHASH,
                wallet.account.address,
                spender.account.address,
                TEST_AMOUNT,
                nonce,
                deadline
            ]
        );
        
        // Get the domain separator from the contract
        const DOMAIN_SEPARATOR = await token.read.DOMAIN_SEPARATOR();
        
        // Create the digest according to EIP-712
        const digest = keccak256(
            abiCoder.encode(
                ['bytes32', 'bytes32', 'bytes32'],
                [
                    keccak256(toUtf8Bytes('\x19\x01')),
                    DOMAIN_SEPARATOR,
                    keccak256(permitData)
                ]
            )
        );
        
        // Sign the permit data using EIP-712
        const signature = await signTypedData(wallet, {
            account: wallet.account,
            domain: {
                name: "Exchange LP Token",
                version: "1",
                chainId: 31337n,
                verifyingContract: token.address
            },
            types: {
                EIP712Domain: [
                    { name: "name", type: "string" },
                    { name: "version", type: "string" },
                    { name: "chainId", type: "uint256" },
                    { name: "verifyingContract", type: "address" }
                ],
                Permit: [
                    { name: "owner", type: "address" },
                    { name: "spender", type: "address" },
                    { name: "value", type: "uint256" },
                    { name: "nonce", type: "uint256" },
                    { name: "deadline", type: "uint256" }
                ]
            },
            primaryType: "Permit",
            message: {
                owner: wallet.account.address,
                spender: spender.account.address,
                value: TEST_AMOUNT,
                nonce: nonce,
                deadline: deadline
            }
        });
        
        // Parse the signature into r, s, v components
        const r = signature.slice(0, 66);
        const s = `0x${signature.slice(66, 130)}`;
        const v = parseInt(signature.slice(130), 16);
        
        // Execute permit
        await token.write.permit(
            [wallet.account.address, spender.account.address, TEST_AMOUNT, deadline, v, r, s],
            { account: wallet.account }
        );
        
        assert.equal(await token.read.allowance([wallet.account.address, spender.account.address]), TEST_AMOUNT);
        assert.equal(await token.read.nonces([wallet.account.address]), nonce + BigInt(1));
    });
});
