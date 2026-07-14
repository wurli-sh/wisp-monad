// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";

/// @dev Local/CI only. Never deploy on Monad testnet (chain 10143).
contract MockUSDC is ERC20 {
    error UnsupportedChain(uint256 chainId);

    constructor() ERC20("Mock USDC", "mUSDC") {
        if (block.chainid != 31337 && block.chainid != 1337) {
            revert UnsupportedChain(block.chainid);
        }
    }

    function decimals() public pure override returns (uint8) {
        return 6;
    }

    function mint(address to, uint256 amount) external {
        _mint(to, amount);
    }
}
