// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "./FXPool.sol";

/**
 * @title PaymentScheduler
 * @notice Time-locked scheduled payment engine performing multi-step settlement (lock -> swap via FXPool -> transfer to recipient) on Arc Testnet.
 */
contract PaymentScheduler is ReentrancyGuard {
    using SafeERC20 for IERC20;

    enum OrderStatus { Pending, Executed, Cancelled }

    struct Order {
        uint256 id;
        address creator;
        address fromToken;
        address toToken;
        uint256 amount;
        address recipient;
        uint256 executeAfter;
        uint256 minReceived;
        OrderStatus status;
    }

    FXPool public immutable fxPool;
    address public immutable usdc;
    address public immutable eurc;

    uint256 public nextOrderId = 1;
    mapping(uint256 => Order) public orders;
    mapping(address => uint256[]) private userOrders;

    event OrderCreated(
        uint256 indexed id,
        address indexed creator,
        address indexed recipient,
        address fromToken,
        address toToken,
        uint256 amount,
        uint256 executeAfter,
        uint256 minReceived
    );
    event OrderExecuted(uint256 indexed id, address indexed executor, uint256 amountReceived);
    event OrderCancelled(uint256 indexed id, address indexed creator);

    constructor(address _fxPool) {
        require(_fxPool != address(0), "Invalid pool address");
        fxPool = FXPool(_fxPool);
        usdc = address(fxPool.usdc());
        eurc = address(fxPool.eurc());
    }

    /**
     * @notice Create a time-locked scheduled payment order
     */
    function createOrder(
        address fromToken,
        address toToken,
        uint256 amount,
        address recipient,
        uint256 executeAfter,
        uint256 minReceived
    ) external nonReentrant returns (uint256 orderId) {
        require(amount > 0, "Amount must be > 0");
        require(recipient != address(0), "Invalid recipient");
        require(executeAfter >= block.timestamp, "Execute time must be in future");
        require(
            (fromToken == usdc && toToken == eurc) || (fromToken == eurc && toToken == usdc),
            "Unsupported token pair"
        );

        orderId = nextOrderId++;

        orders[orderId] = Order({
            id: orderId,
            creator: msg.sender,
            fromToken: fromToken,
            toToken: toToken,
            amount: amount,
            recipient: recipient,
            executeAfter: executeAfter,
            minReceived: minReceived,
            status: OrderStatus.Pending
        });

        userOrders[msg.sender].push(orderId);

        // Lock funds in scheduler contract
        IERC20(fromToken).safeTransferFrom(msg.sender, address(this), amount);

        emit OrderCreated(
            orderId,
            msg.sender,
            recipient,
            fromToken,
            toToken,
            amount,
            executeAfter,
            minReceived
        );
    }

    /**
     * @notice Execute order after time restriction passes
     */
    function executeOrder(uint256 orderId) external nonReentrant returns (uint256 amountReceived) {
        Order storage order = orders[orderId];

        require(order.status == OrderStatus.Pending, "Order not pending");
        require(block.timestamp >= order.executeAfter, "Timelock active: order not due");

        order.status = OrderStatus.Executed;

        // Approve FXPool to spend fromToken locked in contract
        IERC20(order.fromToken).forceApprove(address(fxPool), order.amount);

        // Perform swap via FXPool
        if (order.fromToken == usdc) {
            amountReceived = fxPool.swapUSDCtoEURC(order.amount, order.minReceived);
        } else {
            amountReceived = fxPool.swapEURCtoUSDC(order.amount, order.minReceived);
        }

        // Send output tokens directly to recipient
        IERC20(order.toToken).safeTransfer(order.recipient, amountReceived);

        emit OrderExecuted(orderId, msg.sender, amountReceived);
    }

    /**
     * @notice Cancel pending order before execution time
     */
    function cancelOrder(uint256 orderId) external nonReentrant {
        Order storage order = orders[orderId];

        require(order.status == OrderStatus.Pending, "Order not pending");
        require(msg.sender == order.creator, "Only creator can cancel");
        require(block.timestamp < order.executeAfter, "Order already executable");

        order.status = OrderStatus.Cancelled;

        // Refund locked tokens to creator
        IERC20(order.fromToken).safeTransfer(order.creator, order.amount);

        emit OrderCancelled(orderId, msg.sender);
    }

    /**
     * @notice View helper to get user's order IDs
     */
    function getUserOrders(address user) external view returns (uint256[] memory) {
        return userOrders[user];
    }

    /**
     * @notice View helper to get full order details
     */
    function getOrder(uint256 orderId) external view returns (Order memory) {
        return orders[orderId];
    }
}
