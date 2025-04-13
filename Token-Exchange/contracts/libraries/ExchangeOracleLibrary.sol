// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.0;

import './UQ112x112.sol';
import './Math.sol';
import '../interfaces/IExchangePair.sol';

library ExchangeOracleLibrary {
    using UQ112x112 for uint224;

    // helper function that returns the current block timestamp within the range of uint32, i.e. [0, 2**32 - 1]
    function currentBlockTimestamp() internal view returns (uint32) {
        return uint32(block.timestamp % 2 ** 32);
    }

    // produces the cumulative price using counterfactuals to save gas and avoid a call to sync.
    function currentCumulativePrices(
        address pair
    ) internal view returns (uint price0Cumulative, uint price1Cumulative, uint32 blockTimestamp) {
        blockTimestamp = currentBlockTimestamp();
        price0Cumulative = IExchangePair(pair).price0CumulativeLast();
        price1Cumulative = IExchangePair(pair).price1CumulativeLast();

        // if time has elapsed since the last update on the pair, mock the accumulated price values
        (uint112 reserve0, uint112 reserve1, uint32 blockTimestampLast) = IExchangePair(pair).getReserves();
        if (blockTimestampLast != blockTimestamp) {
            // subtraction overflow is desired
            uint32 timeElapsed = blockTimestamp - blockTimestampLast;
            // addition overflow is desired
            // counterfactual
            price0Cumulative += uint(UQ112x112.encode(reserve1).uqdiv(reserve0)) * timeElapsed;
            // counterfactual
            price1Cumulative += uint(UQ112x112.encode(reserve0).uqdiv(reserve1)) * timeElapsed;
        }
    }

    // produces the cumulative price using counterfactuals to save gas and avoid a call to sync.
    function currentCumulativePrice0(
        address pair
    ) internal view returns (uint price0Cumulative, uint32 blockTimestamp) {
        blockTimestamp = currentBlockTimestamp();
        price0Cumulative = IExchangePair(pair).price0CumulativeLast();

        // if time has elapsed since the last update on the pair, mock the accumulated price values
        (uint112 reserve0, uint112 reserve1, uint32 blockTimestampLast) = IExchangePair(pair).getReserves();
        if (blockTimestampLast != blockTimestamp) {
            // subtraction overflow is desired
            uint32 timeElapsed = blockTimestamp - blockTimestampLast;
            // addition overflow is desired
            // counterfactual
            price0Cumulative += uint(UQ112x112.encode(reserve1).uqdiv(reserve0)) * timeElapsed;
        }
    }

    // produces the cumulative price using counterfactuals to save gas and avoid a call to sync.
    function currentCumulativePrice1(
        address pair
    ) internal view returns (uint price1Cumulative, uint32 blockTimestamp) {
        blockTimestamp = currentBlockTimestamp();
        price1Cumulative = IExchangePair(pair).price1CumulativeLast();

        // if time has elapsed since the last update on the pair, mock the accumulated price values
        (uint112 reserve0, uint112 reserve1, uint32 blockTimestampLast) = IExchangePair(pair).getReserves();
        if (blockTimestampLast != blockTimestamp) {
            // subtraction overflow is desired
            uint32 timeElapsed = blockTimestamp - blockTimestampLast;
            // addition overflow is desired
            // counterfactual
            price1Cumulative += uint(UQ112x112.encode(reserve0).uqdiv(reserve1)) * timeElapsed;
        }
    }

    function computeAveragePrice(
        uint224 priceCumulativeStart,
        uint224 priceCumulativeEnd,
        uint32 timeElapsed
    ) internal pure returns (uint224 priceAverage) {
        // overflow is desired.
        priceAverage = uint224((priceCumulativeEnd - priceCumulativeStart) / timeElapsed);
    }

    // given the cumulative prices of the start and end of a period, and the length of the period, compute the average
    // price in terms of how much amount out is received for the amount in
    function computeAmountOut(
        uint priceCumulativeStart,
        uint priceCumulativeEnd,
        uint timeElapsed,
        uint amountIn
    ) internal pure returns (uint amountOut) {
        // overflow is desired.
        uint224 priceAverage = uint224((priceCumulativeEnd - priceCumulativeStart) / timeElapsed);
        amountOut = uint(UQ112x112.encode(uint112(amountIn)).uqdiv(uint112(priceAverage)));
    }

    // given the cumulative prices of the start and end of a period, and the length of the period, compute the average
    // price in terms of how much amount in is required to receive the amount out
    function computeAmountIn(
        uint priceCumulativeStart,
        uint priceCumulativeEnd,
        uint timeElapsed,
        uint amountOut
    ) internal pure returns (uint amountIn) {
        // overflow is desired.
        uint224 priceAverage = uint224((priceCumulativeEnd - priceCumulativeStart) / timeElapsed);
        amountIn = (amountOut * 2**112) / uint(priceAverage);
    }
} 