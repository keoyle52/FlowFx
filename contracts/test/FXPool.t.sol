// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Test.sol";
import "../src/FXPool.sol";
import "./mocks/MockERC20.sol";
import "./mocks/ReentrantToken.sol";

contract FXPoolTest is Test {
    FXPool public pool;
    MockERC20 public usdc;
    MockERC20 public eurc;

    address public owner = address(this);
    address public user = address(0x1);
    address public nonOwner = address(0x99);

    uint256 public constant INITIAL_RATE = 920000; // 1 USDC = 0.92 EURC
    uint256 public constant INITIAL_FEE_BPS = 30; // 0.3%

    function setUp() public {
        usdc = new MockERC20("USD Coin", "USDC", 6);
        eurc = new MockERC20("Euro Coin", "EURC", 6);

        pool = new FXPool(address(usdc), address(eurc), INITIAL_RATE, INITIAL_FEE_BPS);

        // Mint liquidity for pool
        usdc.mint(owner, 1_000_000 * 1e6);
        eurc.mint(owner, 1_000_000 * 1e6);

        usdc.approve(address(pool), type(uint256).max);
        eurc.approve(address(pool), type(uint256).max);

        pool.addLiquidity(500_000 * 1e6, 500_000 * 1e6);

        // Mint tokens for user
        usdc.mint(user, 10_000 * 1e6);
        eurc.mint(user, 10_000 * 1e6);

        vm.startPrank(user);
        usdc.approve(address(pool), type(uint256).max);
        eurc.approve(address(pool), type(uint256).max);
        vm.stopPrank();
    }

    function testAddAndRemoveLiquidity() public {
        uint256 usdcBefore = usdc.balanceOf(address(pool));
        uint256 eurcBefore = eurc.balanceOf(address(pool));

        pool.addLiquidity(1_000 * 1e6, 2_000 * 1e6);

        assertEq(usdc.balanceOf(address(pool)), usdcBefore + 1_000 * 1e6);
        assertEq(eurc.balanceOf(address(pool)), eurcBefore + 2_000 * 1e6);

        pool.removeLiquidity(500 * 1e6, 1_000 * 1e6);

        assertEq(usdc.balanceOf(address(pool)), usdcBefore + 500 * 1e6);
        assertEq(eurc.balanceOf(address(pool)), eurcBefore + 1_000 * 1e6);
    }

    function testSwapUSDCtoEURC_HappyPath() public {
        uint256 usdcIn = 100 * 1e6; // 100 USDC
        uint256 expectedEurcOut = 91_724_000;

        vm.prank(user);
        uint256 eurcReceived = pool.swapUSDCtoEURC(usdcIn, expectedEurcOut);

        assertEq(eurcReceived, expectedEurcOut);
        assertEq(eurc.balanceOf(user), 10_000 * 1e6 + expectedEurcOut);
    }

    function testSwapEURCtoUSDC_HappyPath() public {
        uint256 eurcIn = 92 * 1e6; // 92 EURC
        uint256 expectedUsdcOut = 99_700_000;

        vm.prank(user);
        uint256 usdcReceived = pool.swapEURCtoUSDC(eurcIn, expectedUsdcOut);

        assertEq(usdcReceived, expectedUsdcOut);
        assertEq(usdc.balanceOf(user), 10_000 * 1e6 + expectedUsdcOut);
    }

    function testSlippageProtection_Reverts() public {
        uint256 usdcIn = 100 * 1e6;
        uint256 minEurcOut = 92 * 1e6; // Expecting no fee (will fail)

        vm.prank(user);
        vm.expectRevert("Slippage limit exceeded");
        pool.swapUSDCtoEURC(usdcIn, minEurcOut);
    }

    function testInsufficientLiquidity_Reverts() public {
        // Swap more than pool balance (pool has 500k EURC)
        uint256 hugeUsdcIn = 1_000_000 * 1e6;
        usdc.mint(user, hugeUsdcIn);

        vm.prank(user);
        vm.expectRevert("Insufficient EURC liquidity");
        pool.swapUSDCtoEURC(hugeUsdcIn, 1);
    }

    function testReentrancyAttack_Reverts() public {
        ReentrantToken attackUsdc = new ReentrantToken("Attack USDC", "aUSDC");
        FXPool attackPool = new FXPool(address(attackUsdc), address(eurc), INITIAL_RATE, INITIAL_FEE_BPS);

        attackUsdc.setTargetPool(address(attackPool));
        attackUsdc.mint(user, 1_000 * 1e6);

        // Add EURC liquidity to attack pool
        eurc.mint(address(this), 10_000 * 1e6);
        eurc.approve(address(attackPool), type(uint256).max);
        attackPool.addLiquidity(0, 10_000 * 1e6);

        vm.startPrank(user);
        attackUsdc.approve(address(attackPool), type(uint256).max);
        attackUsdc.setAttackOnTransferFrom(true);

        // Reentrant call will trigger ReentrancyGuardReentrantCall() from OpenZeppelin ReentrancyGuard
        vm.expectRevert(abi.encodeWithSignature("ReentrancyGuardReentrantCall()"));
        attackPool.swapUSDCtoEURC(100 * 1e6, 1);
        vm.stopPrank();
    }

    function testSetRateAndFee_Owner() public {
        pool.setRate(950000); // 1 USDC = 0.95 EURC
        (uint256 rateNumerator,,) = pool.getRate();
        assertEq(rateNumerator, 950000);

        pool.setFeeBps(50); // 0.5%
        (,, uint256 feeBps) = pool.getRate();
        assertEq(feeBps, 50);
    }

    function testSetRate_NonOwner_Reverts() public {
        vm.prank(nonOwner);
        vm.expectRevert(abi.encodeWithSignature("OwnableUnauthorizedAccount(address)", nonOwner));
        pool.setRate(950000);
    }

    function testSetFee_NonOwner_Reverts() public {
        vm.prank(nonOwner);
        vm.expectRevert(abi.encodeWithSignature("OwnableUnauthorizedAccount(address)", nonOwner));
        pool.setFeeBps(50);
    }
}
