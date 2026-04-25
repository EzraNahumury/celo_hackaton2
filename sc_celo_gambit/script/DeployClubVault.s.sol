// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import "forge-std/Script.sol";
import "../src/GambitHub.sol";
import "../src/ClubVault.sol";

/// @notice Redeploys only ClubVault (ERC20 cUSD version) and registers it with existing hub.
contract DeployClubVault is Script {
    function run() external {
        address hub      = vm.envAddress("GAMBIT_HUB_ADDRESS");
        address cusd     = vm.envAddress("CUSD_ADDRESS");

        vm.startBroadcast(vm.envUint("PRIVATE_KEY"));

        ClubVault clubVault = new ClubVault(hub, cusd);

        // Register new ClubVault in hub (replaces old address)
        GambitHub(hub).registerContracts(
            GambitHub(hub).puzzlePool(),
            GambitHub(hub).matchEscrow(),
            address(clubVault),
            GambitHub(hub).badges()
        );

        // Grant OPERATOR_ROLE so ClubVault can auto-mint badges
        GambitHub(hub).grantRole(GambitHub(hub).OPERATOR_ROLE(), address(clubVault));

        vm.stopBroadcast();

        console2.log("ClubVault (cUSD) :", address(clubVault));
    }
}
