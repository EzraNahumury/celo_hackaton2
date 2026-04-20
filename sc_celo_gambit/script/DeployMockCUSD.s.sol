// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import "forge-std/Script.sol";
import "../src/mocks/MockCUSD.sol";

contract DeployMockCUSD is Script {
    function run() external {
        vm.startBroadcast(vm.envUint("PRIVATE_KEY"));

        MockCUSD cusd = new MockCUSD();

        vm.stopBroadcast();

        console2.log("=== MockCUSD Deployed ===");
        console2.log("MockCUSD address :", address(cusd));
        console2.log("Deployer balance :", cusd.balanceOf(msg.sender) / 1e18, "cUSD");
    }
}
