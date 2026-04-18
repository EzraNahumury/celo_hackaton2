// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

interface IGambitBadges {
    function hasFairPlayHold(address player) external view returns (bool);
    function hasBadge(address player, uint8 bType) external view returns (bool);
    function mint(address player, uint8 bType) external returns (uint256);
}
