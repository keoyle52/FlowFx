// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Script.sol";
import "../src/FXPool.sol";
import "../src/PaymentScheduler.sol";

contract DeployScript is Script {
    address public constant USDC_ARC_TESTNET = 0x3600000000000000000000000000000000000000;
    address public constant EURC_ARC_TESTNET = 0x89B50855Aa3bE2F677cD6303Cec089B5F319D72a;

    uint256 public constant INITIAL_RATE = 920000; // 1 USDC = 0.92 EURC
    uint256 public constant INITIAL_FEE_BPS = 30; // 0.3%

    function run() external {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        vm.startBroadcast(deployerPrivateKey);

        FXPool pool = new FXPool(
            USDC_ARC_TESTNET,
            EURC_ARC_TESTNET,
            INITIAL_RATE,
            INITIAL_FEE_BPS
        );
        console.log("FXPool deployed to:", address(pool));

        PaymentScheduler scheduler = new PaymentScheduler(address(pool));
        console.log("PaymentScheduler deployed to:", address(scheduler));

        vm.stopBroadcast();
    }
}
