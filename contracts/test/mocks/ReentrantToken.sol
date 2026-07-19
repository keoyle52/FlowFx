// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "../../src/FXPool.sol";

contract ReentrantToken is ERC20 {
    FXPool public targetPool;
    bool public attackOnTransferFrom;

    constructor(string memory name, string memory symbol) ERC20(name, symbol) {}

    function setTargetPool(address pool) external {
        targetPool = FXPool(pool);
    }

    function setAttackOnTransferFrom(bool enable) external {
        attackOnTransferFrom = enable;
    }

    function mint(address to, uint256 amount) external {
        _mint(to, amount);
    }

    function decimals() public pure override returns (uint8) {
        return 6;
    }

    function transferFrom(address from, address to, uint256 amount) public override returns (bool) {
        bool result = super.transferFrom(from, to, amount);
        if (attackOnTransferFrom && address(targetPool) != address(0)) {
            // Attempt reentrancy into pool swap
            attackOnTransferFrom = false; // prevent infinite recursion loop
            targetPool.swapUSDCtoEURC(10 * 1e6, 1);
        }
        return result;
    }
}
