// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.0;

import './interfaces/IExchangePair.sol';
import './interfaces/IExchangeCallee.sol';
import './interfaces/IERC20.sol';
import './libraries/TransferHelper.sol';

contract ExchangeFlashLoan {
    uint256 private constant FEE_PRECISION = 10000;
    uint256 private constant FEE_PERCENT = 30; // 0.3%

    function flashLoan(
        address pair,
        uint256 amount0,
        uint256 amount1,
        bytes calldata data
    ) external {
        IExchangePair(pair).sync();
        
        IERC20 token0 = IERC20(IExchangePair(pair).token0());
        IERC20 token1 = IERC20(IExchangePair(pair).token1());
        
        uint256 balance0 = token0.balanceOf(pair);
        uint256 balance1 = token1.balanceOf(pair);
        
        require(amount0 > 0 || amount1 > 0, 'Exchange: INSUFFICIENT_AMOUNT');
        require(amount0 <= balance0 && amount1 <= balance1, 'Exchange: INSUFFICIENT_LIQUIDITY');

        uint256 fee0 = (amount0 * FEE_PERCENT) / FEE_PRECISION;
        uint256 fee1 = (amount1 * FEE_PERCENT) / FEE_PRECISION;

        if (amount0 > 0) {
            TransferHelper.safeTransfer(address(token0), msg.sender, amount0);
        }
        if (amount1 > 0) {
            TransferHelper.safeTransfer(address(token1), msg.sender, amount1);
        }

        IExchangeCallee(msg.sender).exchangeCall(msg.sender, amount0, amount1, data);

        if (amount0 > 0) {
            uint256 balance0New = token0.balanceOf(pair);
            require(balance0New >= balance0 + fee0, 'Exchange: INSUFFICIENT_FEE_0');
        }
        if (amount1 > 0) {
            uint256 balance1New = token1.balanceOf(pair);
            require(balance1New >= balance1 + fee1, 'Exchange: INSUFFICIENT_FEE_1');
        }

        IExchangePair(pair).sync();
    }
} 