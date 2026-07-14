// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {Test} from "forge-std/Test.sol";
import {WispPool} from "../src/WispPool.sol";
import {MockUSDC} from "../src/MockUSDC.sol";
import {Groth16Verifier} from "../src/generated/Groth16Verifier.sol";
import {PoseidonT3Deployer} from "../src/poseidon/PoseidonT3Deployer.sol";
import {IPoseidonT3} from "../src/poseidon/IPoseidonT3.sol";
import {FalseReturnToken, FeeOnTransferToken} from "./helpers/TestTokens.sol";

contract WispPoolTest is Test {
    MockUSDC internal usdc;
    Groth16Verifier internal verifier;
    IPoseidonT3 internal poseidon;
    WispPool internal pool;
    address internal user = address(0xBEEF);

    function setUp() public {
        usdc = new MockUSDC();
        verifier = new Groth16Verifier();
        poseidon = IPoseidonT3(PoseidonT3Deployer.deploy());
        pool = new WispPool(address(usdc), address(verifier), address(poseidon), 1_000_000, address(this));
        usdc.mint(user, 1_000_000_000);
        vm.prank(user);
        usdc.approve(address(pool), type(uint256).max);
    }

    function test_poseidonMatchesKnownVector() public view {
        // poseidon([1,2]) from circomlibjs
        uint256 h = poseidon.poseidon([uint256(1), uint256(2)]);
        assertEq(h, 7853200120776062878684798364095072458815029376092732009249414926327459813530);
    }

    function test_poseidonRuntimeCodeHashIsPinned() public view {
        assertEq(address(poseidon).codehash, pool.POSEIDON_T3_CODE_HASH());
    }

    function test_currentRootUsesBytes32Interface() public view {
        bytes32 root = pool.currentRoot();
        assertTrue(root != bytes32(0));
        assertTrue(pool.isKnownRoot(root));
    }

    function test_explicitAdminReceivesRolesInsteadOfDeployer() public {
        address admin = address(0xA11D);
        WispPool administered = new WispPool(address(usdc), address(verifier), address(poseidon), 1_000_000, admin);

        assertTrue(administered.hasRole(administered.DEFAULT_ADMIN_ROLE(), admin));
        assertTrue(administered.hasRole(administered.PAUSER_ROLE(), admin));
        assertFalse(administered.hasRole(administered.DEFAULT_ADMIN_ROLE(), address(this)));
        assertFalse(administered.hasRole(administered.PAUSER_ROLE(), address(this)));
    }

    function test_invalidPoseidonCodeHashReverts() public {
        vm.expectRevert(WispPool.InvalidPoseidon.selector);
        new WispPool(address(usdc), address(verifier), address(verifier), 1_000_000, address(this));
    }

    function test_allSupportedDenominationsDeploy() public {
        new WispPool(address(usdc), address(verifier), address(poseidon), 10_000_000, address(this));
        new WispPool(address(usdc), address(verifier), address(poseidon), 50_000_000, address(this));
        new WispPool(address(usdc), address(verifier), address(poseidon), 100_000_000, address(this));
    }

    function test_unsupportedDenominationReverts() public {
        vm.expectRevert(WispPool.InvalidDenomination.selector);
        new WispPool(address(usdc), address(verifier), address(poseidon), 2_000_000, address(this));
    }

    function test_depositInsertsAndEmits() public {
        bytes32 commitment = bytes32(uint256(111));
        vm.prank(user);
        (uint32 idx, bytes32 root) = pool.deposit(commitment);
        assertEq(idx, 0);
        assertTrue(root != bytes32(0));
        assertEq(pool.nextLeafIndex(), 1);
        assertEq(pool.rootsStored(), 2);
        assertTrue(pool.isKnownRoot(root));
        assertEq(usdc.balanceOf(address(pool)), 1_000_000);
    }

    function test_duplicateCommitmentReverts() public {
        bytes32 commitment = bytes32(uint256(222));
        vm.prank(user);
        pool.deposit(commitment);
        vm.prank(user);
        vm.expectRevert(WispPool.DuplicateCommitment.selector);
        pool.deposit(commitment);
    }

    function test_zeroCommitmentReverts() public {
        vm.prank(user);
        vm.expectRevert(WispPool.InvalidCommitment.selector);
        pool.deposit(bytes32(0));
    }

    function test_nonCanonicalCommitmentReverts() public {
        uint256 scalarField = pool.SNARK_SCALAR_FIELD();
        vm.prank(user);
        vm.expectRevert(WispPool.InvalidCommitment.selector);
        pool.deposit(bytes32(scalarField));
    }

    function test_pauseBlocksDeposit() public {
        pool.pause();
        vm.prank(user);
        vm.expectRevert();
        pool.deposit(bytes32(uint256(333)));
    }

    function test_unpauseRestoresDeposit() public {
        pool.pause();
        pool.unpause();
        vm.prank(user);
        pool.deposit(bytes32(uint256(334)));
    }

    function test_unknownRootLookupIsConstantTime() public {
        uint256 gasBefore = gasleft();
        assertFalse(pool.isKnownRoot(bytes32(uint256(999))));
        uint256 used = gasBefore - gasleft();
        emit log_named_uint("unknown root lookup gas", used);
        assertLt(used, 20_000);
    }

    function testFuzz_depositMaintainsAccounting(uint256 rawCommitment) public {
        uint256 commitment = bound(rawCommitment, 1, pool.SNARK_SCALAR_FIELD() - 1);
        uint256 beforeBalance = usdc.balanceOf(address(pool));
        vm.prank(user);
        pool.deposit(bytes32(commitment));
        assertEq(usdc.balanceOf(address(pool)), beforeBalance + pool.denomination());
        assertEq(pool.nextLeafIndex(), 1);
    }

    function test_mockTokenRejectsMonadTestnetDeployment() public {
        vm.chainId(10143);
        vm.expectRevert(abi.encodeWithSelector(MockUSDC.UnsupportedChain.selector, 10143));
        new MockUSDC();
    }

    function test_feeOnTransferDepositRevertsWithoutStateChange() public {
        FeeOnTransferToken feeToken = new FeeOnTransferToken();
        WispPool feePool =
            new WispPool(address(feeToken), address(verifier), address(poseidon), 1_000_000, address(this));
        feeToken.mint(user, 1_000_000);
        vm.prank(user);
        feeToken.approve(address(feePool), 1_000_000);

        vm.prank(user);
        vm.expectRevert(WispPool.FeeOnTransfer.selector);
        feePool.deposit(bytes32(uint256(777)));

        assertEq(feePool.nextLeafIndex(), 0);
        assertEq(feeToken.balanceOf(address(feePool)), 0);
        assertFalse(feePool.commitments(bytes32(uint256(777))));
    }

    function test_falseReturnTokenDepositRevertsWithoutStateChange() public {
        FalseReturnToken falseToken = new FalseReturnToken();
        WispPool falsePool =
            new WispPool(address(falseToken), address(verifier), address(poseidon), 1_000_000, address(this));
        falseToken.mint(user, 1_000_000);
        vm.prank(user);
        falseToken.approve(address(falsePool), 1_000_000);

        vm.prank(user);
        vm.expectRevert();
        falsePool.deposit(bytes32(uint256(778)));

        assertEq(falsePool.nextLeafIndex(), 0);
        assertFalse(falsePool.commitments(bytes32(uint256(778))));
    }

    function test_depositGasUnderGate() public {
        bytes32 commitment = bytes32(uint256(444));
        uint256 gasBefore = gasleft();
        vm.prank(user);
        pool.deposit(commitment);
        uint256 used = gasBefore - gasleft();
        emit log_named_uint("real Poseidon deposit gas", used);
        assertLt(used, 12_000_000, "deposit exceeds 40% of 30M");
    }
}
