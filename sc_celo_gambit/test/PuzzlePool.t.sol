// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import "forge-std/Test.sol";
import "../src/GambitHub.sol";
import "../src/PuzzlePool.sol";

contract PuzzlePoolTest is Test {
    GambitHub  hub;
    PuzzlePool pool;

    address oracle    = makeAddr("oracle");
    address treasury  = makeAddr("treasury");
    address operator  = address(this); // test contract is operator
    address sponsor   = makeAddr("sponsor");
    address playerA   = makeAddr("playerA");
    address playerB   = makeAddr("playerB");

    function setUp() public {
        hub  = new GambitHub(treasury, oracle);
        pool = new PuzzlePool(address(hub));
        vm.deal(sponsor, 10 ether);
        vm.deal(playerA, 1 ether);
        vm.deal(playerB, 1 ether);
    }

    // ── Helper: build Merkle tree for two players ─────────────────────────────

    function _buildRoot(
        address p1, uint256 a1,
        address p2, uint256 a2
    ) internal pure returns (bytes32 root, bytes32[] memory proofP1, bytes32[] memory proofP2) {
        bytes32 leaf1 = keccak256(abi.encodePacked(p1, a1));
        bytes32 leaf2 = keccak256(abi.encodePacked(p2, a2));

        // Simple two-leaf tree: root = hash(sort(leaf1, leaf2))
        (bytes32 lo, bytes32 hi) = leaf1 < leaf2 ? (leaf1, leaf2) : (leaf2, leaf1);
        root = keccak256(abi.encodePacked(lo, hi));

        proofP1 = new bytes32[](1);
        proofP1[0] = leaf2;

        proofP2 = new bytes32[](1);
        proofP2[0] = leaf1;
    }

    // ── Sponsor deposit ───────────────────────────────────────────────────────

    function test_SponsorDeposit() public {
        vm.prank(sponsor);
        pool.sponsorDeposit{value: 1 ether}();
        assertEq(pool.pendingBalance(), 1 ether);
    }

    function test_SponsorDeposit_ZeroReverts() public {
        vm.prank(sponsor);
        vm.expectRevert("zero deposit");
        pool.sponsorDeposit{value: 0}();
    }

    // ── Fee receive ───────────────────────────────────────────────────────────

    function test_ReceiveFee() public {
        (bool ok,) = address(pool).call{value: 0.5 ether}("");
        assertTrue(ok);
        assertEq(pool.pendingBalance(), 0.5 ether);
    }

    // ── FinalizeRound ─────────────────────────────────────────────────────────

    function _fundAndFinalize(address p1, uint256 a1, address p2, uint256 a2)
        internal
        returns (uint256 day, bytes32[] memory proofP1, bytes32[] memory proofP2)
    {
        vm.prank(sponsor);
        pool.sponsorDeposit{value: a1 + a2}();

        bytes32 root;
        (root, proofP1, proofP2) = _buildRoot(p1, a1, p2, a2);
        day = block.timestamp / 86400;
        pool.finalizeRound(root);
    }

    function test_FinalizeRound() public {
        (uint256 day,,) = _fundAndFinalize(playerA, 0.6 ether, playerB, 0.4 ether);
        (bytes32 root, uint256 prize,, bool dist) = pool.rounds(day);
        assertEq(prize, 1 ether);
        // FIX: distributed should be true immediately after finalization
        assertTrue(dist);
        assertTrue(root != bytes32(0));
    }

    function test_FinalizeRound_EmptyPool_Reverts() public {
        vm.expectRevert("empty pool");
        pool.finalizeRound(bytes32(uint256(1)));
    }

    function test_FinalizeRound_Double_Reverts() public {
        vm.prank(sponsor);
        pool.sponsorDeposit{value: 1 ether}();
        bytes32 r = keccak256("root");
        pool.finalizeRound(r);

        // Fund again for same day
        vm.prank(sponsor);
        pool.sponsorDeposit{value: 0.1 ether}();
        vm.expectRevert("already finalized");
        pool.finalizeRound(r);
    }

    function test_FinalizeRound_OnlyOperator() public {
        vm.prank(sponsor);
        pool.sponsorDeposit{value: 1 ether}();

        vm.prank(makeAddr("rando"));
        vm.expectRevert("not operator");
        pool.finalizeRound(bytes32(uint256(1)));
    }

    // ── Claim ────────────────────────────────────────────────────────────────

    function test_ClaimPrize() public {
        (uint256 day, bytes32[] memory proofA,) =
            _fundAndFinalize(playerA, 0.6 ether, playerB, 0.4 ether);

        uint256 before = playerA.balance;
        vm.prank(playerA);
        pool.claim(day, 0.6 ether, proofA);

        assertEq(playerA.balance, before + 0.6 ether);
        assertTrue(pool.hasClaimed(day, playerA));
    }

    function test_ClaimPrize_BothPlayers() public {
        (uint256 day, bytes32[] memory proofA, bytes32[] memory proofB) =
            _fundAndFinalize(playerA, 0.6 ether, playerB, 0.4 ether);

        uint256 beforeA = playerA.balance;
        uint256 beforeB = playerB.balance;

        vm.prank(playerA);
        pool.claim(day, 0.6 ether, proofA);
        vm.prank(playerB);
        pool.claim(day, 0.4 ether, proofB);

        assertEq(playerA.balance, beforeA + 0.6 ether);
        assertEq(playerB.balance, beforeB + 0.4 ether);
    }

    function test_ClaimPrize_DoubleClaim_Reverts() public {
        (uint256 day, bytes32[] memory proofA,) =
            _fundAndFinalize(playerA, 0.6 ether, playerB, 0.4 ether);

        vm.prank(playerA);
        pool.claim(day, 0.6 ether, proofA);

        vm.prank(playerA);
        vm.expectRevert("already claimed");
        pool.claim(day, 0.6 ether, proofA);
    }

    function test_ClaimPrize_BadProof_Reverts() public {
        (uint256 day,,) = _fundAndFinalize(playerA, 0.6 ether, playerB, 0.4 ether);

        bytes32[] memory badProof = new bytes32[](1);
        badProof[0] = keccak256("garbage");

        vm.prank(playerA);
        vm.expectRevert("invalid proof");
        pool.claim(day, 0.6 ether, badProof);
    }

    function test_ClaimPrize_UnfinalizedRound_Reverts() public {
        bytes32[] memory emptyProof;
        vm.prank(playerA);
        vm.expectRevert("round not finalized");
        pool.claim(999, 0.1 ether, emptyProof);
    }
}
