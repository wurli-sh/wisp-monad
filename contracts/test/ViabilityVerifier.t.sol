// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {Test} from "forge-std/Test.sol";
import {ViabilityVerifier} from "../src/generated/ViabilityVerifier.sol";

/// @notice Real Groth16 proof verification against the generated BN254 verifier (Phase 1A).
contract ViabilityVerifierTest is Test {
    ViabilityVerifier internal verifier;

    // Fixture from circuits/artifacts/viability/fixture_calldata.txt (preimage=1 Poseidon).
    uint256 internal constant A0 = 0x2a0f96867474fac174306924de4dd1dc938abc39daf9304f1c8b4d578f5c9ee4;
    uint256 internal constant A1 = 0x12e0f1b77b4f74c71eacb9eda3d7635aaf4121199d89aebdb7d0ca79104f9c1e;
    uint256 internal constant B00 = 0x1a57fb021265073c1d25465b0acebc7a2d6dccdac4887e5fc0d4342566ac216a;
    uint256 internal constant B01 = 0x2e9c54596f78a00a47e6498bde11d1c1a2fb4bf7883441bdb58a5c8e02d7c965;
    uint256 internal constant B10 = 0x2de603b90c5e52d82f5964c9055727e48527b148d2d1249d0b6a69e47a55919d;
    uint256 internal constant B11 = 0x1d8788cc4b367c2f18d4a3147077cd22053ef5595f7d18eccdc7a21b1c0eaf97;
    uint256 internal constant C0 = 0x0ede6e9d24b6693c0ff11461f7dc95e659a5f27688c608fe6b14b458fb938af6;
    uint256 internal constant C1 = 0x04f0df06c28d5c3820c48973003e83047a379a82152165149521e0dd91f24d79;
    uint256 internal constant PUB0 = 0x29176100eaa962bdc1fe6c654d6a3c130e96a4d1168b33848b897dc502820133;

    function setUp() public {
        verifier = new ViabilityVerifier();
    }

    function test_realProofVerifies() public view {
        uint256[2] memory a = [A0, A1];
        uint256[2][2] memory b = [[B00, B01], [B10, B11]];
        uint256[2] memory c = [C0, C1];
        uint256[1] memory input = [PUB0];
        assertTrue(verifier.verifyProof(a, b, c, input));
    }

    function test_tamperedPublicInputFails() public view {
        uint256[2] memory a = [A0, A1];
        uint256[2][2] memory b = [[B00, B01], [B10, B11]];
        uint256[2] memory c = [C0, C1];
        uint256[1] memory input = [PUB0 + 1];
        assertFalse(verifier.verifyProof(a, b, c, input));
    }

    function test_verifierBytecodeSize() public {
        uint256 size;
        address addr = address(verifier);
        assembly {
            size := extcodesize(addr)
        }
        // Monad has large contract size headroom; keep a soft local gate.
        assertLt(size, 24_576, "verifier bytecode unexpectedly large");
        emit log_named_uint("viability verifier runtime bytecode bytes", size);
    }
}
