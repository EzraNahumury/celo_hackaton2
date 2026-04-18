// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import "forge-std/Script.sol";
import "../src/GambitHub.sol";
import "../src/MatchEscrow.sol";
import "../src/PuzzlePool.sol";
import "../src/ClubVault.sol";
import "../src/GambitBadges.sol";

contract Deploy is Script {
    function run() external {
        address oracle   = vm.envAddress("ORACLE_ADDRESS");
        address treasury = vm.envAddress("TREASURY_ADDRESS");
        string  memory baseURI = vm.envString("BADGE_BASE_URI");

        vm.startBroadcast(vm.envUint("PRIVATE_KEY"));

        // 1. Hub first — all other contracts reference it
        GambitHub hub = new GambitHub(treasury, oracle);

        // 2. Dependent contracts
        MatchEscrow  escrow     = new MatchEscrow(address(hub));
        PuzzlePool   puzzlePool = new PuzzlePool(address(hub));
        ClubVault    clubVault  = new ClubVault(address(hub));
        GambitBadges badges     = new GambitBadges(address(hub), baseURI);

        // 3. Register all addresses in hub
        hub.registerContracts(
            address(puzzlePool),
            address(escrow),
            address(clubVault),
            address(badges)
        );

        // 4. Grant OPERATOR_ROLE to MatchEscrow and ClubVault so they can
        //    auto-mint badges (FIRST_WIN, CLUB_CHAMPION) on settlement
        hub.grantRole(hub.OPERATOR_ROLE(), address(escrow));
        hub.grantRole(hub.OPERATOR_ROLE(), address(clubVault));

        vm.stopBroadcast();

        console2.log("=== Gambit Deployment (Chain %d) ===", block.chainid);
        console2.log("GambitHub   :", address(hub));
        console2.log("MatchEscrow :", address(escrow));
        console2.log("PuzzlePool  :", address(puzzlePool));
        console2.log("ClubVault   :", address(clubVault));
        console2.log("GambitBadges:", address(badges));
    }
}
