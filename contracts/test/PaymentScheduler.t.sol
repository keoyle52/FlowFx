// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Test.sol";
import "../src/FXPool.sol";
import "../src/PaymentScheduler.sol";
import "./mocks/MockERC20.sol";

contract PaymentSchedulerTest is Test {
    FXPool public pool;
    PaymentScheduler public scheduler;

    MockERC20 public usdc;
    MockERC20 public eurc;

    address public owner = address(this);
    address public creator = address(0x1);
    address public recipient = address(0x2);
    address public keeper = address(0x3);

    uint256 public constant INITIAL_RATE = 920000; // 1 USDC = 0.92 EURC
    uint256 public constant INITIAL_FEE_BPS = 30; // 0.3%

    function setUp() public {
        usdc = new MockERC20("USD Coin", "USDC", 6);
        eurc = new MockERC20("Euro Coin", "EURC", 6);

        pool = new FXPool(address(usdc), address(eurc), INITIAL_RATE, INITIAL_FEE_BPS);
        scheduler = new PaymentScheduler(address(pool));

        // Fund FXPool with EURC & USDC liquidity
        usdc.mint(owner, 1_000_000 * 1e6);
        eurc.mint(owner, 1_000_000 * 1e6);

        usdc.approve(address(pool), type(uint256).max);
        eurc.approve(address(pool), type(uint256).max);

        pool.addLiquidity(500_000 * 1e6, 500_000 * 1e6);

        // Fund creator with USDC
        usdc.mint(creator, 10_000 * 1e6);

        vm.startPrank(creator);
        usdc.approve(address(scheduler), type(uint256).max);
        vm.stopPrank();
    }

    function testCreateOrder_LocksTokens() public {
        uint256 amount = 1_000 * 1e6;
        uint256 executeAfter = block.timestamp + 1 hours;

        vm.prank(creator);
        uint256 orderId = scheduler.createOrder(
            address(usdc),
            address(eurc),
            amount,
            recipient,
            executeAfter,
            900 * 1e6
        );

        assertEq(orderId, 1);
        assertEq(usdc.balanceOf(address(scheduler)), amount);
        assertEq(usdc.balanceOf(creator), 9_000 * 1e6);

        PaymentScheduler.Order memory order = scheduler.getOrder(orderId);
        assertEq(order.creator, creator);
        assertEq(order.recipient, recipient);
        assertEq(uint256(order.status), uint256(PaymentScheduler.OrderStatus.Pending));
    }

    function testExecuteOrder_AfterTimelock_SwapsAndDelivers() public {
        uint256 amount = 100 * 1e6; // 100 USDC
        uint256 executeAfter = block.timestamp + 1 hours;
        uint256 expectedEurcOut = 91_724_000;

        vm.prank(creator);
        uint256 orderId = scheduler.createOrder(
            address(usdc),
            address(eurc),
            amount,
            recipient,
            executeAfter,
            expectedEurcOut
        );

        // Warp time past timelock
        vm.warp(executeAfter + 1);

        // Keeper executes order
        vm.prank(keeper);
        uint256 received = scheduler.executeOrder(orderId);

        assertEq(received, expectedEurcOut);
        assertEq(eurc.balanceOf(recipient), expectedEurcOut);

        PaymentScheduler.Order memory order = scheduler.getOrder(orderId);
        assertEq(uint256(order.status), uint256(PaymentScheduler.OrderStatus.Executed));
    }

    function testExecuteOrder_AlreadyExecuted_Reverts() public {
        uint256 amount = 100 * 1e6;
        uint256 executeAfter = block.timestamp + 1 hours;
        uint256 expectedEurcOut = 91_724_000;

        vm.prank(creator);
        uint256 orderId = scheduler.createOrder(
            address(usdc),
            address(eurc),
            amount,
            recipient,
            executeAfter,
            expectedEurcOut
        );

        vm.warp(executeAfter + 1);

        // First execution succeeds
        vm.prank(keeper);
        scheduler.executeOrder(orderId);

        // Second execution MUST revert with "Order not pending"
        vm.prank(keeper);
        vm.expectRevert("Order not pending");
        scheduler.executeOrder(orderId);
    }

    function testExecuteOrder_BeforeTimelock_Reverts() public {
        uint256 amount = 100 * 1e6;
        uint256 executeAfter = block.timestamp + 1 hours;

        vm.prank(creator);
        uint256 orderId = scheduler.createOrder(
            address(usdc),
            address(eurc),
            amount,
            recipient,
            executeAfter,
            1
        );

        vm.prank(keeper);
        vm.expectRevert("Timelock active: order not due");
        scheduler.executeOrder(orderId);
    }

    function testCancelOrder_BeforeTimelock_RefundsCreator() public {
        uint256 amount = 100 * 1e6;
        uint256 executeAfter = block.timestamp + 1 hours;

        vm.prank(creator);
        uint256 orderId = scheduler.createOrder(
            address(usdc),
            address(eurc),
            amount,
            recipient,
            executeAfter,
            1
        );

        vm.prank(creator);
        scheduler.cancelOrder(orderId);

        assertEq(usdc.balanceOf(creator), 10_000 * 1e6);

        PaymentScheduler.Order memory order = scheduler.getOrder(orderId);
        assertEq(uint256(order.status), uint256(PaymentScheduler.OrderStatus.Cancelled));
    }

    function testCancelOrder_NonCreator_Reverts() public {
        uint256 executeAfter = block.timestamp + 1 hours;

        vm.prank(creator);
        uint256 orderId = scheduler.createOrder(
            address(usdc),
            address(eurc),
            100 * 1e6,
            recipient,
            executeAfter,
            1
        );

        vm.prank(keeper);
        vm.expectRevert("Only creator can cancel");
        scheduler.cancelOrder(orderId);
    }

    function testCancelOrder_AfterTimelock_Reverts() public {
        uint256 executeAfter = block.timestamp + 1 hours;

        vm.prank(creator);
        uint256 orderId = scheduler.createOrder(
            address(usdc),
            address(eurc),
            100 * 1e6,
            recipient,
            executeAfter,
            1
        );

        vm.warp(executeAfter + 1);

        vm.prank(creator);
        vm.expectRevert("Order already executable");
        scheduler.cancelOrder(orderId);
    }
}
