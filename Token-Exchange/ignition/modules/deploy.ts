import { buildModule } from "@nomicfoundation/hardhat-ignition/modules";

export default buildModule("TokenExchange", (m) => {
    console.log("Starting deployment...");

    // 部署 ERC20 代币
    console.log("Deploying TokenA...");
    const tokenA = m.contract("ExchangeERC20", [], { id: "TokenA" });
    console.log("Deploying TokenB...");
    const tokenB = m.contract("ExchangeERC20", [], { id: "TokenB" });
    console.log("Deploying TokenA...");
    const tokenC = m.contract("ExchangeERC20", [], { id: "TokenA" });
    console.log("Deploying TokenB...");
    const tokenD = m.contract("ExchangeERC20", [], { id: "TokenB" });

    // 部署 Factory
    console.log("Getting deployer account...");
    const deployer = m.getAccount(0);
    console.log("Deploying Factory...");
    const factory = m.contract("ExchangeFactory", [deployer], { id: "Factory" });

    // 部署 WETH
    console.log("Deploying WETH...");
    const weth = m.contract("WETH9", [], { id: "WETH" });

    // 部署 Router
    console.log("Deploying Router...");
    const router = m.contract("ExchangeRouter", [factory, weth], { id: "Router" });

    console.log("Deployment completed!");

    return {
        tokenA,
        tokenB,
        tokenC,
        tokenD,
        factory,
        router,
        weth
    };
}); 