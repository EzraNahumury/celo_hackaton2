// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

/// @notice Mock cUSD for Celo Sepolia testing. Anyone can mint via faucet().
contract MockCUSD is ERC20, Ownable {
    uint256 public constant FAUCET_AMOUNT = 100 * 1e18; // 100 cUSD per request

    event FaucetUsed(address indexed user, uint256 amount);

    constructor() ERC20("Mock Celo Dollar", "cUSD") Ownable(msg.sender) {
        // Mint initial supply to deployer for manual distribution
        _mint(msg.sender, 1_000_000 * 1e18);
    }

    /// @notice Anyone can call freely to receive 100 cUSD (no cooldown, testing only)
    function faucet() external {
        _mint(msg.sender, FAUCET_AMOUNT);
        emit FaucetUsed(msg.sender, FAUCET_AMOUNT);
    }

    /// @notice Owner can mint arbitrary amounts (for testing/seeding)
    function mint(address to, uint256 amount) external onlyOwner {
        _mint(to, amount);
    }
}
