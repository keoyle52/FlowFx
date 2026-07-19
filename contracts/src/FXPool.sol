// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title FXPool
 * @notice Fixed-rate USDC ⇄ EURC Liquidity Pool with fee spread & slippage protection on Arc Testnet.
 */
contract FXPool is ReentrancyGuard, Ownable {
    using SafeERC20 for IERC20;

    IERC20 public immutable usdc;
    IERC20 public immutable eurc;

    // 1 USDC = rateNumerator / RATE_PRECISION EURC
    // Default: 1 USDC = 0.92 EURC (rateNumerator = 920000, precision = 1000000)
    uint256 public rateNumerator;
    uint256 public constant RATE_PRECISION = 1e6;

    // Fee in basis points (1 BPS = 0.01%). Default: 30 BPS = 0.3%
    uint256 public feeBps;
    uint256 public constant BPS_DENOMINATOR = 10000;

    event LiquidityAdded(address indexed provider, uint256 usdcAmount, uint256 eurcAmount);
    event LiquidityRemoved(address indexed provider, uint256 usdcAmount, uint256 eurcAmount);
    event RateUpdated(uint256 newRateNumerator);
    event FeeUpdated(uint256 newFeeBps);
    event Swapped(
        address indexed sender,
        address indexed tokenIn,
        address indexed tokenOut,
        uint256 amountIn,
        uint256 amountOut
    );

    constructor(
        address _usdc,
        address _eurc,
        uint256 _rateNumerator,
        uint256 _feeBps
    ) Ownable(msg.sender) {
        require(_usdc != address(0) && _eurc != address(0), "Invalid token addresses");
        require(_rateNumerator > 0, "Rate must be > 0");
        require(_feeBps <= 1000, "Fee too high"); // max 10%

        usdc = IERC20(_usdc);
        eurc = IERC20(_eurc);
        rateNumerator = _rateNumerator;
        feeBps = _feeBps;
    }

    /**
     * @notice Add liquidity to the pool
     */
    function addLiquidity(uint256 usdcAmount, uint256 eurcAmount) external nonReentrant {
        if (usdcAmount > 0) {
            usdc.safeTransferFrom(msg.sender, address(this), usdcAmount);
        }
        if (eurcAmount > 0) {
            eurc.safeTransferFrom(msg.sender, address(this), eurcAmount);
        }
        emit LiquidityAdded(msg.sender, usdcAmount, eurcAmount);
    }

    /**
     * @notice Remove liquidity from the pool (owner only)
     */
    function removeLiquidity(uint256 usdcAmount, uint256 eurcAmount) external onlyOwner nonReentrant {
        if (usdcAmount > 0) {
            usdc.safeTransfer(msg.sender, usdcAmount);
        }
        if (eurcAmount > 0) {
            eurc.safeTransfer(msg.sender, eurcAmount);
        }
        emit LiquidityRemoved(msg.sender, usdcAmount, eurcAmount);
    }

    /**
     * @notice Swap USDC for EURC
     */
    function swapUSDCtoEURC(uint256 usdcIn, uint256 minEurcOut) external nonReentrant returns (uint256 eurcOut) {
        require(usdcIn > 0, "Amount must be > 0");
        
        uint256 grossEurc = (usdcIn * rateNumerator) / RATE_PRECISION;
        uint256 fee = (grossEurc * feeBps) / BPS_DENOMINATOR;
        eurcOut = grossEurc - fee;

        require(eurcOut >= minEurcOut, "Slippage limit exceeded");
        require(eurc.balanceOf(address(this)) >= eurcOut, "Insufficient EURC liquidity");

        usdc.safeTransferFrom(msg.sender, address(this), usdcIn);
        eurc.safeTransfer(msg.sender, eurcOut);

        emit Swapped(msg.sender, address(usdc), address(eurc), usdcIn, eurcOut);
    }

    /**
     * @notice Swap EURC for USDC
     */
    function swapEURCtoUSDC(uint256 eurcIn, uint256 minUsdcOut) external nonReentrant returns (uint256 usdcOut) {
        require(eurcIn > 0, "Amount must be > 0");

        uint256 grossUsdc = (eurcIn * RATE_PRECISION) / rateNumerator;
        uint256 fee = (grossUsdc * feeBps) / BPS_DENOMINATOR;
        usdcOut = grossUsdc - fee;

        require(usdcOut >= minUsdcOut, "Slippage limit exceeded");
        require(usdc.balanceOf(address(this)) >= usdcOut, "Insufficient USDC liquidity");

        eurc.safeTransferFrom(msg.sender, address(this), eurcIn);
        usdc.safeTransfer(msg.sender, usdcOut);

        emit Swapped(msg.sender, address(eurc), address(usdc), eurcIn, usdcOut);
    }

    /**
     * @notice Get current rates & fees
     */
    function getRate() external view returns (uint256 _rateNumerator, uint256 _ratePrecision, uint256 _feeBps) {
        return (rateNumerator, RATE_PRECISION, feeBps);
    }

    /**
     * @notice Set exchange rate
     */
    function setRate(uint256 newRateNumerator) external onlyOwner {
        require(newRateNumerator > 0, "Rate must be > 0");
        rateNumerator = newRateNumerator;
        emit RateUpdated(newRateNumerator);
    }

    /**
     * @notice Set fee bps
     */
    function setFeeBps(uint256 newFeeBps) external onlyOwner {
        require(newFeeBps <= 1000, "Fee too high");
        feeBps = newFeeBps;
        emit FeeUpdated(newFeeBps);
    }
}
