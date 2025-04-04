// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import '../ExchangeERC20.sol';

contract ERC20 is ExchangeERC20 {

    constructor(uint256 initialSupply) {
        _mint(msg.sender, initialSupply);
    }

}
