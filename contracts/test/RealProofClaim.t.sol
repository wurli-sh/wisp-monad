// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {Test} from "forge-std/Test.sol";
import {stdJson} from "forge-std/StdJson.sol";
import {WispPool} from "../src/WispPool.sol";
import {MockUSDC} from "../src/MockUSDC.sol";
import {Groth16Verifier} from "../src/generated/Groth16Verifier.sol";
import {PoseidonT3Deployer} from "../src/poseidon/PoseidonT3Deployer.sol";
import {IPoseidonT3} from "../src/poseidon/IPoseidonT3.sol";

/// @notice End-to-end deposit+claim using a prebaked real Groth16 proof
/// (same WASM/zkey as browser). Pool is etched to the fixture address.
contract RealProofClaimTest is Test {
    using stdJson for string;

    address internal constant FIXTURE_POOL = 0x1111111111111111111111111111111111111111;
    address internal constant RECIPIENT = 0x2222222222222222222222222222222222222222;

    MockUSDC internal usdc;
    Groth16Verifier internal verifier;
    IPoseidonT3 internal poseidon;
    WispPool internal pool;
    address internal depositor = address(0xA11CE);

    function setUp() public {
        usdc = new MockUSDC();
        vm.chainId(10143);
        verifier = new Groth16Verifier();
        poseidon = IPoseidonT3(PoseidonT3Deployer.deploy());

        bytes memory args =
            abi.encode(address(usdc), address(verifier), address(poseidon), uint256(1_000_000), address(this));
        deployCodeTo("WispPool.sol:WispPool", args, FIXTURE_POOL);
        pool = WispPool(FIXTURE_POOL);

        usdc.mint(depositor, 10_000_000);
        vm.prank(depositor);
        usdc.approve(address(pool), type(uint256).max);
    }

    function test_depositAndClaimWithRealProof() public {
        string memory json = vm.readFile("test/fixtures/real_proof_10143.json");

        bytes32 commitment = json.readBytes32(".commitment");
        bytes32 root = json.readBytes32(".root");
        bytes32 nullifier = json.readBytes32(".nullifier");
        bytes32 recipientBinding = json.readBytes32(".recipientBinding");

        uint256[2] memory a;
        a[0] = json.readUint(".a[0]");
        a[1] = json.readUint(".a[1]");
        uint256[2][2] memory b;
        b[0][0] = json.readUint(".b[0][0]");
        b[0][1] = json.readUint(".b[0][1]");
        b[1][0] = json.readUint(".b[1][0]");
        b[1][1] = json.readUint(".b[1][1]");
        uint256[2] memory c;
        c[0] = json.readUint(".c[0]");
        c[1] = json.readUint(".c[1]");

        vm.prank(depositor);
        pool.deposit(commitment);
        assertTrue(pool.isKnownRoot(root));

        uint256 beforeBal = usdc.balanceOf(RECIPIENT);
        uint256 gasBefore = gasleft();
        pool.claim(a, b, c, root, nullifier, RECIPIENT, recipientBinding);
        uint256 used = gasBefore - gasleft();
        emit log_named_uint("claim+transfer gas", used);
        assertLt(used, 21_000_000, "claim exceeds 70% of 30M");

        assertEq(usdc.balanceOf(RECIPIENT), beforeBal + 1_000_000);
        assertTrue(pool.isSpent(nullifier));

        vm.expectRevert(WispPool.NullifierSpent.selector);
        pool.claim(a, b, c, root, nullifier, RECIPIENT, recipientBinding);

        // Redirect fails (nullifier already spent — deposit a second note for redirect check)
    }

    function test_redirectRecipientFailsBeforeSpend() public {
        // Fresh pool state: only deposit, then try wrong recipient
        string memory json = vm.readFile("test/fixtures/real_proof_10143.json");
        bytes32 commitment = json.readBytes32(".commitment");
        bytes32 root = json.readBytes32(".root");
        bytes32 nullifier = json.readBytes32(".nullifier");
        bytes32 recipientBinding = json.readBytes32(".recipientBinding");
        uint256[2] memory a;
        a[0] = json.readUint(".a[0]");
        a[1] = json.readUint(".a[1]");
        uint256[2][2] memory b;
        b[0][0] = json.readUint(".b[0][0]");
        b[0][1] = json.readUint(".b[0][1]");
        b[1][0] = json.readUint(".b[1][0]");
        b[1][1] = json.readUint(".b[1][1]");
        uint256[2] memory c;
        c[0] = json.readUint(".c[0]");
        c[1] = json.readUint(".c[1]");

        vm.prank(depositor);
        pool.deposit(commitment);

        vm.expectRevert(WispPool.InvalidProof.selector);
        pool.claim(a, b, c, root, nullifier, address(0x9999), recipientBinding);
    }

    function test_allPublicSignalMutationsFailRealVerifier() public view {
        string memory json = vm.readFile("test/fixtures/real_proof_10143.json");
        uint256[2] memory a;
        a[0] = json.readUint(".a[0]");
        a[1] = json.readUint(".a[1]");
        uint256[2][2] memory b;
        b[0][0] = json.readUint(".b[0][0]");
        b[0][1] = json.readUint(".b[0][1]");
        b[1][0] = json.readUint(".b[1][0]");
        b[1][1] = json.readUint(".b[1][1]");
        uint256[2] memory c;
        c[0] = json.readUint(".c[0]");
        c[1] = json.readUint(".c[1]");

        uint256[7] memory signals = [
            uint256(json.readBytes32(".root")),
            uint256(json.readBytes32(".nullifier")),
            uint256(uint160(RECIPIENT)),
            uint256(1_000_000),
            uint256(10143),
            uint256(uint160(FIXTURE_POOL)),
            uint256(json.readBytes32(".recipientBinding"))
        ];
        assertTrue(verifier.verifyProof(a, b, c, signals));

        for (uint256 i = 0; i < signals.length; i++) {
            uint256[7] memory mutated = signals;
            mutated[i] += 1;
            assertFalse(verifier.verifyProof(a, b, c, mutated));
        }
    }
}
