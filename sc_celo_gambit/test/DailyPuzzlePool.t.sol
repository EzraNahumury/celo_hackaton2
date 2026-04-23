// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import "forge-std/Test.sol";
import "@openzeppelin/contracts/utils/cryptography/MessageHashUtils.sol";
import "../src/DailyPuzzlePool.sol";
import "../src/mocks/MockCUSD.sol";

contract DailyPuzzlePoolTest is Test {
    DailyPuzzlePool pool;
    MockCUSD        cusd;

    uint256 oracleKey = 0xA11CE;
    address oracle    = vm.addr(oracleKey);
    address funder    = makeAddr("funder");
    address player    = makeAddr("player");
    address player2   = makeAddr("player2");

    uint256 constant PRIZE = 10 * 1e18; // 10 cUSD

    function setUp() public {
        cusd = new MockCUSD();
        pool = new DailyPuzzlePool(oracle, address(cusd));

        // Give funder some cUSD and approve pool
        cusd.mint(funder, 1000 * 1e18);
        vm.prank(funder);
        cusd.approve(address(pool), type(uint256).max);
    }

    // ── Helper: sign voucher ─────────────────────────────────────────────────

    function _sign(
        address _player,
        uint256 day,
        bytes32 nonce,
        uint256 amount
    ) internal view returns (bytes memory) {
        bytes32 msgHash = keccak256(abi.encodePacked(_player, day, nonce, amount));
        bytes32 ethHash = MessageHashUtils.toEthSignedMessageHash(msgHash);
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(oracleKey, ethHash);
        return abi.encodePacked(r, s, v);
    }

    function _currentDay() internal view returns (uint256) {
        return block.timestamp / 86400;
    }

    // ── fund() ───────────────────────────────────────────────────────────────

    function test_Fund() public {
        vm.prank(funder);
        pool.fund(500 * 1e18);
        assertEq(pool.poolBalance(), 500 * 1e18);
    }

    function test_Fund_ZeroReverts() public {
        vm.prank(funder);
        vm.expectRevert("zero amount");
        pool.fund(0);
    }

    // ── claim() ──────────────────────────────────────────────────────────────

    function test_Claim_HappyPath() public {
        vm.prank(funder);
        pool.fund(100 * 1e18);

        uint256 day   = _currentDay();
        bytes32 nonce = keccak256(abi.encodePacked("puzzle1", player));
        bytes memory sig = _sign(player, day, nonce, PRIZE);

        uint256 before = cusd.balanceOf(player);
        vm.prank(player);
        pool.claim(day, nonce, PRIZE, sig);

        assertEq(cusd.balanceOf(player), before + PRIZE);
        assertEq(pool.dailyClaims(day, player), 1);
        assertTrue(pool.usedNonces(nonce));
    }

    function test_Claim_ReplayReverts() public {
        vm.prank(funder);
        pool.fund(100 * 1e18);

        uint256 day   = _currentDay();
        bytes32 nonce = keccak256(abi.encodePacked("puzzle1", player));
        bytes memory sig = _sign(player, day, nonce, PRIZE);

        vm.prank(player);
        pool.claim(day, nonce, PRIZE, sig);

        vm.prank(player);
        vm.expectRevert("already claimed");
        pool.claim(day, nonce, PRIZE, sig);
    }

    function test_Claim_DailyLimitReverts() public {
        vm.prank(funder);
        pool.fund(1000 * 1e18);

        uint256 day = _currentDay();

        for (uint256 i = 0; i < 3; i++) {
            bytes32 nonce = keccak256(abi.encodePacked("puzzle", i, player));
            bytes memory sig = _sign(player, day, nonce, PRIZE);
            vm.prank(player);
            pool.claim(day, nonce, PRIZE, sig);
        }

        // 4th claim should fail
        bytes32 nonce4 = keccak256(abi.encodePacked("puzzle4", player));
        bytes memory sig4 = _sign(player, day, nonce4, PRIZE);
        vm.prank(player);
        vm.expectRevert("daily limit reached");
        pool.claim(day, nonce4, PRIZE, sig4);
    }

    function test_Claim_InvalidSignatureReverts() public {
        vm.prank(funder);
        pool.fund(100 * 1e18);

        uint256 day   = _currentDay();
        bytes32 nonce = keccak256(abi.encodePacked("puzzle1", player));

        // Sign with wrong key
        uint256 wrongKey = 0xBAD;
        bytes32 msgHash  = keccak256(abi.encodePacked(player, day, nonce, PRIZE));
        bytes32 ethHash  = MessageHashUtils.toEthSignedMessageHash(msgHash);
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(wrongKey, ethHash);
        bytes memory badSig = abi.encodePacked(r, s, v);

        vm.prank(player);
        vm.expectRevert("invalid signature");
        pool.claim(day, nonce, PRIZE, badSig);
    }

    function test_Claim_PoolEmptyReverts() public {
        // Pool not funded
        uint256 day   = _currentDay();
        bytes32 nonce = keccak256(abi.encodePacked("puzzle1", player));
        bytes memory sig = _sign(player, day, nonce, PRIZE);

        vm.prank(player);
        vm.expectRevert("pool empty");
        pool.claim(day, nonce, PRIZE, sig);
    }

    function test_Claim_WrongDayReverts() public {
        vm.prank(funder);
        pool.fund(100 * 1e18);

        uint256 day   = _currentDay();
        bytes32 nonce = keccak256(abi.encodePacked("puzzle1", player));

        // Sign for today but submit with wrong day — signature mismatch
        bytes memory sig = _sign(player, day, nonce, PRIZE);

        vm.prank(player);
        vm.expectRevert("invalid signature");
        pool.claim(day + 1, nonce, PRIZE, sig);
    }

    function test_Claim_TwoPlayersSamePool() public {
        vm.prank(funder);
        pool.fund(500 * 1e18);

        uint256 day    = _currentDay();
        bytes32 nonce1 = keccak256(abi.encodePacked("puzzleA", player));
        bytes32 nonce2 = keccak256(abi.encodePacked("puzzleA", player2));

        vm.prank(player);
        pool.claim(day, nonce1, PRIZE, _sign(player, day, nonce1, PRIZE));

        vm.prank(player2);
        pool.claim(day, nonce2, PRIZE, _sign(player2, day, nonce2, PRIZE));

        assertEq(cusd.balanceOf(player),  PRIZE);
        assertEq(cusd.balanceOf(player2), PRIZE);
    }

    // ── View helpers ─────────────────────────────────────────────────────────

    function test_ClaimsToday() public {
        vm.prank(funder);
        pool.fund(100 * 1e18);

        assertEq(pool.claimsToday(player), 0);

        uint256 day   = _currentDay();
        bytes32 nonce = keccak256(abi.encodePacked("puzzle1", player));
        vm.prank(player);
        pool.claim(day, nonce, PRIZE, _sign(player, day, nonce, PRIZE));

        assertEq(pool.claimsToday(player), 1);
    }

    function test_TodayIndex() public view {
        assertEq(pool.todayIndex(), block.timestamp / 86400);
    }

    function test_PoolBalance() public {
        assertEq(pool.poolBalance(), 0);
        vm.prank(funder);
        pool.fund(200 * 1e18);
        assertEq(pool.poolBalance(), 200 * 1e18);
    }
}
