// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import "forge-std/Script.sol";
import "../src/DailyPuzzlePool.sol";

contract DeployDailyPuzzlePool is Script {
    function run() external {
        address oracle = vm.envAddress("ORACLE_ADDRESS");
        address cusd   = vm.envAddress("CUSD_ADDRESS");

        vm.startBroadcast(vm.envUint("PRIVATE_KEY"));

        DailyPuzzlePool pool = new DailyPuzzlePool(oracle, cusd);

        vm.stopBroadcast();

        console2.log("=== DailyPuzzlePool Deployed ===");
        console2.log("DailyPuzzlePool address:", address(pool));
        console2.log("Oracle                 :", oracle);
        console2.log("cUSD                   :", cusd);
    }
}
