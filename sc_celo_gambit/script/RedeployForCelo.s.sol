// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import "forge-std/Script.sol";
import "../src/GambitHub.sol";
import "../src/MatchEscrow.sol";
import "../src/PuzzlePool.sol";
import "../src/DailyPuzzlePool.sol";
import "../src/ClubVault.sol";
import "../src/GambitBadges.sol";

/// Redeploys ONLY DailyPuzzlePool + ClubVault with the Celo native-as-ERC20
/// token address (0x471EcE3750Da237f93B8E339c536989b8978a438). MatchEscrow,
/// PuzzlePool, GambitBadges, GambitHub stay the same — they already use
/// native CELO via msg.value.
///
/// After this runs:
///  - hub.registerContracts() is re-called with the new ClubVault address
///    (other registry entries kept identical).
///  - ClubVault gets OPERATOR_ROLE (auto-mint badges on settle).
contract RedeployForCelo is Script {
    function run() external {
        address oracle = vm.envAddress("ORACLE_ADDRESS");
        address celoToken = vm.envAddress("CELO_TOKEN_ADDRESS");

        address hubAddr      = vm.envAddress("GAMBIT_HUB_ADDRESS");
        address escrowAddr   = vm.envAddress("MATCH_ESCROW_ADDRESS");
        address puzzlePoolAddr = vm.envAddress("PUZZLE_POOL_ADDRESS");
        address badgesAddr   = vm.envAddress("GAMBIT_BADGES_ADDRESS");

        vm.startBroadcast(vm.envUint("PRIVATE_KEY"));

        DailyPuzzlePool dailyPuzzlePool = new DailyPuzzlePool(oracle, celoToken);
        ClubVault       clubVault       = new ClubVault(hubAddr, celoToken);

        GambitHub hub = GambitHub(hubAddr);

        // Re-register registry — keep PuzzlePool/MatchEscrow/Badges, swap ClubVault
        hub.registerContracts(puzzlePoolAddr, escrowAddr, address(clubVault), badgesAddr);

        // Grant OPERATOR_ROLE so new ClubVault can auto-mint CLUB_CHAMPION badge
        hub.grantRole(hub.OPERATOR_ROLE(), address(clubVault));

        vm.stopBroadcast();

        console2.log("=== Redeploy For Celo (Chain %d) ===", block.chainid);
        console2.log("CELO token addr  :", celoToken);
        console2.log("New DailyPuzzlePool :", address(dailyPuzzlePool));
        console2.log("New ClubVault       :", address(clubVault));
    }
}
